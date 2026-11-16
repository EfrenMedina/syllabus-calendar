import type { Course, Meeting, SyllabusEvent, Weekday } from "@/lib/types";
import { WEEKDAYS } from "@/lib/types";

// Mirrors the FastAPI service's JSON exactly: snake_case, and nulls are real.
export interface RawMeeting {
  day: string;
  start_time?: string | null;
  end_time?: string | null;
}

export interface RawEvent {
  type: string;
  title?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  meetings?: RawMeeting[] | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface RawCourse {
  code: string;
  timezone?: string | null;
  events: RawEvent[];
}

const DEFAULT_TIMEZONE = "America/Toronto";

const TIME_12H = /^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/;
const TIME_24H = /^(\d{1,2}):(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "11:59 PM" -> "23:59". Already-24h input ("14:30") passes through, zero-padded.
 * Returns undefined for anything unparseable, so one bad LLM time can't sink an upload.
 */
export function normalizeTime(raw: string): string | undefined {
  const value = raw.trim();

  const twelve = TIME_12H.exec(value);
  if (twelve) {
    const hour = Number(twelve[1]);
    const minute = Number(twelve[2]);
    if (hour < 1 || hour > 12 || minute > 59) return undefined;
    const isPm = twelve[3].toLowerCase() === "p";
    const hour24 = (hour % 12) + (isPm ? 12 : 0);
    return `${pad(hour24)}:${pad(minute)}`;
  }

  const twentyFour = TIME_24H.exec(value);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour > 23 || minute > 59) return undefined;
    return `${pad(hour)}:${pad(minute)}`;
  }

  return undefined;
}

/** "Tuesday" -> "tuesday". Throws RangeError on anything that isn't a full English weekday. */
export function normalizeWeekday(raw: string): Weekday {
  const value = raw.trim().toLowerCase();
  if ((WEEKDAYS as string[]).includes(value)) return value as Weekday;
  throw new RangeError(`Unknown weekday: ${raw}`);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// null/empty -> undefined
function opt(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function optTime(value: string | null | undefined): string | undefined {
  const v = opt(value);
  return v === undefined ? undefined : normalizeTime(v);
}

// Drop keys whose value is undefined so the model has no explicit-undefined fields.
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function normalizeMeeting(raw: RawMeeting): Meeting | null {
  let day: Weekday;
  try {
    day = normalizeWeekday(raw.day);
  } catch {
    return null;
  }
  return compact({ day, startTime: optTime(raw.start_time), endTime: optTime(raw.end_time) });
}

function normalizeEvent(raw: RawEvent): SyllabusEvent | null {
  const id = crypto.randomUUID();
  const title = opt(raw.title) ?? capitalize(raw.type);

  switch (raw.type) {
    case "lecture":
    case "tutorial":
    case "lab": {
      const meetings = (raw.meetings ?? [])
        .map(normalizeMeeting)
        .filter((m): m is Meeting => m !== null);
      if (meetings.length === 0) return null;
      return compact({
        id,
        type: raw.type,
        title,
        meetings,
        startDate: opt(raw.start_date),
        endDate: opt(raw.end_date),
      });
    }
    case "assignment":
      return compact({
        id,
        type: raw.type,
        title,
        date: opt(raw.due_date),
        time: optTime(raw.due_time),
      });
    case "test":
    case "quiz":
    case "exam":
      return compact({
        id,
        type: raw.type,
        title,
        date: opt(raw.due_date),
        startTime: optTime(raw.start_time),
        endTime: optTime(raw.end_time),
      });
    default:
      return null;
  }
}

/** Raw snake_case extraction -> camelCase Course. The only place that knows snake_case. */
export function normalizeCourse(raw: RawCourse): Course {
  return {
    code: opt(raw.code) ?? "Course",
    timezone: opt(raw.timezone) ?? DEFAULT_TIMEZONE,
    events: (raw.events ?? [])
      .map(normalizeEvent)
      .filter((e): e is SyllabusEvent => e !== null),
  };
}
