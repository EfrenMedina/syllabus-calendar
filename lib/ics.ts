import { isValidDate, isValidTime } from "@/lib/eventStyles";
import {
  WEEKDAYS,
  isRecurring,
  type AssignmentEvent,
  type Course,
  type EvaluationEvent,
  type Meeting,
  type RecurringEvent,
  type SyllabusEvent,
  type Weekday,
} from "@/lib/types";

// RFC 5545 subset. All times are "floating" local times (no TZID, no Z): correct for a
// personal calendar in one time zone, and keeps this a pure function.

const CRLF = "\r\n";
const PRODID = "-//syllabus-calendar//EN";
const UID_DOMAIN = "syllabus-calendar";

const BYDAY: Record<Weekday, string> = {
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
  sunday: "SU",
};

/** "Essay, Part 1" -> "Essay\, Part 1" (RFC 5545 §3.3.11). */
export function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** ["tuesday","thursday"] -> "TU,TH" */
export function weekdaysToByDay(days: Weekday[]): string {
  return days.map((day) => BYDAY[day]).join(",");
}

// Date math in UTC so results never depend on the machine's time zone.
function parseDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

// Date.getUTCDay(): 0 = Sunday ... 6 = Saturday
const JS_DAY: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** The first date on or after startDate that falls on one of `days`, as "YYYY-MM-DD". */
export function firstOccurrenceOnOrAfter(startDate: string, days: Weekday[]): string {
  const wanted = new Set(days.map((day) => JS_DAY[day]));
  const date = parseDate(startDate);
  for (let i = 0; i < 7; i++) {
    if (wanted.has(date.getUTCDay())) return formatDate(date);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  throw new RangeError("firstOccurrenceOnOrAfter needs at least one weekday");
}

// "2025-09-25" -> "20250925"; with "23:59" -> "20250925T235900"
const icsDate = (date: string) => date.replace(/-/g, "");
const icsDateTime = (date: string, time: string) => `${icsDate(date)}T${time.replace(":", "")}00`;

function addOneHour(date: string, time: string): { date: string; time: string } {
  const [h, m] = time.split(":").map(Number);
  if (h < 23) return { date, time: `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
  return { date: addDays(date, 1), time: `00:${String(m).padStart(2, "0")}` };
}

// Events missing a date (or a recurring event missing dates/times) cannot become VEVENTs.
// Report them so the UI can block export until the user fills them in.
export interface ExportBlocker {
  eventId: string;
  title: string;
  reason: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function dateProblem(date: string | undefined, label: string, article = "a"): string | null {
  if (!date) return `Missing ${article} ${label.toLowerCase()}`;
  if (!isValidDate(date)) return `${capitalize(label)} isn't a valid YYYY-MM-DD`;
  return null;
}

function timeProblem(time: string | undefined, label: string): string | null {
  if (time !== undefined && !isValidTime(time)) return `${label} isn't a valid HH:mm`;
  return null;
}

function eventProblems(event: SyllabusEvent): string[] {
  const problems: (string | null)[] = [];

  if (isRecurring(event)) {
    problems.push(dateProblem(event.startDate, "start date"));
    problems.push(dateProblem(event.endDate, "end date", "an"));
    if (
      event.startDate &&
      event.endDate &&
      isValidDate(event.startDate) &&
      isValidDate(event.endDate) &&
      event.endDate < event.startDate
    ) {
      problems.push("End date is before the start date");
    }
    if (event.meetings.length === 0) problems.push("Needs at least one meeting");
    for (const meeting of event.meetings) {
      const day = capitalize(meeting.day);
      if (!meeting.startTime) problems.push(`${day} meeting is missing a start time`);
      else problems.push(timeProblem(meeting.startTime, `${day} start time`));
      if (!meeting.endTime) problems.push(`${day} meeting is missing an end time`);
      else problems.push(timeProblem(meeting.endTime, `${day} end time`));
    }
  } else if (event.type === "assignment") {
    problems.push(dateProblem(event.date, "date"));
    problems.push(timeProblem(event.time, "Time"));
  } else {
    problems.push(dateProblem(event.date, "date"));
    problems.push(timeProblem(event.startTime, "Start time"));
    problems.push(timeProblem(event.endTime, "End time"));
    if (event.endTime && !event.startTime) problems.push("Has an end time but no start time");
  }

  return problems.filter((p): p is string => p !== null);
}

export function findExportBlockers(course: Course): ExportBlocker[] {
  return course.events.flatMap((event) =>
    eventProblems(event).map((reason) => ({ eventId: event.id, title: event.title, reason })),
  );
}

// Fold content lines at 75 octets (RFC 5545 §3.1), never splitting a multi-byte character.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74; // continuation lines start with a space
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

interface VEvent {
  uid: string;
  summary: string;
  start: string; // already-formatted property tail, e.g. ":20250925T235900" or ";VALUE=DATE:20250925"
  end: string;
  rrule?: string;
}

function summaryFor(event: SyllabusEvent): string {
  return event.title.trim() || capitalize(event.type);
}

function assignmentVEvent(event: AssignmentEvent): VEvent | null {
  if (!event.date) return null;
  const base = { uid: event.id, summary: summaryFor(event) };
  if (!event.time) {
    return { ...base, start: `;VALUE=DATE:${icsDate(event.date)}`, end: `;VALUE=DATE:${icsDate(addDays(event.date, 1))}` };
  }
  const at = `:${icsDateTime(event.date, event.time)}`;
  return { ...base, start: at, end: at };
}

function evaluationVEvent(event: EvaluationEvent): VEvent | null {
  if (!event.date) return null;
  const base = { uid: event.id, summary: summaryFor(event) };
  if (!event.startTime) {
    return { ...base, start: `;VALUE=DATE:${icsDate(event.date)}`, end: `;VALUE=DATE:${icsDate(addDays(event.date, 1))}` };
  }
  const end = event.endTime
    ? { date: event.date, time: event.endTime }
    : addOneHour(event.date, event.startTime);
  return {
    ...base,
    start: `:${icsDateTime(event.date, event.startTime)}`,
    end: `:${icsDateTime(end.date, end.time)}`,
  };
}

// One RRULE can only carry one start/end time, so group meetings with identical times.
function groupMeetings(meetings: Meeting[]): { startTime: string; endTime: string; days: Weekday[] }[] {
  const groups = new Map<string, { startTime: string; endTime: string; days: Weekday[] }>();
  for (const m of meetings) {
    if (!m.startTime || !m.endTime) continue;
    const key = `${m.startTime}-${m.endTime}`;
    const group = groups.get(key) ?? { startTime: m.startTime, endTime: m.endTime, days: [] };
    if (!group.days.includes(m.day)) group.days.push(m.day);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.days.sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
  }
  return [...groups.values()];
}

function recurringVEvents(event: RecurringEvent): VEvent[] {
  if (!event.startDate || !event.endDate) return [];
  const groups = groupMeetings(event.meetings);
  return groups.flatMap((group, i) => {
    const first = firstOccurrenceOnOrAfter(event.startDate!, group.days);
    if (first > event.endDate!) return [];
    return [
      {
        uid: groups.length > 1 ? `${event.id}-${i + 1}` : event.id,
        summary: summaryFor(event),
        start: `:${icsDateTime(first, group.startTime)}`,
        end: `:${icsDateTime(first, group.endTime)}`,
        rrule: `FREQ=WEEKLY;BYDAY=${weekdaysToByDay(group.days)};UNTIL=${icsDate(event.endDate!)}T235959`,
      },
    ];
  });
}

function toVEvents(event: SyllabusEvent): VEvent[] {
  // Anything findExportBlockers would flag is skipped rather than emitted half-broken.
  if (eventProblems(event).length > 0) return [];
  if (isRecurring(event)) return recurringVEvents(event);
  const vevent = event.type === "assignment" ? assignmentVEvent(event) : evaluationVEvent(event);
  return vevent ? [vevent] : [];
}

function nowStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Course -> RFC 5545 VCALENDAR string, lines joined with CRLF. */
export function buildICS(course: Course, opts?: { dtstamp?: string }): string {
  const dtstamp = opts?.dtstamp ?? nowStamp();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeICSText(course.code)}`,
    `X-WR-TIMEZONE:${course.timezone}`,
  ];

  for (const vevent of course.events.flatMap(toVEvents)) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${vevent.uid}@${UID_DOMAIN}`,
      `DTSTAMP:${dtstamp}`,
      `SUMMARY:${escapeICSText(vevent.summary)}`,
      `DTSTART${vevent.start}`,
      `DTEND${vevent.end}`,
    );
    if (vevent.rrule) lines.push(`RRULE:${vevent.rrule}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
