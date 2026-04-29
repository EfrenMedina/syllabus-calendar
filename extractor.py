import anthropic
import os
import json
import re
from dotenv import load_dotenv
from parse import parse_pdf

load_dotenv()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

INSTRUCTIONS_PROMT = """You are a structured data extractor. Your only job is to extract calendar events from university syllabus text and return a single valid JSON object.
                        STRICT RULES:
                        - Return ONLY the JSON object. No explanation, no markdown, no code fences, no preamble.
                        - All dates must be YYYY-MM-DD format.
                        - All times must be HH:MM AM/PM format (e.g. 11:59 PM).
                        - If timezone is not explicitly stated, use "America/Toronto".
                        - If a field is unknown, omit it entirely. Never guess or hallucinate.

                        EVENT TYPES you must extract:
                        - assignments (one-time, have due_date and due_time)
                        - tests and exams (one-time, have due_date, start_time, end_time)
                        - lectures (recurring, have days, start_time, end_time, recurrence_start, recurrence_end)

                        JSON SCHEMA you must follow exactly:
                        {
                        "course": "PSY100",
                        "timezone": "America/Toronto",
                        "events": [
                            {
                            "type": "assignment",
                            "title": "Problem Set 1",
                            "due_date": "2025-09-25",
                            "due_time": "11:59 PM"
                            },
                            {
                            "type": "test",
                            "title": "Term Test 1",
                            "due_date": "2025-10-09",
                            "start_time": "05:15 PM",
                            "end_time": "06:45 PM"
                            },
                            {
                            "type": "lecture",
                            "title": "Lecture",
                            "days": ["Tuesday", "Thursday"],
                            "start_time": "11:00 AM",
                            "end_time": "01:00 PM",
                            "recurrence_start": "2025-09-02",
                            "recurrence_end": "2025-11-27"
                            }
                            ]
                        }
                    """ 



def extract_events(text: str) -> dict:
    user_prompt = f"Extract all calendar events from this syllabus:\n\n{text}"

    events_JSON = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=INSTRUCTIONS_PROMT,
        messages=[{"role": "user", "content": user_prompt}]
    )
    raw = events_JSON.content[0].text
    raw = re.sub(r"```json|```", "", raw).strip()
    print(raw)
    return json.loads(raw)

    