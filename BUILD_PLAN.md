# Syllabus Calendar — Week 1 Build Plan

## 1. Summary

Rebuild the syllabus-calendar app as a polished, deployed web app: a user uploads a
syllabus PDF, a Python/FastAPI service parses it and extracts assessments, deadlines,
and recurring classes with the Claude API, the user **reviews and corrects** the
extracted events in an editable table, and then exports them as a `.ics` calendar file.
Week 1 ships the full flow — upload → extract → review/correct → `.ics` export —
deployed: the Next.js app on Vercel and the FastAPI service in a Docker container on
Render. There is **no database and no auth**: the app is single-session and stateless by
design, so the week's hours go into React, TypeScript, Tailwind, Next.js, FastAPI, and
Docker — the skills this project exists to build. The one thing
carried over from the old repo is the extraction logic (prompt + pdfplumber parsing) in
`salvage/`. You write every other line yourself.

---

## 2. Ground rules

1. **Write every line yourself.** No AI autocomplete beyond the editor's type hints, no
   "generate this component," no pasting answers. When you're stuck, read the official
   docs in §9 — not a chatbot. The point of this project is that you can defend every
   line in an interview.
2. **You must be able to explain any file you commit.** Before you `git commit`, reread
   the diff and ask: could I whiteboard this on request? If not, you copied it. Rewrite
   it until you understand it.
3. **Types first, bodies second.** This document gives you signatures, schemas, and
   test tables. Type the signatures into empty files, get them to compile, then fill the
   bodies. The bodies are the work.
4. **Red-green.** For every function with a test table here, write the test first, watch
   it fail, then make it pass. Never write a pure function (`normalizeTime`, `buildICS`,
   the normalizer) without its test.
5. **Deploy on Day 1 and keep it deployed.** A broken deploy caught on Day 1 costs an
   hour; caught on Day 7 it costs the deadline. Push to the public URL every day.
6. **Commit in small, labelled steps.** One story ≈ one or a few commits. Conventional
   messages (`feat:`, `test:`, `chore:`). If a commit does two things, split it.
7. **The review step is mandatory, not polish.** LLM extraction is wrong often enough
   that exporting raw output would ship bad calendars. The correct-before-export table
   is the product, not a nicety.

---

## 3. Scope decisions already made

| Decision | Value | Why |
|---|---|---|
| Database | **None** | Single-session flow (upload → correct → download). Nothing is worth persisting for week 1, and dropping it frees ~12–16h for the frontend skills you're here to build. Directly answers "what is Supabase's role": **not used in week 1.** |
| Auth | **None** | No data to protect without a database. Removed with Supabase. |
| Frontend | Next.js 15 (App Router, Turbopack) + React 19 + TypeScript | Overlaps the UofT Blueprint stack; App Router + Route Handlers give you the backend-for-frontend you need. |
| Styling | Tailwind CSS v4 (+ PostCSS, autoprefixer) | Requested learning target; v4's zero-config `@import "tailwindcss"` is the current idiom. |
| PDF parse + LLM extract | Python / FastAPI, packaged as a **Docker image** and deployed on **Render** (Fly.io is an equivalent alt) | pdfplumber has no good Node equivalent (it flattens tables, and syllabi are tables). A container makes pdfplumber's system deps reproducible and is the actual prod artifact — defensible, unlike a Dockerfile a platform ignores. |
| Containerization | **Docker** — one `Dockerfile` for the FastAPI service only | Real Docker practice on the one piece that benefits (native deps + reproducible runtime). The Next.js app stays source-deployed on Vercel; don't containerize it. |
| FastAPI ↔ Next boundary | Browser → **Next Route Handler (`/api/extract`, TypeScript, on Vercel)** → **FastAPI (`/extract`, Python, in Docker on Render)** → Claude | The Route Handler is the backend-for-frontend: it validates the upload, keeps the API key server-side, and normalizes the response shape. It reaches the container via `EXTRACT_SERVICE_URL`. FastAPI owns only parse + extract. |
| Review UI state | React **Context** (`SyllabusProvider`) at the root layout, holding the normalized `ExtractionResult` | No DB, so the corrected events live in memory across the 3 route steps. TanStack Table renders from context and writes edits back through context callbacks. |
| `.ics` generation | **Hand-rolled** pure function (`lib/ics.ts`), RFC 5545 subset | A bounded, fully-testable TypeScript exercise (discriminated unions, date math, RRULE). Better learning than importing the `ics` package. |
| Event times in the model | Normalized to 24-hour `HH:mm` | The LLM emits `11:59 PM`; converting once at the boundary means the table and `.ics` code never deal with AM/PM. |
| `.ics` time zone handling | **Floating local time** (no `TZID`, no `Z`) | Correct-enough for a personal calendar in one time zone, needs zero time-zone math, keeps `buildICS` a clean pure function. Real `VTIMEZONE`/`TZID` is a Phase-2 upgrade. |
| CI / Husky / lint-staged / GitHub Actions | **Deferred** (your choice) | Kept to local `lint`/`format` scripts + manual Vercel deploys for week 1. Add later; still résumé-able as "added CI in week 2." |
| Deployment topology | **Next.js on Vercel** (source-deployed) **+ FastAPI Docker image on Render**, connected by `EXTRACT_SERVICE_URL` | Two platforms, but each does what it's best at, and the container is a real deploy artifact. Both auto-deploy from the same GitHub repo on push. |
| Monthly cost | **$0** infra (Vercel Hobby + Render free web service) **+ Anthropic API usage** (~$0.001–0.01 per syllabus on `claude-haiku-4-5`) | Only non-free cost is the LLM calls. Trade-off: Render's free tier spins down after ~15 min idle, so the first extract after idle has a ~50s cold start — fine for a demo. |

---

## 4. Conventions used throughout

Decide these once, here, so you never stall mid-build.

**Directory layout (repo root):**

```
app/
  layout.tsx              # root layout: fonts, <SyllabusProvider>, <Toaster>
  page.tsx                # step 1 — upload
  review/page.tsx         # step 2 — review & correct
  export/page.tsx         # step 3 — export .ics
  api/extract/route.ts    # BFF route handler (TypeScript)
  globals.css             # @import "tailwindcss"
components/
  UploadDropzone.tsx
  EventsTable.tsx
  StepIndicator.tsx
context/
  SyllabusProvider.tsx
lib/
  types.ts                # shared TS types (the data model)
  normalize.ts            # raw snake_case -> normalized camelCase model
  ics.ts                  # buildICS + helpers
  api.ts                  # client fetch helper
api/
  index.py                # FastAPI app: parse_pdf, extract_events, endpoints
  requirements.txt        # fastapi, uvicorn, pdfplumber, anthropic, python-multipart
  Dockerfile              # builds the FastAPI service image (runs uvicorn)
  .dockerignore           # keep the image small (no __pycache__, .env, etc.)
tests/                    # or colocate *.test.ts next to source
.env.example              # Next.js needs no vercel.json — it deploys from source
```

