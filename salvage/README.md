# salvage/ — the only code kept from the old repo

Everything else (the Vite React frontend and the Express backend) was deleted in the
rewrite. It still exists in git history and on the `feature/frontend` and
`feature/node-backend` branches if you ever need it.

These three files are **reference material for Day 2** of `BUILD_PLAN.md`. You are
porting the *ideas* into a fresh FastAPI service — you are not importing these files.

| File | What it is | Where it goes in the rewrite |
|------|------------|------------------------------|
| `parse.py` | pdfplumber PDF→text parser that **flattens tables** to `cell \| cell` rows. Better than the deleted `pdf-parse` JS parser because syllabi are table-heavy. | Port the pdfplumber logic into `api/index.py` → `parse_pdf(data: bytes) -> str`. |
| `extractor.js` | The current Claude prompt + JSON schema (all 5 event types: lecture, tutorial, lab, assignment, test). This is the most evolved version of the prompt. | Port the prompt string into `api/index.py`; drive it with structured outputs instead of fence-stripping. |
| `extractor.py` | The original Python Claude extractor (older 3-type schema). Useful only as a Python-syntax reference for the SDK call. | Superseded by `extractor.js`'s prompt — read for the SDK call shape only. |

Your API key was preserved at repo root in `.env.local` (gitignored).

Delete this whole folder once Day 2 is done.
