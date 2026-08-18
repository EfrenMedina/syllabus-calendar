from pydantic import BaseModel, Field
from typing import Literal, Annotated, Union

class RawRecurring(BaseModel):
    """A pydantic model representing the extracted information of a class / tutorial / lab from a pdf syllabus."""
    type: Literal['lecture', 'tutorial', 'lab']
    title: str | None = None
    days: list[str] | None = None
    start_time: str | None = None
    end_time: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class RawAssignment(BaseModel):
    """A pydantic model representing the extracted information of an assignment from a pdf syllabus."""
    type: Literal['assignment']
    title: str | None = None
    due_date: str | None = None
    due_time: str | None = None

class RawEvaluation(BaseModel):
    """A pydantic model representing the extracted information of a test from a pdf syllabus."""
    type: Literal['test', 'quiz', 'exam']
    title: str | None = None
    due_date: str | None = None
    start_time: str | None = None
    end_time: str | None = None

RawEvent = Annotated[Union[RawRecurring, RawAssignment, RawEvaluation], Field(discriminator="type")]

class RawCourse(BaseModel):
    "A pydantic model representing the extracted information of a Course from a pdf syllabus."

    code: str
    timezone: str | None = None
    events: list[RawEvent]