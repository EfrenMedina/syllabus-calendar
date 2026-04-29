from fastapi import FastAPI, UploadFile
from parse import parse_pdf
from extractor import extract_events
import pdfplumber

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World!"}


@app.post("/extract")
async def extract(file: UploadFile):
    # file is the uploaded PDF

    extracted_text = parse_pdf(file.file)
    extracted_events = extract_events(extracted_text)

    return extracted_events

