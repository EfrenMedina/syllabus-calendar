require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const INSTRUCTIONS_PROMPT = `You are a structured data extractor. Your only job is to extract calendar events from university syllabus text and return a single valid JSON object.
STRICT RULES:
- Return ONLY the JSON object. No explanation, no markdown, no code fences, no preamble.
- All dates must be YYYY-MM-DD format.
- All times must be HH:MM AM/PM format (e.g. 11:59 PM).
- If timezone is not explicitly stated, use "America/Toronto".
- If a field is unknown, omit it entirely. Never guess or hallucinate.

EVENT TYPES you must extract:
- assignments (one-time, have due_date and due_time)
- tests and exams (one-time, have due_date, start_time, end_time)
- lectures (recurring, have days, start_time, end_time, recurrence_start, recurrence_end)
- tutorials (recurring, have days, start_time, end_time, recurrence_start, recurrence_end)
- labs (recurring, have days, start_time, end_time, recurrence_start, recurrence_end)


JSON SCHEMA you must follow exactly:
{
  "course": "PSY100",
  "timezone": "America/Toronto",
  "events": [
    {
      "type": "assignments",
      "title": "Problem Set 1",
      "due_date": "2025-09-25",
      "due_time": "11:59 PM"
    },
    {
      "type": "tests",
      "title": "Term Test 1",
      "due_date": "2025-10-09",
      "start_time": "05:15 PM",
      "end_time": "06:45 PM"
    },
    {
      "type": "lectures",
      // "title": "Lecture",
      "days": ["Tuesday", "Thursday"],
      "start_time": "11:00 AM",
      "end_time": "01:00 PM",
      "start_date": "2025-09-02",
      "end_date": "2025-11-27"
    }
  ]
}`;

async function extractEvents(text) {
    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: INSTRUCTIONS_PROMPT,
        messages: [{ role: 'user', content: `Extract all calendar events from this syllabus:\n\n${text}` }]
    });

    const raw = response.content[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
}

module.exports = extractEvents;
