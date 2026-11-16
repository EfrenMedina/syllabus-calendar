import io
import os
import sys
from pathlib import Path

import pytest

# The service uses flat sibling imports ("from parse import parse_pdf"), so put api/ on the path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# extractor.py refuses to import without a key. Tests never call Claude, so a dummy is enough.
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")


# BUILD_PLAN.md §8 raw extraction
PSY100_RAW = {
    "code": "PSY100",
    "timezone": "America/Toronto",
    "events": [
        {"type": "assignment", "title": "Problem Set 1", "due_date": "2025-09-25", "due_time": "11:59 PM"},
        {
            "type": "test",
            "title": "Term Test 1",
            "due_date": "2025-10-09",
            "start_time": "05:15 PM",
            "end_time": "06:45 PM",
        },
        {
            "type": "lecture",
            "title": "Lecture",
            "meetings": [
                {"day": "Tuesday", "start_time": "11:00 AM", "end_time": "12:00 PM"},
                {"day": "Thursday", "start_time": "11:00 AM", "end_time": "01:00 PM"},
            ],
            "start_date": "2025-09-02",
            "end_date": "2025-11-27",
        },
    ],
}


@pytest.fixture
def psy100_raw() -> dict:
    return PSY100_RAW


def build_pdf(draw) -> bytes:
    """Render a one-page PDF in memory with reportlab; `draw` receives the canvas."""
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    pdf = canvas.Canvas(buf, pagesize=letter)
    draw(pdf)
    pdf.showPage()
    pdf.save()
    return buf.getvalue()


@pytest.fixture
def table_pdf() -> bytes:
    """A 1-page PDF with a heading and a ruled 2x2 table."""

    def draw(pdf):
        from reportlab.platypus import Table, TableStyle

        pdf.drawString(72, 720, "PSY100 Schedule")
        table = Table([["Week 1", "Problem Set 1 due"], ["Week 2", "Term Test 1"]], colWidths=[120, 200])
        table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 1, (0, 0, 0))]))
        table.wrapOn(pdf, 400, 200)
        table.drawOn(pdf, 72, 600)

    return build_pdf(draw)


@pytest.fixture
def blank_pdf() -> bytes:
    return build_pdf(lambda pdf: None)
