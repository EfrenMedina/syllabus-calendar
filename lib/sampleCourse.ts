import type { Course } from "@/lib/types";
import { PSY100_NORMALIZED } from "@/lib/__fixtures__/psy100";

/** A fresh copy of the PSY100 fixture with new ids, for the "Try a sample syllabus" path. */
export function getSampleCourse(): Course {
  return {
    ...PSY100_NORMALIZED,
    events: structuredClone(PSY100_NORMALIZED.events).map((event) => ({
      ...event,
      id: crypto.randomUUID(),
    })),
  };
}
