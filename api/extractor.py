import anthropic
import os
import logging
from pydantic import ValidationError
from dotenv import load_dotenv
from data_models import RawCourse

logger = logging.getLogger(__name__)

load_dotenv()
api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key:
    raise RuntimeError("ANTHROPIC_API_KEY is not set")
    
client = anthropic.AsyncAnthropic(api_key=api_key)

INSTRUCTIONS_PROMPT = """You are a structured data extractor. Extract every calendar event from the text of a university course syllabus.

                        FORMAT RULES
                        - All dates must be YYYY-MM-DD.
                        - All times must be HH:MM AM/PM (for example 11:59 PM).
                        - Weekdays must be full English names (for example Tuesday).
                        - If no timezone is stated, use "America/Toronto".
                        - Use the course code exactly as it appears in the document.
                        - If a date omits the year, infer it from the term or academic year stated in the document (for example "Fall 2025"). This is not guessing.
                        - Any statement of a deadline with a date is an assignment event, even when it appears among readings or course materials. Phrases such as "deadline for", "due", "submit by", or "closes on" signal one.
                        - Do not extract readings, chapters, or preparation material as events. Only extract items with a stated deadline.
                        - When the same assignment recurs on multiple dates, number each occurrence in the title (for example "Problem Set 1", "Problem Set 2") using the document's numbering if present, or sequential numbers by date if not.

                        RECURRING MEETINGS (lecture, tutorial, lab)
                        - These are classes that repeat on a weekly cycle.
                        - Emit exactly ONE event per class type for the entire term. Never create one event per week, per session, or per lecture topic.
                        - Set days to every weekday the class meets, and set start_date and end_date to the first and last meeting of the term.
                        - Use a simple title such as "Lecture", "Tutorial", or "Lab".
                        - If no meeting days can be determined for a class, omit the event entirely rather than emitting it with empty meetings.
                        - Always set a title. If the document gives no specific name, use the type.

                        ONE-TIME ASSESSMENTS
                        - assignment: work submitted by a deadline. Use due_date and due_time.
                        - test, quiz, exam: a sitting with a scheduled time. Use due_date, start_time, and end_time.
                        - Give each the title used in the document.

                        WHERE TO LOOK
                        - Dated items appear anywhere in a syllabus: prose, grading breakdowns, bulleted lists, and schedule tables.
                        - Tables may reach you flattened into rows whose cells are separated by " | ". Read them carefully.
                        - A single row or paragraph can contain both a class topic and an unrelated deadline. Extract each as its own event.
                        - Read the whole document. Do not stop after the first section that looks like a schedule.

                        ACCURACY RULES
                        - Never invent or guess a date or time.
                        - If a graded assessment has no date in the document (for example a final exam listed as "TBD"), still emit the event with its title, and omit only the unknown date and time fields. Do not drop the assessment.
                        - If the document gives only a window (for example an exam period), leave the date fields empty rather than picking a date from within it.
                        - Omit any unknown optional field rather than filling it with a placeholder.
                        - Do not duplicate the same assessment, and do not merge two distinct assessments into one event.
                        - Do not supply a default time. If a deadline states a date but no clock time, leave due_time empty.
                    """

async def extract_events(text: str) -> RawCourse:
    """Send syllabus text to Claude and return the validated course and events."""

    user_prompt = f"Extract all calendar events from this syllabus:\n\n{text}"

    # Anthropic API call
    try:
        response = await client.messages.parse(
            model="claude-haiku-4-5",
            max_tokens=16000,
            system=INSTRUCTIONS_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
            output_format=RawCourse
        )
    except anthropic.AuthenticationError:
        logger.error("Anthropic config was rejected. Check config.")
        raise
    except anthropic.APIError as e:
        logger.error("Anthropic call failed: %s", e)
        raise

    if response.stop_reason == "max_tokens":
        logger.error("Output truncated, please raise max output tokens.")
        raise ValueError("extraction truncated")

    if response.stop_reason == "refusal":
        logger.error("Claude refused: %s", response.stop_details)
        raise ValueError("Extraction refused")

    course = response.parsed_output
    if course is None:
        raise ValueError("empty extraction response")

    return course
    



    