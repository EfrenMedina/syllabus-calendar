from fastapi import FastAPI, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse
from pdfplumber.utils.exceptions import PdfminerException
from pydantic import ValidationError
import anthropic
import hmac
import logging
import os

from parse import parse_pdf, PdfTooLongError
from extractor import extract_events
from data_models import RawCourse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)

# Vercel functions reject request bodies over 4.5 MB, so the BFF can never send more than this.
MAX_BYTES = 4 * 1024 * 1024
# Real syllabi are ~5-20k characters. Anything far longer is either not a syllabus or abuse,
# and every character is paid for on the Claude call.
MAX_TEXT_CHARS = 60_000

logger = logging.getLogger(__name__)

# No public API docs: the only intended caller is the Next.js BFF.
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def require_service_token(request: Request, call_next):
    """Reject /extract calls that don't carry the shared BFF secret, before the upload is read."""
    if request.url.path != "/extract":
        return await call_next(request)

    expected = os.getenv("EXTRACT_SERVICE_TOKEN")
    if not expected:
        logger.error("EXTRACT_SERVICE_TOKEN is not set; refusing /extract requests.")
        return JSONResponse({"detail": "Service is not configured"}, status_code=503)

    provided = request.headers.get("authorization", "")
    if not hmac.compare_digest(provided.encode(), f"Bearer {expected}".encode()):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    return await call_next(request)


@app.get("/health")
def health()->dict[str, str]:
    return {"status": "ok"}

@app.post("/extract")
async def extract(file: UploadFile) -> RawCourse:
    """Validate an uploaded PDF, parse its text, and return the extracted course events."""

    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF files are accepted")

    # Size check
    if file.size is not None and file.size > MAX_BYTES:
        raise HTTPException(413, "File is too large")

    data = await file.read()

    # Empty check
    if not data:
        raise HTTPException(400, "File is empty")

    # authoritative size check 
    if len(data) > MAX_BYTES:          
        raise HTTPException(413, "File is too large")

    # Parsing checks
    try:
        text = parse_pdf(data)
    except PdfminerException:
        raise HTTPException(400, "Could not read that PDF")
    except PdfTooLongError:
        raise HTTPException(413, "That PDF is too long to be a syllabus")
    except ValueError:
        raise HTTPException(400, "No readable text found")

    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(413, "That PDF is too long to be a syllabus")

    # Extractor checks
    try:
        extracted_course = await extract_events(text)
    except ValidationError:
        raise HTTPException(422, "Could not extract events from that syllabus")
    except anthropic.APIError:
        raise HTTPException(502, "Extraction service unavailable")
    except ValueError: 
        raise HTTPException(502, "Extraction failed")

    return extracted_course

