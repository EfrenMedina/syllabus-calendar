from fastapi import FastAPI, UploadFile, HTTPException
from pdfplumber.utils.exceptions import PdfminerException
from pydantic import ValidationError
import anthropic

from parse import parse_pdf
from extractor import extract_events
from data_models import RawCourse

MAX_BYTES = 10 * 1024 * 1024

app = FastAPI()

@app.get("/health")
def health()->dict[str, str]:
    return {"status": "ok"}

@app.post("/extract")
async def extract(file: UploadFile) -> RawCourse:
    """Validate an uploaded PDF, parse its text, and return the extracted course events."""

    # Empty check
    if not file:
            raise HTTPException(400, "File is empty")

    if file.content_type != "application/pdf":
        raise HTTPException(400, "Only PDF files are accepted")

    # Size check
    if file.size is not None and file.size > MAX_BYTES:
        raise HTTPException(413, "File is too large")

    data = await file.read()

    # authoritative size check 
    if len(data) > MAX_BYTES:          
        raise HTTPException(413, "File is too large")

    # Parsing checks
    try:
        text = parse_pdf(data)
    except PdfminerException:
        raise HTTPException(400, "Could not read that PDF")
    except ValueError:
        raise HTTPException(400, "No readable text found")

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