**Naming**

- Files: React components `PascalCase.tsx`; everything else `camelCase.ts` (`normalize.ts`).
- Types/interfaces `PascalCase`; functions/vars `camelCase`; the Python service stays `snake_case` (idiomatic Python).
- **The boundary rule:** the LLM and FastAPI speak **`snake_case`** JSON; everything in the Next app is **`camelCase`**. The normalizer (`lib/normalize.ts`) is the one place that translates. Nothing downstream of it sees `snake_case`.

**The data model (single source of truth — you retype this into `lib/types.ts` on Day 3)**

- Event `type` tags are **singular**: `"lecture" | "tutorial" | "lab" | "assignment" | "test"`.
  (The old code was inconsistent — `"assignments"` in JS, `"assignment"` in Python. Singular wins; it makes a clean discriminated union.)
- Dates: `"YYYY-MM-DD"`. Times: 24-hour `"HH:mm"`. Weekdays: lowercase full English (`"tuesday"`).
- Every event gets a client-generated `id` (`crypto.randomUUID()`), assigned in the normalizer, so table rows are addressable for edit/delete.

**API response shape** — the Route Handler always returns this envelope:

```ts
type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

**Error handling**

- FastAPI: raise `HTTPException` with a real status (`400` unreadable or encrypted PDF, `422` LLM output failed validation, `502` Claude call failed). Body: `{ "detail": "<human message>" }`.
- Route Handler: catch everything, map to `{ ok: false, error }`, never leak a stack trace or the API key. Client-facing `error.code` ∈ `"BAD_FILE" | "EXTRACT_FAILED" | "UPSTREAM_DOWN"`.
- Client: `lib/api.ts` throws on `ok: false`; the upload component catches and shows a `react-hot-toast` error.

**Test tolerances**

- Pure functions (`normalizeTime`, `normalizeWeekday`, `buildICS`, `normalizeExtraction`): **exact** equality against the tables in this doc.
- `.ics` output: compare **line-by-line** (split on `\r\n`) against an expected `string[]`; inject a fixed `dtstamp` so output is deterministic.
- Extraction accuracy (LLM, non-deterministic): **field-level** match against the §8 fixture — count correct fields / total fields; target ≥ 90% on the fixture syllabus. This is a metric, not a pass/fail test.

**Commits:** conventional (`feat:`, `fix:`, `test:`, `chore:`, `docs:`). Deploy after each day.

---

## 5. Before you start

**Install & verify** (run each verify command; each must print a version):

| Tool | Install | Verify |
|---|---|---|
| Node ≥ 20 | nodejs.org or `nvm install 20` | `node -v` |
| npm | ships with Node | `npm -v` |
| Python ≥ 3.11 | python.org or `pyenv install 3.11` | `python3 --version` |
| Vercel CLI | `npm i -g vercel` | `vercel --version` |
| Git | preinstalled on macOS | `git --version` |

Accounts: a **Vercel** account (free Hobby) linked to your GitHub. Your **Anthropic API key** is already preserved at `./.env.local` (gitignored).

**Repo is already clean.** The old Vite/Express code is deleted; only `salvage/` (parsing + prompt reference), `.gitignore`, and `.env.local` remain, on branch `week1-build`. The old code lives on in the `feature/frontend` branch and git history.

**Setup steps**

- [ ] Confirm you're on `week1-build` (`git branch --show-current`).
- [ ] Read `salvage/README.md` and skim the three files — you'll port them on Day 2.
- [ ] Create `.env.example` (committed template, no secrets):
  ```
  # Used by the FastAPI service (local dev + Render env). The Next app never sees it.
  ANTHROPIC_API_KEY=sk-ant-xxxx
  # Used by the Next.js Route Handler to reach the FastAPI service.
  # Local: http://127.0.0.1:8000  ·  Prod (Vercel env var): your Render URL
  EXTRACT_SERVICE_URL=http://127.0.0.1:8000
  ```
- [ ] Confirm `.env.local` holds your real `ANTHROPIC_API_KEY` and is gitignored (`git check-ignore .env.local` prints the path).

## 6. Week 1, day by day

Each day has one deliverable and 1–3 stories. Stated hours are for someone hand-writing
every line while learning the stack. **Total ≈ 43.5h** — tight for one week; the marked
**⚠ uncertain** stories carry fallbacks, and Day 7 is a buffer that absorbs slippage.

### Day 1 — Scaffold & first deploy · **~7h**

> **Deliverable:** an empty Next.js app live on a public Vercel URL, **plus** the
> FastAPI service running in a Docker container deployed on Render, answering at
> `/health` — proving the whole two-service topology deploys, even though the app
> does nothing yet.

#### Story 1.1 — Scaffold Next.js 15 + TS + Tailwind v4
- **Goal:** a running `create-next-app` project at the repo root with Tailwind v4 wired in.
- **Estimate:** 3h · **Depends on:** nothing
- **Files:** `package.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`
- **Signatures:** none (framework scaffold)
- **Subtasks:**
  - [ ] Run `npx create-next-app@latest .` in the repo root (TypeScript: yes, App Router: yes, Turbopack: yes, Tailwind: yes, ESLint: yes, `src/`: no, import alias: `@/*`). Let it merge into the existing git repo.
  - [ ] Verify `app/globals.css` begins with `@import "tailwindcss";` (v4 idiom). Confirm `postcss.config.mjs` uses `@tailwindcss/postcss`.
  - [ ] Delete the boilerplate in `app/page.tsx`; replace with a single `<h1>Syllabus Calendar</h1>` and one Tailwind class to prove styling works.
  - [ ] `npm run dev`, open localhost, confirm the heading renders styled.
- **Tests:**

  | Test | Input | Expected |
  |---|---|---|
  | dev server boots | `npm run dev` | compiles, no errors, page 200 |
  | tailwind active | inspect `<h1>` in browser | the utility class you added is applied |
- **Done when:** `npm run build` exits 0; the dev server renders the styled heading; `tsc --noEmit` is clean.

#### Story 1.2 — Dockerize FastAPI & deploy on Render (topology proof)
- **Goal:** a minimal FastAPI app that runs in a Docker container locally and is deployed as a Render web service, answering `GET /health`.
- **Estimate:** 3h · **Depends on:** 1.1
- **Files:** `api/index.py`, `api/requirements.txt`, `api/Dockerfile`, `api/.dockerignore`
- **Signatures:**
  ```python
  # api/index.py
  from fastapi import FastAPI
  app = FastAPI()

  @app.get("/health")
  def health() -> dict: ...   # returns {"status": "ok"}
  ```
  ```dockerfile
  # api/Dockerfile — declarations to fill in yourself
  FROM python:3.11-slim
  WORKDIR /app
  # COPY requirements.txt, pip install, COPY app code
  # EXPOSE 8000
  # CMD -> uvicorn api index app on 0.0.0.0:$PORT   (Render sets $PORT)
  ```
  `api/requirements.txt`: `fastapi`, `uvicorn[standard]`, `pdfplumber`, `anthropic`, `python-multipart` (add now; you need them Day 2).
- **Subtasks:**
  - [ ] Write the minimal FastAPI app exposing `app` and the `health` route (body: return the dict).
  - [ ] Write the `Dockerfile` (slim Python base, install requirements, run uvicorn binding `0.0.0.0` and the `$PORT` Render provides) and a `.dockerignore`.
  - [ ] **Local, without Docker:** `uvicorn api.index:app --reload --port 8000`; `curl localhost:8000/health` → `{"status":"ok"}`.
  - [ ] **Local, with Docker:** `docker build -t syllabus-api api` then `docker run -p 8000:8000 syllabus-api`; hit `/health` again — proves the image works.
  - [ ] Create a Render **Web Service** from the repo, root dir `api/`, Docker runtime; deploy; set `ANTHROPIC_API_KEY` in Render's env (needed Day 2). Note the Render URL.
- **Tests:**

  | Test | Input | Expected |
  |---|---|---|
  | health (uvicorn) | `GET /health` on `:8000` | `200`, `{"status":"ok"}` |
  | health (container) | `GET /health` against `docker run` | `200`, `{"status":"ok"}` |
  | health (Render) | `GET /health` on the Render URL | `200`, `{"status":"ok"}` |
- **Done when:** `/health` answers from the running container **and** from the deployed Render URL. **Record the Render URL** — it's your `EXTRACT_SERVICE_URL` in prod.
- **⚠ Uncertain:** first-time Docker + Render setup can eat time (base image, `$PORT` binding, build context). **Fallback:** if the container fights you on Day 1, deploy the same FastAPI to Render's **native Python** runtime (no Dockerfile) to stay unblocked, and circle back to containerize it on Day 7. The app is identical either way.

#### Story 1.3 — Deploy the Next.js app on Vercel
- **Goal:** the scaffold live on a public Vercel URL, wired to the Render service.
- **Estimate:** 1h · **Depends on:** 1.1, 1.2
- **Files:** none (Vercel dashboard + env vars)
- **Subtasks:**
  - [ ] `git add -A && git commit`; push `week1-build`; import the repo in Vercel (framework: Next.js, source-deployed — no Dockerfile involved for the frontend).
  - [ ] Set `EXTRACT_SERVICE_URL` in Vercel → Environment Variables to your Render URL from 1.2. (The `ANTHROPIC_API_KEY` lives on **Render**, not Vercel — the Next app never calls Claude directly.)
  - [ ] Deploy; open the public Vercel URL.
- **Tests:**

  | Test | Input | Expected |
  |---|---|---|
  | prod page | `GET /` on the Vercel URL | styled heading renders |
  | wiring | (later, Day 3) BFF can reach the Render `/health` | reachable via `EXTRACT_SERVICE_URL` |
- **Done when:** the Vercel URL serves the app and `EXTRACT_SERVICE_URL` points at the live Render service. **Record both URLs in §10.**

---

### Day 2 — Extraction service · **~6.5h**

> **Deliverable:** `POST /extract` accepts a PDF and returns schema-valid,
> snake_case JSON for a real syllabus — deployed.

#### Story 2.1 — FastAPI parse + extract
- **Goal:** port the salvaged pdfplumber parser and Claude prompt into `api/index.py`, driven by structured outputs and validated by Pydantic.
- **Estimate:** 4h · **Depends on:** 1.2
- **Files:** `api/index.py` (extend)
- **Signatures (declarations only):**
  ```python
  from pydantic import BaseModel, Field
  from typing import Literal, Annotated, Union
  from fastapi import UploadFile

  class RawAssignment(BaseModel):
      type: Literal["assignment"]; title: str
      due_date: str; due_time: str | None = None

  class RawTest(BaseModel):
      type: Literal["test"]; title: str
      due_date: str; start_time: str; end_time: str | None = None

  class RawRecurring(BaseModel):
      type: Literal["lecture", "tutorial", "lab"]; title: str | None = None
      days: list[str]; start_time: str; end_time: str
      start_date: str; end_date: str

  RawEvent = Annotated[Union[RawAssignment, RawTest, RawRecurring], Field(discriminator="type")]

  class RawExtraction(BaseModel):
      course: str
      timezone: str = "America/Toronto"
      events: list[RawEvent]

  def parse_pdf(data: bytes) -> str: ...          # pdfplumber, flatten tables to "cell | cell" rows
  def extract_events(text: str) -> RawExtraction: ...  # Claude structured output -> validated model

  @app.post("/extract")
  async def extract(file: UploadFile) -> RawExtraction: ...
  ```
- **Subtasks:**
  - [ ] Port `salvage/parse.py`'s pdfplumber logic into `parse_pdf` (open from bytes via `io.BytesIO`, concatenate `page.extract_text()` and flattened `page.extract_tables()`).
  - [ ] Port the prompt string from `salvage/extractor.js` into a module constant. Keep the 5 event types and the strict rules.
  - [ ] In `extract_events`, call Claude with **structured outputs** (`output_config.format` built from `RawExtraction.model_json_schema()`, or `client.messages.parse(...)`), model `claude-haiku-4-5`, `max_tokens` ~16000. This replaces the old fence-stripping — the SDK returns schema-valid JSON.
  - [ ] Wire `extract`: read the upload → `parse_pdf` → `extract_events` → return the model. Raise `HTTPException(400)` on empty/garbled text, `HTTPException(502)` on Claude errors.
  - [ ] Add `python-multipart` (already in requirements) so `UploadFile` works.
- **Tests** (pytest, `tests/test_extract.py`, using the §8 fixture text):

  | Test | Input | Expected |
  |---|---|---|
  | parse flattens tables | a 1-page PDF with a table | output string contains `" | "`-joined cells |
  | schema validates | §8 fixture raw JSON | `RawExtraction(**json)` succeeds |
  | discriminator routes | an event with `type:"lecture"` | parsed as `RawRecurring` |
  | bad type rejected | event with `type:"quiz"` | `ValidationError` |
- **Done when:** `extract_events(FIXTURE_TEXT)` returns a `RawExtraction` whose events match §8 at ≥90% of fields; pytest green.

#### Story 2.2 — Test with real PDFs & deploy
- **Goal:** the endpoint works on real syllabi and is live.
- **Estimate:** 2.5h · **Depends on:** 2.1
- **Files:** none new
- **Subtasks:**
  - [ ] Drop 2–3 of your own syllabus PDFs into a scratch folder (not committed). Run the service locally (`uvicorn api.index:app --port 8000`, or the container) and `curl -F file=@syllabus.pdf localhost:8000/extract`.
  - [ ] Eyeball the JSON; note which fields the LLM gets wrong (feeds the §10 accuracy metric and prompt tweaks).
  - [ ] Commit + push; Render auto-rebuilds the image; `curl -F file=@syllabus.pdf <render-url>/extract`.
- **Tests:**

  | Test | Input | Expected |
  |---|---|---|
  | real pdf local | `curl -F file=@real.pdf` (uvicorn/container on :8000) | `200`, JSON with ≥1 event |
  | real pdf prod | same against the Render URL | `200`, JSON with ≥1 event |
- **Done when:** the deployed endpoint returns valid extraction JSON for a real syllabus. **Delete `salvage/` after this story.**

---

### Day 3 — BFF, types & normalization · **~7h**

> **Deliverable:** `POST /api/extract` (the TypeScript Route Handler) accepts a PDF,
> calls the Python service, and returns the normalized camelCase `ExtractionResult`;
> the pure-function unit tests are green.

#### Story 3.1 — The data model
- **Goal:** the shared TypeScript types compile.
- **Estimate:** 1.5h · **Depends on:** nothing
- **Files:** `lib/types.ts`
- **Signatures:**
  ```ts
  export type Weekday = "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday";
  export type EventType = "lecture"|"tutorial"|"lab"|"assignment"|"test";

  export interface BaseEvent { id: string; type: EventType; title: string; }
  export interface RecurringEvent extends BaseEvent {
    type: "lecture"|"tutorial"|"lab";
    days: Weekday[]; startTime: string; endTime: string;
    startDate: string; endDate: string;
  }
  export interface AssignmentEvent extends BaseEvent {
    type: "assignment"; date: string; time?: string;
  }
  export interface TestEvent extends BaseEvent {
    type: "test"; date: string; startTime: string; endTime?: string;
  }
  export type SyllabusEvent = RecurringEvent | AssignmentEvent | TestEvent;
  export interface ExtractionResult { course: string; timezone: string; events: SyllabusEvent[]; }

  export type ApiResponse<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };
  ```
- **Subtasks:**
  - [ ] Type the above into `lib/types.ts`.
  - [ ] Write a throwaway `const e: SyllabusEvent = {...}` for each variant and confirm the discriminated union narrows on `type`.
- **Tests:** `tsc --noEmit` is the test — it must pass.
- **Done when:** the file compiles and switching on `event.type` narrows correctly.

#### Story 3.2 — The normalizer
- **Goal:** convert raw snake_case extraction into the camelCase model (24h times, lowercase weekdays, ids).
- **Estimate:** 3h · **Depends on:** 3.1
- **Files:** `lib/normalize.ts`, `lib/normalize.test.ts`
- **Signatures:**
  ```ts
  import type { ExtractionResult, Weekday } from "@/lib/types";

  export interface RawEvent { type: string; title?: string;
    due_date?: string; due_time?: string;
    start_time?: string; end_time?: string;
    days?: string[]; start_date?: string; end_date?: string; }
  export interface RawExtraction { course: string; timezone: string; events: RawEvent[]; }

  export function normalizeTime(raw: string): string;         // "11:59 PM" -> "23:59"
  export function normalizeWeekday(raw: string): Weekday;      // "Tuesday" -> "tuesday"
  export function normalizeExtraction(raw: RawExtraction): ExtractionResult;  // + assigns crypto.randomUUID() ids
  ```
- **Subtasks:**
  - [ ] Write `normalize.test.ts` first (tables below), watch it fail.
  - [ ] Implement `normalizeTime` (parse `HH:MM AM/PM`, handle 12 AM→00, 12 PM→12, single-digit hours).
  - [ ] Implement `normalizeWeekday` (case-insensitive full names; throw `RangeError` on unknown).
  - [ ] Implement `normalizeExtraction`: map each raw event to its typed variant, convert times/weekdays, default a missing recurring `title` to its capitalized type (`"Lecture"`), assign `id`.
- **Tests:**

  | Function | Input | Expected |
  |---|---|---|
  | normalizeTime | `"11:59 PM"` | `"23:59"` |
  | normalizeTime | `"12:00 AM"` | `"00:00"` |
  | normalizeTime | `"12:00 PM"` | `"12:00"` |
  | normalizeTime | `"05:15 PM"` | `"17:15"` |
  | normalizeTime | `"9:00 AM"` | `"09:00"` |
  | normalizeWeekday | `"Tuesday"` | `"tuesday"` |
  | normalizeWeekday | `"SUNDAY"` | `"sunday"` |
  | normalizeWeekday | `"Funday"` | throws `RangeError` |
  | normalizeExtraction | §8 raw fixture | §8 normalized fixture (ignoring `id` values) |
- **Done when:** every row passes; each normalized event has a non-empty `id`.

#### Story 3.3 — The Route Handler (BFF)
- **Goal:** `/api/extract` validates the upload, calls the Python service, normalizes, returns the envelope.
- **Estimate:** 2.5h · **Depends on:** 3.2, 2.1
- **Files:** `app/api/extract/route.ts`
- **Signatures:**
  ```ts
  export const runtime = "nodejs";
  export async function POST(request: Request): Promise<Response>;  // returns ApiResponse<ExtractionResult> as JSON
  ```
- **Subtasks:**
  - [ ] Read `request.formData()`, get the `file`. Validate: exists, `type === "application/pdf"`, size ≤ 10 MB. On failure return `{ ok:false, error:{ code:"BAD_FILE", ... } }` with `400`.
  - [ ] Forward the file (as multipart) to `${process.env.EXTRACT_SERVICE_URL}/extract` (the Render URL in prod, `http://127.0.0.1:8000` in local dev).
  - [ ] On upstream non-2xx return `UPSTREAM_DOWN` / `502`; on 2xx parse JSON as `RawExtraction`, run `normalizeExtraction`, return `{ ok:true, data }`.
  - [ ] Wrap everything in try/catch; never leak the API key or a stack trace.
- **Tests** (Vitest with a mocked upstream `fetch`):

  | Test | Input | Expected |
  |---|---|---|
  | rejects non-pdf | `.png` file | `400`, `code:"BAD_FILE"` |
  | rejects >10MB | oversized pdf | `400`, `code:"BAD_FILE"` |
  | happy path | pdf + mocked upstream = §8 raw | `200`, `ok:true`, normalized data |
  | upstream 500 | mocked upstream 500 | `502`, `code:"UPSTREAM_DOWN"` |
- **Done when:** all four tests pass; `curl -F file=@real.pdf localhost:3000/api/extract` returns the normalized envelope end-to-end.

### Day 4 — Upload step · **~6h**

> **Deliverable:** the user can drop a PDF on the home page, see a loading state, and
> land on `/review` with the real extracted events held in context.

#### Story 4.1 — Context + step routing + guards
- **Goal:** an in-memory store for the extraction result, shared across the 3 route steps, with guards that bounce you back to `/` if there's no data.
- **Estimate:** 2h · **Depends on:** 3.1
- **Files:** `context/SyllabusProvider.tsx`, edits to `app/layout.tsx`
- **Signatures:**
  ```ts
  import type { ExtractionResult, SyllabusEvent, EventType } from "@/lib/types";

  interface SyllabusContextValue {
    result: ExtractionResult | null;
    setResult: (r: ExtractionResult | null) => void;
    updateEvent: (id: string, patch: Partial<SyllabusEvent>) => void;
    deleteEvent: (id: string) => void;
    addEvent: (type: EventType) => void;   // appends a blank event of that type
  }
  export function SyllabusProvider(props: { children: React.ReactNode }): React.JSX.Element;
  export function useSyllabus(): SyllabusContextValue;  // throws if used outside the provider
  ```
- **Subtasks:**
  - [ ] Build the provider around `useState<ExtractionResult | null>`. Implement `updateEvent`/`deleteEvent`/`addEvent` as immutable updates on `result.events`.
  - [ ] Wrap `{children}` in `app/layout.tsx` with `<SyllabusProvider>` (mark the provider `"use client"`).
  - [ ] Add a small guard hook or inline check the `/review` and `/export` pages use: if `result === null`, `redirect("/")` (or `useRouter().replace`).
- **Tests** (Vitest + Testing Library):

  | Test | Input | Expected |
  |---|---|---|
  | useSyllabus outside provider | render a consumer alone | throws |
  | deleteEvent | seed 3 events, delete middle id | 2 events, correct one gone |
  | updateEvent | patch a title by id | that event's title changes, others untouched |
  | addEvent | `addEvent("assignment")` | events length +1, new blank assignment with an id |
- **Done when:** the four tests pass; guards redirect when context is empty.

#### Story 4.2 — Upload UI wired to the BFF
- **Goal:** a dropzone that uploads to `/api/extract`, shows loading/error toasts, stores the result, and navigates to `/review`.
- **Estimate:** 4h · **Depends on:** 4.1, 3.3
- **Files:** `components/UploadDropzone.tsx`, `components/StepIndicator.tsx`, `lib/api.ts`, `app/page.tsx`
- **Signatures:**
  ```ts
  // lib/api.ts
  export async function extractSyllabus(file: File): Promise<ExtractionResult>;  // throws Error on ok:false

  // components/StepIndicator.tsx
  export function StepIndicator(props: { current: 1 | 2 | 3 }): React.JSX.Element;

  // components/UploadDropzone.tsx
  export function UploadDropzone(props: { onExtracted: (r: ExtractionResult) => void }): React.JSX.Element;
  ```
- **Subtasks:**
  - [ ] `npm i react-dropzone react-hot-toast`. Add `<Toaster>` to `app/layout.tsx`.
  - [ ] `lib/api.ts`: POST a `FormData` with the file to `/api/extract`; on `ok:false` throw `new Error(error.message)`; else return `data`.
  - [ ] `UploadDropzone`: `useDropzone({ accept: {"application/pdf": [".pdf"]}, maxSize: 10MB, multiple: false })`; on drop set a `loading` state, call `extractSyllabus`, call `onExtracted`, catch → `toast.error`.
  - [ ] `StepIndicator`: three labeled steps, the `current` one highlighted (Tailwind).
  - [ ] `app/page.tsx` (client): render `StepIndicator current={1}` + `UploadDropzone`; `onExtracted` = `setResult(r)` then `router.push("/review")`.
- **Tests** (Testing Library, mock `extractSyllabus`):

  | Test | Input | Expected |
  |---|---|---|
  | shows dropzone | render page | dropzone + "step 1" visible |
  | loading state | drop a file (mock pending) | a spinner/"Extracting…" appears |
  | success navigates | mock resolves | `onExtracted` called with the result |
  | error toasts | mock rejects | `toast.error` called, no navigation |
- **Done when:** dropping a real PDF on the deployed site extracts and lands you on `/review` with data; rejects non-PDF and >10MB with a toast. **Deploy.**

---

### Day 5 — Review & correct table · **~7h**

> **Deliverable:** an editable TanStack table — edit any field, delete a row, add a row —
> grouped by event type; corrections persist in context and flow to export.

#### Story 5.1 — Editable events table
- **Goal:** a TanStack React Table that renders events of one type with inline-editable cells and per-row delete, writing changes back through context.
- **Estimate:** 5h · **Depends on:** 4.1
- **Files:** `components/EventsTable.tsx`
- **Signatures:**
  ```ts
  import type { SyllabusEvent, EventType } from "@/lib/types";
  export function EventsTable(props: { type: EventType; events: SyllabusEvent[] }): React.JSX.Element;
  // internal: uses useReactTable with a meta = { updateEvent, deleteEvent } from useSyllabus()
  ```
- **Subtasks:**
  - [ ] `npm i @tanstack/react-table lucide-react`.
  - [ ] Define columns per `type` (assignment: title/date/time; test: title/date/start/end; recurring: title/days/start/end/startDate/endDate) — derive column keys from the event shape, mirroring the old `ReviewStep.jsx` approach but typed.
  - [ ] Editable cell: a controlled `<input>` whose `onBlur`/`onChange` calls `table.options.meta.updateEvent(id, patch)`. Put `updateEvent`/`deleteEvent` on `meta` from `useSyllabus()`.
  - [ ] A trash icon (`lucide-react`) per row → `deleteEvent(id)`. An "Add row" button → `addEvent(type)`.
  - [ ] Light validation: mark a date/time cell red (Tailwind) if it doesn't match `YYYY-MM-DD` / `HH:mm`.
- **Tests** (Testing Library):

  | Test | Input | Expected |
  |---|---|---|
  | renders rows | 2 assignments | 2 body rows |
  | edit writes back | type in a title cell, blur | `updateEvent` called with `{title}` |
  | delete removes | click trash on row 1 | `deleteEvent` called with row 1's id |
  | add appends | click "Add row" | `addEvent(type)` called |
  | invalid date flagged | set date `"2025/09/25"` | cell gets the error class |
- **Done when:** editing/adding/deleting a row changes the table and the underlying context state.
- **⚠ Uncertain:** TanStack's editable-cell `meta` pattern trips people up. **Fallback:** if it fights you, skip TanStack's cell machinery and render a plain `<table>` with one controlled `<input>` per cell bound directly to context. You still satisfy "review and correct"; you lose the TanStack learning for this table (acceptable — you can revisit).

#### Story 5.2 — Review page
- **Goal:** compose the review step — events grouped by type, counts, and a guarded "Continue to export".
- **Estimate:** 2h · **Depends on:** 5.1, 4.1
- **Files:** `app/review/page.tsx`
- **Signatures:** none new (composition)
- **Subtasks:**
  - [ ] Client page: guard (redirect to `/` if `result` is null). Read `result` from `useSyllabus()`.
  - [ ] Group `result.events` by `type` in the order `lecture, tutorial, lab, assignment, test` (port the `typeOrder` sort from the old `ReviewStep.jsx`). Render `StepIndicator current={2}`, a `"Found N events in {course}"` line, and one `<EventsTable>` per non-empty group.
  - [ ] A "Continue to export" button → `router.push("/export")`.
- **Tests** (Testing Library):

  | Test | Input | Expected |
  |---|---|---|
  | groups render | seed 1 of each type | a table section per type, in order |
  | count shown | 3 events, course PSY100 | "Found 3 events in PSY100" |
  | guard | render with null context | redirect to `/` |
- **Done when:** the review page shows grouped, editable tables and the corrected state carries to `/export`. **Deploy.**

### Day 6 — `.ics` export · **~6h**

> **Deliverable:** the user downloads a valid `.ics` that imports into Google/Apple
> Calendar with the correct events and weekly recurrence.

#### Story 6.1 — The `.ics` generator
- **Goal:** a pure function turning an `ExtractionResult` into an RFC 5545 VCALENDAR string, with `RRULE` for recurring classes.
- **Estimate:** 4h · **Depends on:** 3.1
- **Files:** `lib/ics.ts`, `lib/ics.test.ts`
- **Signatures:**
  ```ts
  import type { ExtractionResult, Weekday } from "@/lib/types";

  export function escapeICSText(text: string): string;                 // "Essay, Part 1" -> "Essay\\, Part 1"
  export function weekdaysToByDay(days: Weekday[]): string;            // ["tuesday","thursday"] -> "TU,TH"
  export function firstOccurrenceOnOrAfter(startDate: string, days: Weekday[]): string; // "YYYY-MM-DD"
  export function buildICS(result: ExtractionResult, opts?: { dtstamp?: string }): string; // \r\n-joined VCALENDAR
  ```
- **Subtasks:**
  - [ ] Write `ics.test.ts` first against the §8 expected lines, `dtstamp` injected as `"20250815T120000"`.
  - [ ] `escapeICSText`: escape `\`, `;`, `,`, and newlines per RFC 5545 3.3.11.
  - [ ] `weekdaysToByDay`: map each weekday to its 2-letter code.
  - [ ] `firstOccurrenceOnOrAfter`: from `startDate`, return the first date whose weekday is in `days`.
  - [ ] `buildICS`: VCALENDAR header (`VERSION:2.0`, `PRODID`, `CALSCALE`, `X-WR-CALNAME:{course}`, `X-WR-TIMEZONE:{timezone}`); one VEVENT per event (`UID:{id}@syllabus-calendar`, `DTSTAMP`, `SUMMARY`, `DTSTART`/`DTEND` in **floating local** `YYYYMMDDTHHMMSS`). Recurring events: `DTSTART` = `firstOccurrenceOnOrAfter`, plus `RRULE:FREQ=WEEKLY;BYDAY=...;UNTIL={endDate}T235959`. Assignments with no `time`: all-day (`DTSTART;VALUE=DATE`). Join all lines with `\r\n`.
- **Tests** (see §8 for the full expected block):

  | Function | Input | Expected |
  |---|---|---|
  | weekdaysToByDay | `["tuesday","thursday"]` | `"TU,TH"` |
  | weekdaysToByDay | `["monday","wednesday","friday"]` | `"MO,WE,FR"` |
  | escapeICSText | `"Essay, Part 1"` | `"Essay\\, Part 1"` |
  | firstOccurrenceOnOrAfter | `("2025-09-01",["tuesday","thursday"])` | `"2025-09-02"` |
  | buildICS assignment | fixture Problem Set 1 | `DTSTART:20250925T235900` line present |
  | buildICS test event | fixture Term Test 1 | `DTSTART:20251009T171500` + `DTEND:20251009T184500` |
  | buildICS lecture | fixture Lecture | `RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20251127T235959` |
  | buildICS wrapper | full fixture | starts `BEGIN:VCALENDAR`, ends `END:VCALENDAR` |
- **Done when:** all rows pass, and the output imports cleanly into Google Calendar (do a manual import once).

#### Story 6.2 — Export page & download
- **Goal:** a page that builds the `.ics` from the corrected context and downloads it.
- **Estimate:** 2h · **Depends on:** 6.1, 4.1
- **Files:** `app/export/page.tsx`
- **Signatures:** none new
- **Subtasks:**
  - [ ] Client page: guard (redirect if `result` null). `StepIndicator current={3}`, a short summary (`"N events ready to export"`).
  - [ ] "Download .ics" button: `buildICS(result)` → `new Blob([ics], {type:"text/calendar"})` → object URL → click a hidden `<a download="{course}.ics">` → revoke the URL.
  - [ ] A "Back to review" link.
- **Tests** (Testing Library):

  | Test | Input | Expected |
  |---|---|---|
  | guard | null context | redirect to `/` |
  | summary count | 3 events | "3 events" shown |
  | download wires up | click download (mock `URL.createObjectURL`) | called once; anchor has `download` attr |
- **Done when:** clicking download saves a `{course}.ics` that opens in a calendar app with correct events. **Deploy.**

---

### Day 7 — Polish, README, final deploy, metrics · **~5h**

> **Deliverable:** a polished, responsive, accessible app on the public URL, a README,
> and the §10 metrics recorded. Buffer day — absorbs any slippage from Days 1–6.

#### Story 7.1 — Polish pass
- **Goal:** the app looks and behaves like a finished product.
- **Estimate:** 2.5h · **Depends on:** all prior
- **Files:** touch-ups across `app/*`, `components/*`, `app/globals.css`
- **Subtasks:**
  - [ ] Empty/loading/error states everywhere (upload pending, extraction failure, empty result → "No events found, try another PDF").
  - [ ] Responsive: tables scroll horizontally on mobile (`overflow-x-auto`); the page never scrolls sideways.
  - [ ] Accessibility: labels on inputs, focus-visible rings, buttons are real `<button>`s, the dropzone is keyboard-reachable.
  - [ ] Consistent spacing/typography; polish `StepIndicator`.
- **Tests:**

  | Test | Input | Expected |
  |---|---|---|
  | mobile layout | 375px viewport | no horizontal page scroll; tables scroll internally |
  | empty result | result with 0 events | friendly empty state, not a blank table |
  | keyboard | tab through upload → review | all controls reachable, visible focus |
- **Done when:** the three checks pass on the deployed site.

#### Story 7.2 — README, env template, final deploy, metrics
- **Goal:** the repo is presentable and the résumé metrics are captured.
- **Estimate:** 2.5h · **Depends on:** 7.1
- **Files:** `README.md`, `.env.example` (confirm)
- **Subtasks:**
  - [ ] `README.md`: one-paragraph pitch, the architecture diagram (browser → Route Handler → FastAPI → Claude), local-dev steps, deploy steps, and 2–3 screenshots/GIF.
  - [ ] Confirm `.env.example` is committed and `.env.local` is not.
  - [ ] Final deploy; click through the whole flow on the public URL.
  - [ ] Fill in the §10 metrics table (accuracy on the fixture, test count, Lighthouse, cold-start latency, hand-written LOC).
- **Tests:**

  | Test | Input | Expected |
  |---|---|---|
  | fresh clone runs | clone, then `npm i` + `npm run dev` (frontend) and `docker run` (API) following README only | both boot without extra guesswork |
  | full flow prod | upload → correct → export on the URL | downloads a correct `.ics` |
- **Done when:** a stranger could clone, run, and understand the app from the README alone; metrics recorded.

## 7. Phase 2 (post-week-1) — OAuth calendar sync

Clearly separate from the 7 days. Note up front: **Phase 2 reintroduces persistence.**
Storing OAuth refresh tokens and preventing duplicate imports both require a datastore —
so Phase 2 is where Supabase (or Vercel Postgres) comes back, with a real reason. Do not
attempt any of this in week 1.

#### Story P2.1 — Google Calendar OAuth + push
- **Goal:** sign in with Google, push the corrected events straight into the user's Google Calendar (instead of downloading `.ics`).
- **Estimate:** ~8h · **Depends on:** week 1 complete + a datastore
- **Files:** `app/api/auth/google/route.ts`, `app/api/calendar/google/route.ts`, `lib/google.ts`, a `tokens` table
- **Signatures:**
  ```ts
  export async function GET(request: Request): Promise<Response>;   // OAuth start + callback
  export function eventToGoogle(e: SyllabusEvent, tz: string): GoogleEventInput;  // maps to Google's event shape
  export async function pushEvents(userId: string, result: ExtractionResult): Promise<{ created: number }>;
  ```
- **Subtasks:**
  - [ ] Register a Google Cloud OAuth client (Calendar scope `calendar.events`).
  - [ ] OAuth authorization-code flow; store `access_token` + `refresh_token` in the datastore keyed by user.
  - [ ] Refresh on expiry; map each event type to Google's `events.insert` shape (recurring → `recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=..."]`).
- **Tests:**

  | Test | Input | Expected |
  |---|---|---|
  | eventToGoogle lecture | fixture Lecture | `recurrence` contains the RRULE |
  | eventToGoogle assignment | fixture Problem Set 1 | single-day event, correct start |
  | refresh | expired access token | a new access token is fetched |
- **Done when:** a signed-in user's corrected events appear in their Google Calendar.

#### Story P2.2 — Microsoft Graph OAuth + push
- **Goal:** the same for Outlook via Microsoft Graph.
- **Estimate:** ~6h · **Depends on:** P2.1 (shared token storage + mapping pattern)
- **Signatures:** `eventToGraph(e, tz): GraphEventInput`, `pushEventsGraph(userId, result)`.
- **Done when:** events appear in the user's Outlook calendar.

#### Story P2.3 — Duplicate-prevention on re-import
- **Goal:** re-importing the same syllabus doesn't create duplicates.
- **Estimate:** ~5h · **Depends on:** P2.1
- **Signatures:**
  ```ts
  export function eventFingerprint(e: SyllabusEvent): string;   // stable hash of type+title+date(s)+times
  export async function pushNew(userId: string, result: ExtractionResult): Promise<{ created: number; skipped: number }>;
  ```
- **Subtasks:**
  - [ ] `eventFingerprint`: deterministic hash of the identifying fields.
  - [ ] Persist `(userId, fingerprint, providerEventId)`; on push, skip fingerprints already present.
- **Tests:**

  | Test | Input | Expected |
  |---|---|---|
  | fingerprint stable | same event twice | identical hash |
  | fingerprint distinct | two different events | different hashes |
  | pushNew skips dupes | import fixture twice | second run `created:0, skipped:N` |
- **Done when:** importing the same syllabus twice creates events once.

---

## 8. Standard test fixtures

Reuse this one fixture across the normalizer and `.ics` tests. Put the raw JSON and
expected values in a shared test file (e.g. `lib/__fixtures__/psy100.ts`).

**Fixture syllabus content (paraphrase — feed as text to `extract_events` in tests):**

```
PSY100 — Introduction to Psychology, Fall 2025. Time zone: America/Toronto.
Lectures: Tuesdays and Thursdays, 11:00 AM–1:00 PM, Sept 2 to Nov 27, 2025.
Problem Set 1 due September 25, 2025 at 11:59 PM.
Term Test 1: October 9, 2025, 5:15 PM–6:45 PM.
```

**Raw extraction (snake_case — what FastAPI/the LLM returns):**

```json
{
  "course": "PSY100",
  "timezone": "America/Toronto",
  "events": [
    { "type": "assignment", "title": "Problem Set 1", "due_date": "2025-09-25", "due_time": "11:59 PM" },
    { "type": "test", "title": "Term Test 1", "due_date": "2025-10-09", "start_time": "05:15 PM", "end_time": "06:45 PM" },
    { "type": "lecture", "days": ["Tuesday", "Thursday"], "start_time": "11:00 AM", "end_time": "01:00 PM", "start_date": "2025-09-02", "end_date": "2025-11-27" }
  ]
}
```

**Normalized (camelCase — what `normalizeExtraction` returns; `id` values vary):**

```json
{
  "course": "PSY100",
  "timezone": "America/Toronto",
  "events": [
    { "id": "<uuid>", "type": "assignment", "title": "Problem Set 1", "date": "2025-09-25", "time": "23:59" },
    { "id": "<uuid>", "type": "test", "title": "Term Test 1", "date": "2025-10-09", "startTime": "17:15", "endTime": "18:45" },
    { "id": "<uuid>", "type": "lecture", "title": "Lecture", "days": ["tuesday","thursday"], "startTime": "11:00", "endTime": "13:00", "startDate": "2025-09-02", "endDate": "2025-11-27" }
  ]
}
```

**Expected `.ics`** (from `buildICS(normalized, { dtstamp: "20250815T120000" })`; lines joined by `\r\n`; `UID` values vary):

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//syllabus-calendar//EN
CALSCALE:GREGORIAN
X-WR-CALNAME:PSY100
X-WR-TIMEZONE:America/Toronto
BEGIN:VEVENT
UID:<id>@syllabus-calendar
DTSTAMP:20250815T120000
SUMMARY:Problem Set 1
DTSTART:20250925T235900
DTEND:20250925T235900
END:VEVENT
BEGIN:VEVENT
UID:<id>@syllabus-calendar
DTSTAMP:20250815T120000
SUMMARY:Term Test 1
DTSTART:20251009T171500
DTEND:20251009T184500
END:VEVENT
BEGIN:VEVENT
UID:<id>@syllabus-calendar
DTSTAMP:20250815T120000
SUMMARY:Lecture
DTSTART:20250902T110000
DTEND:20250902T130000
RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20251127T235959
END:VEVENT
END:VCALENDAR
```

> Note: `2025-09-02` is a Tuesday, so the lecture's `DTSTART` equals its `startDate`
> (`firstOccurrenceOnOrAfter` is the identity here). Assert on individual lines, not
> the whole blob, so varying `UID`s don't fail the test.

## 9. Reference material

Read these instead of asking an AI. Versions move fast — confirm you're on the current major.

**Next.js (App Router)**
- App Router intro & project structure — `nextjs.org/docs/app`
- Route Handlers (your BFF) — `nextjs.org/docs/app/building-your-application/routing/route-handlers`
- Layouts & the root layout — `nextjs.org/docs/app/building-your-application/routing/pages-and-layouts`
- `redirect` / `useRouter` — `nextjs.org/docs/app/api-reference/functions/redirect`

**React 19**
- Context (`createContext`, `useContext`) — `react.dev/reference/react/createContext`
- `"use client"` boundaries — `react.dev/reference/rsc/use-client`

**Tailwind CSS v4**
- Install (Next.js / PostCSS, the `@import "tailwindcss"` idiom) — `tailwindcss.com/docs/installation/framework-guides`

**FastAPI + Python in Docker on Render**
- FastAPI first steps + request files (`UploadFile`) — `fastapi.tiangolo.com/tutorial/first-steps/` and `/tutorial/request-files/`
- Uvicorn (the ASGI server the container runs) — `www.uvicorn.org`
- Pydantic v2 models & discriminated unions — `docs.pydantic.dev/latest/concepts/unions/#discriminated-unions`
- pdfplumber (`extract_text`, `extract_tables`) — `github.com/jsvine/pdfplumber`
- Dockerfile reference & best practices — `docs.docker.com/reference/dockerfile/` and `docs.docker.com/build/building/best-practices/`
- Deploy a Docker image on Render (`$PORT`, root dir, auto-deploy) — `render.com/docs/deploy-an-image` and `render.com/docs/web-services`

**Anthropic / Claude**
- Messages API overview — `platform.claude.com/docs/en/api/messages`
- Structured outputs (`output_config.format`, `messages.parse`) — `platform.claude.com/docs/en/build-with-claude/structured-outputs`
- Model: use the alias **`claude-haiku-4-5`** (right cost/latency for extraction).

**Frontend libraries**
- TanStack React Table v8 — overview `tanstack.com/table/latest/docs/introduction`; editable-data guide `tanstack.com/table/latest/docs/framework/react/examples/editable-data`
- react-dropzone — `react-dropzone.js.org`
- react-hot-toast — `react-hot-toast.com`
- lucide-react (icons) — `lucide.dev/guide/packages/lucide-react`

**iCalendar**
- RFC 5545 — VEVENT §3.6.1, RRULE §3.3.10 / §3.8.5.3, text escaping §3.3.11 — `datatracker.ietf.org/doc/html/rfc5545`

**Testing**
- Vitest — `vitest.dev/guide/`
- Testing Library (React) — `testing-library.com/docs/react-testing-library/intro`
- jest-dom matchers — `github.com/testing-library/jest-dom`

---

## 10. Progress tracker

**Stories & hours** (check off as you go):

- [ ] 1.1 Scaffold Next.js + TS + Tailwind — 3h
- [ ] 1.2 Dockerize FastAPI + deploy on Render — 3h
- [ ] 1.3 Deploy Next.js on Vercel — 1h  · _Day 1 total: 7h_
- [ ] 2.1 FastAPI parse + extract — 4h
- [ ] 2.2 Real-PDF test & deploy — 2.5h  · _Day 2 total: 6.5h_
- [ ] 3.1 Data model (`types.ts`) — 1.5h
- [ ] 3.2 Normalizer + tests — 3h
- [ ] 3.3 Route Handler (BFF) — 2.5h  · _Day 3 total: 7h_
- [ ] 4.1 Context + guards — 2h
- [ ] 4.2 Upload UI wired to BFF — 4h  · _Day 4 total: 6h_
- [ ] 5.1 Editable TanStack table — 5h
- [ ] 5.2 Review page — 2h  · _Day 5 total: 7h_
- [ ] 6.1 `.ics` generator + tests — 4h
- [ ] 6.2 Export page & download — 2h  · _Day 6 total: 6h_
- [ ] 7.1 Polish pass — 2.5h
- [ ] 7.2 README + final deploy + metrics — 2.5h  · _Day 7 total: 5h_

**Grand total ≈ 44.5h.** Tight for one week — treat Day 7 as buffer, and take the marked
fallbacks (1.2 → Render native Python, 5.1 → plain inputs) the moment a story overruns
rather than sinking the schedule.

**Metrics to record** (for the résumé bullet — capture as you finish):

| Metric | How to measure | Value |
|---|---|---|
| Extraction accuracy (fixture) | correct fields ÷ total fields on the §8 syllabus | ___ % |
| Extraction accuracy (real) | same on 3 of your own syllabi, averaged | ___ % |
| Automated tests | `vitest` + `pytest` counts | ___ |
| Event types supported | lecture / tutorial / lab / assignment / test | 5 |
| Cold-start latency | first `/extract` after idle | ___ s |
| Lighthouse (mobile) | Chrome DevTools on the deployed `/` | ___ / 100 |
| Hand-written LOC | `git diff --stat` since scaffold (exclude generated) | ___ |
| Public URL | your Vercel domain | ___ |

**Résumé bullet template:** "Built and deployed a full-stack syllabus-to-calendar app
(Next.js 15, React 19, TypeScript, Tailwind v4, FastAPI) that extracts deadlines from PDF
syllabi via the Claude API at ~__% field accuracy, with a mandatory review-and-correct
step and one-click `.ics` export; __ automated tests."
