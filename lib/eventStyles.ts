import type { EventType } from "@/lib/types";

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  lecture: "Lectures",
  tutorial: "Tutorials",
  lab: "Labs",
  assignment: "Assignments",
  test: "Tests",
  quiz: "Quizzes",
  exam: "Exams",
};

// One soft badge color per type: classes violet, tutorial teal, lab cyan, deadlines amber, sittings rose.
export const EVENT_TYPE_BADGE: Record<EventType, string> = {
  lecture: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  tutorial: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  lab: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  assignment: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  test: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  quiz: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  exam: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}
