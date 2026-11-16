import pytest
from pdfplumber.utils.exceptions import PdfminerException
from pydantic import ValidationError

from data_models import RawAssignment, RawCourse, RawEvaluation, RawRecurring
from parse import parse_pdf


def test_parse_flattens_tables(table_pdf):
    text = parse_pdf(table_pdf)
    assert "PSY100 Schedule" in text
    assert "Week 1 | Problem Set 1 due" in text
    assert "Week 2 | Term Test 1" in text


def test_parse_rejects_pdf_without_text(blank_pdf):
    with pytest.raises(ValueError):
        parse_pdf(blank_pdf)


def test_parse_rejects_non_pdf_bytes():
    with pytest.raises(PdfminerException):
        parse_pdf(b"this is not a pdf")


def test_fixture_validates(psy100_raw):
    course = RawCourse(**psy100_raw)
    assert course.code == "PSY100"
    assert len(course.events) == 3


def test_discriminator_routes_each_type(psy100_raw):
    events = RawCourse(**psy100_raw).events
    assert isinstance(events[0], RawAssignment)
    assert isinstance(events[1], RawEvaluation)
    assert isinstance(events[2], RawRecurring)
    assert events[2].meetings[1].day == "Thursday"


def test_lecture_parses_as_recurring():
    course = RawCourse(code="X", events=[{"type": "lecture", "meetings": [{"day": "Monday"}]}])
    assert isinstance(course.events[0], RawRecurring)


def test_unknown_type_rejected():
    with pytest.raises(ValidationError):
        RawCourse(code="X", events=[{"type": "seminar", "title": "Seminar"}])


def test_optional_fields_default_to_none():
    course = RawCourse(code="X", events=[{"type": "exam", "title": "Final"}])
    exam = course.events[0]
    assert exam.due_date is None and exam.start_time is None
    assert course.timezone is None
