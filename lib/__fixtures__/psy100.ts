import type { Course } from "@/lib/types";
import type { RawCourse } from "@/lib/normalize";

// BUILD_PLAN.md §8 — the one fixture shared by the normalizer, BFF, and .ics tests.

export const PSY100_RAW: RawCourse = {
  code: "PSY100",
  timezone: "America/Toronto",
  events: [
    { type: "assignment", title: "Problem Set 1", due_date: "2025-09-25", due_time: "11:59 PM" },
    {
      type: "test",
      title: "Term Test 1",
      due_date: "2025-10-09",
      start_time: "05:15 PM",
      end_time: "06:45 PM",
    },
    {
      type: "lecture",
      title: "Lecture",
      meetings: [
        { day: "Tuesday", start_time: "11:00 AM", end_time: "12:00 PM" },
        { day: "Thursday", start_time: "11:00 AM", end_time: "01:00 PM" },
      ],
      start_date: "2025-09-02",
      end_date: "2025-11-27",
    },
  ],
};

export const PSY100_NORMALIZED: Course = {
  code: "PSY100",
  timezone: "America/Toronto",
  events: [
    { id: "ps1", type: "assignment", title: "Problem Set 1", date: "2025-09-25", time: "23:59" },
    {
      id: "tt1",
      type: "test",
      title: "Term Test 1",
      date: "2025-10-09",
      startTime: "17:15",
      endTime: "18:45",
    },
    {
      id: "lec",
      type: "lecture",
      title: "Lecture",
      meetings: [
        { day: "tuesday", startTime: "11:00", endTime: "12:00" },
        { day: "thursday", startTime: "11:00", endTime: "13:00" },
      ],
      startDate: "2025-09-02",
      endDate: "2025-11-27",
    },
  ],
};
