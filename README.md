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

## Abuse protection

Every upload is a paid Claude call, so the public surface is locked down:

- **Only the BFF can call FastAPI.** `/extract` requires `Authorization: Bearer
  $EXTRACT_SERVICE_TOKEN`, checked before the upload is read. If the token isn't
  configured, the service refuses every request.
- **Per-IP rate limit on the BFF:** 5 uploads per 10 minutes, shared across serverless
  instances through Upstash Redis. Rejected files don't count toward the limit.
- **Size caps:** 4 MB per file (Vercel's request limit is 4.5 MB), 30 pages, and 60k
  characters of extracted text before anything is sent to Claude.
- **No public API docs:** FastAPI's `/docs`, `/redoc` and `/openapi.json` are disabled.
- **Spend cap:** set a monthly limit in the Anthropic Console as a last line of defense.

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
printf "ANTHROPIC_API_KEY=sk-ant-...\nEXTRACT_SERVICE_TOKEN=<same value as .env.local>\n" > .env
uvicorn index:app --reload --port 8000
```

Or with Docker:

```bash
docker build -t syllabus-api api
docker run -p 8000:8000 -e ANTHROPIC_API_KEY=sk-ant-... -e EXTRACT_SERVICE_TOKEN=... syllabus-api
```

**2. Web app** (port 3000)

```bash
npm install
cp .env.example .env.local   # set EXTRACT_SERVICE_TOKEN (openssl rand -hex 32)
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
| `EXTRACT_SERVICE_TOKEN` | **Both** Next.js (Vercel) and FastAPI (Render) | The same random secret on both sides |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Next.js (Vercel) | From a free Upstash Redis database; enables the shared rate limit |
| `ANTHROPIC_API_KEY` | FastAPI (`api/.env`, Render) | Your Anthropic key |

## Deploy

- **API:** a Render Web Service with root directory `api/` and the Docker runtime. Set
  `ANTHROPIC_API_KEY` and `EXTRACT_SERVICE_TOKEN`. The container listens on `$PORT`. The free tier sleeps after
  about 15 minutes, so the first upload after idle can take up to a minute. The BFF waits
  up to 90 seconds.
- **Web:** import the repo in Vercel with the Next.js preset, and set `EXTRACT_SERVICE_URL`
  to the Render URL, `EXTRACT_SERVICE_TOKEN`, and the two Upstash variables.
