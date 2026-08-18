import io
import pdfplumber 
from pdfminer.pdfparser import PDFSyntaxError
from pdfminer.pdfdocument import PDFPasswordIncorrect
import logging

logger = logging.getLogger(__name__)

def parse_pdf(pdf_file: bytes):
    """Loads the pdf from a file path and returns a the pdf's contents as a single string."""

    # The file as a pdfplumber.PDF class.
    try:
        pdf = pdfplumber.open(io.BytesIO(pdf_file))
    except PDFSyntaxError:
        logger.error("Failed to open the PDF.")
        raise
    except PDFPasswordIncorrect:
        logger.error("Remove the password from the PDF and retry.")
        raise
         
    with pdf:
        text_so_far = ""
        for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_so_far += text + "\n"
                
                for table in page.extract_tables():
                    for row in table:
                        cleaned = [cell or "" for cell in row]
                        text_so_far += " | ".join(cleaned) + "\n"
    if not text_so_far.strip():
        logger.error("The extracted text is empty.")
        raise ValueError("no extractable text")

    return text_so_far





