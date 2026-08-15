import tkinter as tk
from tkinter import filedialog as fd
import pdfplumber

def parse_pdf(pdf_file: str):
    """Loads the pdf from a file path and returns a the pdf's contents as a single string."""

    # The file as a pdfplumber.PDF class.
    pdf =  pdfplumber.open(pdf_file)

    text_so_far = ""
    for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_so_far += text + "\n"
            
            for table in page.extract_tables():
                for row in table:
                    cleaned = [cell or "" for cell in row]
                    text_so_far += " | ".join(cleaned) + "\n"

    pdf.close()
    return text_so_far





