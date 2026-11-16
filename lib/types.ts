export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type EventType =
  | "lecture"
  | "tutorial"
  | "lab"
  | "assignment"
  | "test"
  | "quiz"
  | "exam";

export interface BaseEvent {
  id: string;
  type: EventType;
  title: string;
}

// One weekly slot. Times are optional: some syllabi list days but not times.
export interface Meeting {
  day: Weekday;
  startTime?: string;
  endTime?: string;
}

export interface RecurringEvent extends BaseEvent {
  type: "lecture" | "tutorial" | "lab";
  meetings: Meeting[];
  startDate?: string;
  endDate?: string;
}

export interface AssignmentEvent extends BaseEvent {
  type: "assignment";
  date?: string;
  time?: string;
}

export interface EvaluationEvent extends BaseEvent {
  type: "test" | "quiz" | "exam";
  date?: string;
  startTime?: string;
  endTime?: string;
}

export type SyllabusEvent = RecurringEvent | AssignmentEvent | EvaluationEvent;

export interface Course {
  code: string;
  timezone: string;
  events: SyllabusEvent[];
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Display order for grouped event types.
export const EVENT_TYPE_ORDER: EventType[] = [
  "lecture",
  "tutorial",
  "lab",
  "assignment",
  "test",
  "quiz",
  "exam",
];

export function isRecurring(event: SyllabusEvent): event is RecurringEvent {
  return event.type === "lecture" || event.type === "tutorial" || event.type === "lab";
}

export function isEvaluation(event: SyllabusEvent): event is EvaluationEvent {
  return event.type === "test" || event.type === "quiz" || event.type === "exam";
}
