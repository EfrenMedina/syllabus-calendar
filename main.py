from parse import parse_pdf
from extractor import extract_events

text = parse_pdf()
print(f"Text length: {len(text)}")
result = extract_events(text)
print(result)