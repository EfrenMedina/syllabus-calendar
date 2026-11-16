import { describe, expect, it } from "vitest";
import {
  buildICS,
  escapeICSText,
  findExportBlockers,
  firstOccurrenceOnOrAfter,
  weekdaysToByDay,
} from "@/lib/ics";
import { PSY100_NORMALIZED } from "@/lib/__fixtures__/psy100";
import type { Course } from "@/lib/types";

const DTSTAMP = "20250815T120000";
// buildICS ends every line (including the last) with CRLF, per RFC 5545.
const lines = (course: Course) =>
  buildICS(course, { dtstamp: DTSTAMP }).replace(/\r\n$/, "").split("\r\n");

// Pull each VEVENT block out as its own array of lines (UID excluded, since ids vary).
function vevents(course: Course): string[][] {
  const out: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines(course)) {
    if (line === "BEGIN:VEVENT") current = [];
    else if (line === "END:VEVENT") {
      out.push(current!);
      current = null;
    } else if (current && !line.startsWith("UID:")) current.push(line);
  }
  return out;
}

const course = (events: Course["events"]): Course => ({ code: "X", timezone: "America/Toronto", events });

describe("weekdaysToByDay", () => {
  it.each([
    [["tuesday", "thursday"], "TU,TH"],
    [["monday", "wednesday", "friday"], "MO,WE,FR"],
  ] as const)("%j -> %s", (days, expected) => {
    expect(weekdaysToByDay([...days])).toBe(expected);
  });
});

describe("escapeICSText", () => {
  it("escapes commas", () => {
    expect(escapeICSText("Essay, Part 1")).toBe("Essay\\, Part 1");
  });

  it("escapes backslashes, semicolons, and newlines", () => {
    expect(escapeICSText("a\\b;c\nd")).toBe("a\\\\b\\;c\\nd");
  });
});

describe("firstOccurrenceOnOrAfter", () => {
  it("returns the start date when it already matches", () => {
    expect(firstOccurrenceOnOrAfter("2025-09-01", ["tuesday", "thursday"])).toBe("2025-09-02");
  });

  it("is the identity when the start date is one of the days", () => {
    expect(firstOccurrenceOnOrAfter("2025-09-02", ["tuesday"])).toBe("2025-09-02");
  });

  it("rolls over a month boundary", () => {
    expect(firstOccurrenceOnOrAfter("2025-09-29", ["friday"])).toBe("2025-10-03");
  });
});

