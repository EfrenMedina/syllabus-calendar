import io
import pdfplumber 
from pdfplumber.utils.exceptions import PdfminerException
import logging

logger = logging.getLogger(__name__)

def parse_pdf(pdf_file: bytes) -> str:
    """Extract all text and tables from a PDF file, returned as one string."""

    try:
        pdf = pdfplumber.open(io.BytesIO(pdf_file))
    except PdfminerException:
        logger.error("Could not open the PDF (corrupt, encrypted, or not a PDF).")
        raise

    with pdf:
        text_so_far = ""
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=2)
            if text:
                text_so_far += text + "\n"
            
            for table in page.extract_tables():
                for row in table:
                    cleaned = [(cell or "").replace("\n", " ").strip() for cell in row if cell]
                    if cleaned:
                        text_so_far += " | ".join(cleaned) + "\n"
    if not text_so_far.strip():
        logger.error("The extracted text is empty.")
        raise ValueError("no extractable text")

    return text_so_far





