# Syllabus Calendar

Upload a course syllabus PDF, check the dates Claude pulled out of it, and download a
`.ics` file that imports into Google Calendar, Apple Calendar, or Outlook. Weekly lectures,
tutorials, and labs become recurring events; assignments, tests, quizzes, and exams become
one-off events. Nothing is stored: the whole flow lives in the browser session.

**Flow:** upload → review and correct every row → export `.ics`

## Architecture

```
Browser (Next.js 16, React 19, Tailwind v4)
   │  POST /api/extract (multipart PDF)
   ▼
Next.js Route Handler — the backend-for-frontend (Vercel)
   │  validates the upload, forwards it, normalizes snake_case → camelCase,
   │  returns { ok: true, data } | { ok: false, error }
   ▼
FastAPI service in Docker (Render)
   │  pdfplumber extracts text and flattens tables to "cell | cell" rows
   ▼
Claude (claude-haiku-4-5, structured output validated by Pydantic)
```

- The `.ics` file is built in the browser by a hand-rolled RFC 5545 generator
  (`lib/ics.ts`) using floating local times. Classes that meet on different days at
  different times get one `RRULE` per time slot.
- The Anthropic API key lives only on the FastAPI service. The Next.js app never calls
  Claude directly.

| Path | What it is |
|---|---|
| `app/page.tsx`, `app/review/page.tsx`, `app/export/page.tsx` | The three steps |
| `app/api/extract/route.ts` | BFF route handler |
| `context/SyllabusProvider.tsx` | In-memory course state shared across steps |
| `components/EventsTable.tsx` | Editable TanStack Table (v9) per event type |
| `lib/types.ts` | The data model |
| `lib/normalize.ts` | The only place that knows about snake_case |
| `lib/ics.ts` | `.ics` generator and export blockers |
| `api/` | FastAPI service: `index.py` (endpoints), `parse.py`, `extractor.py`, `data_models.py` |

## Run it locally

You need Node 20+, Python 3.12+, and an Anthropic API key.

**1. Extraction service** (port 8000)

```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
uvicorn index:app --reload --port 8000
```

Or with Docker:

```bash
docker build -t syllabus-api api
docker run -p 8000:8000 -e ANTHROPIC_API_KEY=sk-ant-... syllabus-api
```

**2. Web app** (port 3000)

```bash
npm install
cp .env.example .env.local   # EXTRACT_SERVICE_URL=http://127.0.0.1:8000
npm run dev
```

Open http://localhost:3000. Use "Try a sample syllabus" to click through without a PDF
or the API.

## Tests

```bash
npm test -- --run        # Vitest: normalizer, BFF, .ics, context, and UI components
npm run typecheck
npm run lint
cd api && pytest         # parsing, Pydantic models, and endpoints (Claude is mocked)
```

## Environment variables

| Variable | Where | Value |
|---|---|---|
| `EXTRACT_SERVICE_URL` | Next.js (`.env.local`, Vercel) | Base URL of the FastAPI service, e.g. your Render URL |
| `ANTHROPIC_API_KEY` | FastAPI (`api/.env`, Render) | Your Anthropic key |

## Deploy

- **API:** a Render Web Service with root directory `api/` and the Docker runtime. Set
  `ANTHROPIC_API_KEY`. The container listens on `$PORT`. The free tier sleeps after
  about 15 minutes, so the first upload after idle can take up to a minute. The BFF waits
  up to 90 seconds.
- **Web:** import the repo in Vercel with the Next.js preset, and set `EXTRACT_SERVICE_URL`
  to the Render URL.
