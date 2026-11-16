import anthropic
import httpx
import pytest
from fastapi.testclient import TestClient

import index
from data_models import RawCourse


@pytest.fixture
def client():
    return TestClient(index.app)


def upload(client, data: bytes, content_type="application/pdf", name="syllabus.pdf"):
    return client.post("/extract", files={"file": (name, data, content_type)})


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_rejects_non_pdf(client):
    res = upload(client, b"hello", content_type="image/png", name="a.png")
    assert res.status_code == 400


def test_rejects_empty_file(client):
    res = upload(client, b"")
    assert res.status_code == 400


def test_rejects_unreadable_pdf(client):
    res = upload(client, b"not really a pdf")
    assert res.status_code == 400


def test_rejects_pdf_without_text(client, blank_pdf):
    res = upload(client, blank_pdf)
    assert res.status_code == 400
    assert res.json()["detail"] == "No readable text found"


def test_happy_path(client, monkeypatch, table_pdf, psy100_raw):
    seen = {}

    async def fake_extract(text: str) -> RawCourse:
        seen["text"] = text
        return RawCourse(**psy100_raw)

    monkeypatch.setattr(index, "extract_events", fake_extract)
    res = upload(client, table_pdf)

    assert res.status_code == 200
    body = res.json()
    assert body["code"] == "PSY100"
    assert [e["type"] for e in body["events"]] == ["assignment", "test", "lecture"]
    assert "Week 1 | Problem Set 1 due" in seen["text"]


def test_claude_failure_is_502(client, monkeypatch, table_pdf):
    async def boom(text: str):
        request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
        raise anthropic.APIConnectionError(request=request)

    monkeypatch.setattr(index, "extract_events", boom)
    assert upload(client, table_pdf).status_code == 502


def test_extraction_value_error_is_502(client, monkeypatch, table_pdf):
    async def truncated(text: str):
        raise ValueError("extraction truncated")

    monkeypatch.setattr(index, "extract_events", truncated)
    assert upload(client, table_pdf).status_code == 502