describe("buildICS", () => {
  it("matches the §8 expected calendar line for line (ignoring UIDs)", () => {
    const actual = lines(PSY100_NORMALIZED).filter((l) => !l.startsWith("UID:"));
    expect(actual).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//syllabus-calendar//EN",
      "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:PSY100",
      "X-WR-TIMEZONE:America/Toronto",
      "BEGIN:VEVENT",
      "DTSTAMP:20250815T120000",
      "SUMMARY:Problem Set 1",
      "DTSTART:20250925T235900",
      "DTEND:20250925T235900",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTAMP:20250815T120000",
      "SUMMARY:Term Test 1",
      "DTSTART:20251009T171500",
      "DTEND:20251009T184500",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTAMP:20250815T120000",
      "SUMMARY:Lecture",
      "DTSTART:20250902T110000",
      "DTEND:20250902T120000",
      "RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20251127T235959",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTAMP:20250815T120000",
      "SUMMARY:Lecture",
      "DTSTART:20250904T110000",
      "DTEND:20250904T130000",
      "RRULE:FREQ=WEEKLY;BYDAY=TH;UNTIL=20251127T235959",
      "END:VEVENT",
      "END:VCALENDAR",
    ]);
  });

  it("gives every VEVENT a unique UID", () => {
    const uids = lines(PSY100_NORMALIZED).filter((l) => l.startsWith("UID:"));
    expect(uids).toHaveLength(4);
    expect(new Set(uids).size).toBe(4);
    expect(uids.every((u) => u.endsWith("@syllabus-calendar"))).toBe(true);
  });

  it("merges meetings with the same times into one RRULE", () => {
    const [event] = vevents(
      course([
        {
          id: "l",
          type: "lecture",
          title: "Lecture",
          meetings: [
            { day: "monday", startTime: "10:00", endTime: "11:00" },
            { day: "wednesday", startTime: "10:00", endTime: "11:00" },
            { day: "friday", startTime: "10:00", endTime: "11:00" },
          ],
          startDate: "2025-09-03",
          endDate: "2025-12-05",
        },
      ]),
    );
    expect(event).toContain("DTSTART:20250903T100000");
    expect(event).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20251205T235959");
  });

  it("makes an assignment with no time an all-day event", () => {
    const [event] = vevents(course([{ id: "a", type: "assignment", title: "Essay", date: "2025-12-31" }]));
    expect(event).toContain("DTSTART;VALUE=DATE:20251231");
    expect(event).toContain("DTEND;VALUE=DATE:20260101");
  });

  it("gives an evaluation with no end time a one-hour slot", () => {
    const [event] = vevents(
      course([{ id: "q", type: "quiz", title: "Quiz 1", date: "2025-10-01", startTime: "09:30" }]),
    );
    expect(event).toContain("DTSTART:20251001T093000");
    expect(event).toContain("DTEND:20251001T103000");
  });

  it("escapes the summary", () => {
    const [event] = vevents(
      course([{ id: "a", type: "assignment", title: "Essay, Part 1", date: "2025-10-01" }]),
    );
    expect(event).toContain("SUMMARY:Essay\\, Part 1");
  });

  it("folds lines longer than 75 octets", () => {
    const title = "A".repeat(120);
    const raw = buildICS(course([{ id: "a", type: "assignment", title, date: "2025-10-01" }]), {
      dtstamp: DTSTAMP,
    });
    const physical = raw.split("\r\n");
    expect(physical.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    const unfolded = raw.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:${title}`);
  });

  it("skips events that can't become calendar entries", () => {
    expect(vevents(course([{ id: "a", type: "assignment", title: "No date" }]))).toHaveLength(0);
  });

  it("starts and ends with the calendar wrapper", () => {
    const all = lines(PSY100_NORMALIZED);
    expect(all[0]).toBe("BEGIN:VCALENDAR");
    expect(all.at(-1)).toBe("END:VCALENDAR");
  });
});

describe("findExportBlockers", () => {
  it("returns nothing for the fixture", () => {
    expect(findExportBlockers(PSY100_NORMALIZED)).toEqual([]);
  });

  it("flags an assignment with no date", () => {
    expect(findExportBlockers(course([{ id: "a", type: "assignment", title: "Essay" }]))).toEqual([
      { eventId: "a", title: "Essay", reason: "Missing a date" },
    ]);
  });

  it("flags malformed dates and times", () => {
    const blockers = findExportBlockers(
      course([{ id: "t", type: "test", title: "Midterm", date: "2025/10/01", startTime: "9am" }]),
    );
    expect(blockers.map((b) => b.reason)).toEqual(["Date isn't a valid YYYY-MM-DD", "Start time isn't a valid HH:mm"]);
  });

  it("flags a recurring class missing dates or meeting times", () => {
    const blockers = findExportBlockers(
      course([
        { id: "l", type: "lab", title: "Lab", meetings: [{ day: "friday", startTime: "14:00" }] },
      ]),
    );
    expect(blockers.map((b) => b.reason)).toEqual([
      "Missing a start date",
      "Missing an end date",
      "Friday meeting is missing an end time",
    ]);
  });

  it("flags a class whose end date is before its start date", () => {
    const blockers = findExportBlockers(
      course([
        {
          id: "l",
          type: "lecture",
          title: "Lecture",
          meetings: [{ day: "monday", startTime: "10:00", endTime: "11:00" }],
          startDate: "2025-12-01",
          endDate: "2025-09-01",
        },
      ]),
    );
    expect(blockers.map((b) => b.reason)).toEqual(["End date is before the start date"]);
  });
});
