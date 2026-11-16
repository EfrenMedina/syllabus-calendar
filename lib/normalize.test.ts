import { describe, expect, it } from "vitest";
import { normalizeCourse, normalizeTime, normalizeWeekday } from "@/lib/normalize";
import { PSY100_NORMALIZED, PSY100_RAW } from "@/lib/__fixtures__/psy100";
import type { Course } from "@/lib/types";

describe("normalizeTime", () => {
  it.each([
    ["11:59 PM", "23:59"],
    ["12:00 AM", "00:00"],
    ["12:00 PM", "12:00"],
    ["05:15 PM", "17:15"],
    ["9:00 AM", "09:00"],
    ["9:00am", "09:00"],
    ["14:30", "14:30"],
    ["7:05", "07:05"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeTime(input)).toBe(expected);
  });

  it.each(["noon", "25:00", "13:00 PM", "", "11:60 AM"])("returns undefined for %j", (input) => {
    expect(normalizeTime(input)).toBeUndefined();
  });
});

describe("normalizeWeekday", () => {
  it("lowercases a full name", () => {
    expect(normalizeWeekday("Tuesday")).toBe("tuesday");
  });

  it("handles all caps", () => {
    expect(normalizeWeekday("SUNDAY")).toBe("sunday");
  });

  it("throws RangeError on unknown day", () => {
    expect(() => normalizeWeekday("Funday")).toThrow(RangeError);
  });
});

function withoutIds(course: Course) {
  return {
    ...course,
    events: course.events.map((event) => {
      const copy: Partial<typeof event> = { ...event };
      delete copy.id;
      return copy;
    }),
  };
}

describe("normalizeCourse", () => {
  it("matches the §8 normalized fixture (ignoring ids)", () => {
    expect(withoutIds(normalizeCourse(PSY100_RAW))).toEqual(withoutIds(PSY100_NORMALIZED));
  });

  it("assigns a unique non-empty id to every event", () => {
    const ids = normalizeCourse(PSY100_RAW).events.map((e) => e.id);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("converts nulls to undefined and defaults title and timezone", () => {
    const course = normalizeCourse({
      code: "MAT137",
      timezone: null,
      events: [{ type: "exam", title: null, due_date: null, start_time: null, end_time: null }],
    });
    expect(course.timezone).toBe("America/Toronto");
    expect(withoutIds(course).events).toEqual([{ type: "exam", title: "Exam" }]);
  });

  it("drops recurring events with no meetings", () => {
    const course = normalizeCourse({
      code: "X",
      events: [
        { type: "lab", title: "Lab", meetings: [] },
        { type: "tutorial", title: "Tutorial", meetings: null },
        { type: "assignment", title: "A1", due_date: "2025-01-01" },
      ],
    });
    expect(course.events.map((e) => e.type)).toEqual(["assignment"]);
  });

  it("drops unknown event types and meetings with unknown days", () => {
    const course = normalizeCourse({
      code: "X",
      events: [
        { type: "seminar", title: "Seminar" },
        {
          type: "lecture",
          meetings: [
            { day: "Funday", start_time: "10:00 AM" },
            { day: "Monday", start_time: "10:00 AM", end_time: "11:00 AM" },
          ],
        },
      ],
    });
    expect(withoutIds(course).events).toEqual([
      {
        type: "lecture",
        title: "Lecture",
        meetings: [{ day: "monday", startTime: "10:00", endTime: "11:00" }],
      },
    ]);
  });
});
