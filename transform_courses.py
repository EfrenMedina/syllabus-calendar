"""
UofT Course Transformer — Haiku Edition
-----------------------------------------
~$2-3 total (vs ~$7 with Sonnet).

Requirements:
    pip install anthropic python-dotenv

.env:
    ANTHROPIC_API_KEY=sk-ant-...

Usage:
    python transform_courses.py
    python transform_courses.py --input courses.json --output courses_transformed.json
    python transform_courses.py --batch-size 20 --concurrency 5
"""

import json
import asyncio
import argparse
import time
from pathlib import Path
from dotenv import load_dotenv
import anthropic

load_dotenv()

# ── Prompt ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Transform each UofT course entry in the input JSON. Return only a JSON object with the same keys. No explanation, no markdown, no backticks.

For each course, output these fields:
- code: unchanged
- name: unchanged
- hours: unchanged
- description: unchanged
- credits: 0.5 if code contains "H", 1.0 if code contains "Y"
- level: first digit of the course number x 100
- department: leading letters of the course code (e.g. "CSC" from "CSC148H1")
- breadth: unchanged
- exclusions: array of course code strings parsed from the exclusions field, or null
- prereq_tree: null if no prerequisites, otherwise a BooleanList (see below)

== BooleanList schema ==
{"operator": "AND"|"OR", "items": [...]}
Items are: course code string | {"credits": N, "department": "XYZ"|null} | nested BooleanList
Rules:
- Always wrap in BooleanList even for a single item
- "/" or "or" -> OR; ","/";"/and"/"plus" outside parens -> AND
- Commas inside parens -> AND, e.g. (A, B) means both required
- Grade %s, "or equivalent", "or permission of instructor" -> ignore
- Admin-only prereqs ("consult dept", "permission of dept", "enrolled as yearN") -> prereq_tree: null
- "X.0 credits"/"Completion of X credits" -> {"credits": X, "department": null}
- "X.0 DEPT credits"/"X.0 additional DEPT credits" -> {"credits": X, "department": "DEPT"}
- "including" -> AND of the credit count and listed courses
- "First-year Calculus" -> MAT135H1/MAT136H1 or MAT137Y1; "High school math" -> null
- Never include null inside items arrays; omit unparseable conditions"""

# ── Core logic ────────────────────────────────────────────────────────────────

async def process_batch(
    client: anthropic.AsyncAnthropic,
    batch: list[tuple[str, dict]],
    semaphore: asyncio.Semaphore,
    batch_index: int,
    retries: int = 4,
) -> dict:
    batch_obj = {k: v for k, v in batch}

    async with semaphore:
        for attempt in range(1, retries + 1):
            try:
                response = await client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=8000,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": json.dumps(batch_obj)}],
                )
                raw = response.content[0].text.strip()
                if raw.startswith("```"):
                    raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw.rsplit("```", 1)[0]
                return json.loads(raw.strip())

            except anthropic.RateLimitError:
                wait = 10 * attempt
                print(f"  [batch {batch_index}] rate limited, waiting {wait}s (attempt {attempt}/{retries})")
                await asyncio.sleep(wait)

            except (json.JSONDecodeError, anthropic.APIError) as exc:
                if attempt == retries:
                    raise
                wait = 5 * attempt
                print(f"  [batch {batch_index}] error: {exc!r} — retrying in {wait}s")
                await asyncio.sleep(wait)

    raise RuntimeError(f"Batch {batch_index} failed after {retries} attempts")


async def run(input_path: str, output_path: str, batch_size: int, concurrency: int):
    print(f"\nUofT Course Transformer (Haiku)")
    print(f"  Input:       {input_path}")
    print(f"  Output:      {output_path}")
    print(f"  Batch size:  {batch_size}")
    print(f"  Concurrency: {concurrency}")
    print(f"  Model:       claude-haiku-4-5")

    with open(input_path) as f:
        courses = json.load(f)

    all_entries = list(courses.items())
    total = len(all_entries)
    batches = [all_entries[i: i + batch_size] for i in range(0, total, batch_size)]
    n_batches = len(batches)

    # Rough cost estimate (Haiku: $1/MTok input, $5/MTok output)
    est_input_mtok  = (len(SYSTEM_PROMPT) / 4 + batch_size * 600) * n_batches / 1_000_000
    est_output_mtok = batch_size * 400 * n_batches / 1_000_000
    est_cost = est_input_mtok * 1.0 + est_output_mtok * 5.0
    print(f"  Courses:     {total:,}")
    print(f"  Batches:     {n_batches}")
    print(f"  Est. cost:   ~${est_cost:.2f}\n")

    client = anthropic.AsyncAnthropic()
    semaphore = asyncio.Semaphore(concurrency)

    result: dict = {}
    failed_batches: list[int] = []
    done = 0
    start = time.time()

    async def handle_batch(idx: int, batch: list):
        nonlocal done
        first, last = batch[0][0], batch[-1][0]
        try:
            parsed = await process_batch(client, batch, semaphore, idx)
            result.update(parsed)
            done += len(batch)
            elapsed = time.time() - start
            rate = done / elapsed if elapsed else 0
            eta = (total - done) / rate if rate else 0
            pct = done / total * 100
            print(
                f"  ✓ batch {idx+1:>4}/{n_batches}  "
                f"{first}...{last}  "
                f"[{pct:5.1f}%  ETA {int(eta//60)}m{int(eta%60):02d}s]"
            )
        except Exception as exc:
            failed_batches.append(idx)
            done += len(batch)
            print(f"  ✗ batch {idx+1:>4}/{n_batches}  FAILED ({first}...{last}): {exc}")

    tasks = [handle_batch(i, b) for i, b in enumerate(batches)]
    await asyncio.gather(*tasks)

    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - start
    print(f"\nDone in {int(elapsed//60)}m{int(elapsed%60):02d}s")
    print(f"  Transformed: {len(result):,} courses -> {output_path}")
    if failed_batches:
        print(f"  Failed batches ({len(failed_batches)}): {failed_batches}")
    else:
        print(f"  All batches succeeded!")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Transform UofT courses.json via Anthropic API")
    p.add_argument("--input",       default="courses.json",             help="Input JSON file")
    p.add_argument("--output",      default="courses_transformed.json", help="Output JSON file")
    p.add_argument("--batch-size",  type=int, default=25,               help="Courses per API call (default: 25)")
    p.add_argument("--concurrency", type=int, default=3,                help="Parallel API calls (default: 3)")
    args = p.parse_args()

    asyncio.run(run(args.input, args.output, args.batch_size, args.concurrency))
