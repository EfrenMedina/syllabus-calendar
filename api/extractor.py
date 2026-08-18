import anthropic
import os
import logging
from pydantic import ValidationError
from dotenv import load_dotenv
from data_models import RawCourse

try:
    load_dotenv()
except Exception as error:
    raise RuntimeError
    
client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

INSTRUCTIONS_PROMPT = """You are a structured data extractor. Your only job is to extract calendar events from university syllabus text and return a single valid JSON object.
                        STRICT RULES:
                        - Return ONLY the JSON object. No explanation, no markdown, no code fences, no preamble.
                        - All dates must be YYYY-MM-DD format.
                        - All times must be HH:MM AM/PM format (e.g. 11:59 PM).
                        - If timezone is not explicitly stated, use "America/Toronto".
                        - If a field is unknown, omit it entirely. Never guess or hallucinate.

                        EVENT TYPES you must extract:
                        - assignments (one-time, have due_date and due_time)    
                        - tests, quizzes and exams (one-time, have due_date, start_time, end_time)
                        - lectures (recurring, have days, start_time, end_time, recurrence_start, recurrence_end)

                        For each event enforce one of the following types: 'lecture', 'tutorial', 'lab', 'assignment', 'test', 'quiz', 'exam'

                        JSON SCHEMA you must follow exactly:
                        {
                        "code": "PSY100",
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
                            "start_date": "2025-09-02",
                            "end_date": "2025-11-27"
                            }
                            ]
                        }
                    """ 

async def extract_events(text: str) -> RawCourse:
    user_prompt = f"Extract all calendar events from this syllabus:\n\n{text}"

    try:
        events_JSON = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=16000,
            system=INSTRUCTIONS_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
            output_config={"format": {"type": "json_schema", "schema": RawCourse.model_json_schema()}}
        )
    except anthropic.AunthenticatorError:
        logger.error("Antropic config was rejected. Check config.")
        raise

    raw_json = events_JSON.content[0].text
    json = json.loads(raw_json)

    try:
        RawCourse.model_validate_json(json)
    except:

    



    