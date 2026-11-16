"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileQuestion } from "lucide-react";
import { EventsTable } from "@/components/EventsTable";
import { StepIndicator } from "@/components/StepIndicator";
import { useRequireCourse, useSyllabus } from "@/context/SyllabusProvider";
import { EVENT_TYPE_LABEL } from "@/lib/eventStyles";
import { EVENT_TYPE_ORDER, type EventType, type SyllabusEvent } from "@/lib/types";

const EMPTY_GROUPS: [EventType, SyllabusEvent[]][] = [];

export default function ReviewPage() {
  const course = useRequireCourse();
  const { addEvent } = useSyllabus();
  const router = useRouter();

  const groups = useMemo(() => {
    if (!course) return EMPTY_GROUPS;
    return EVENT_TYPE_ORDER.map(
      (type) => [type, course.events.filter((e) => e.type === type)] as [EventType, SyllabusEvent[]],
    ).filter(([, events]) => events.length > 0);
  }, [course]);

  if (!course) return null;

  const missingTypes = EVENT_TYPE_ORDER.filter((type) => !groups.some(([t]) => t === type));
  const count = course.events.length;

  return (
    <div>
      <StepIndicator current={2} />
      <h1 className="text-2xl font-semibold tracking-tight">
        Found {count} {count === 1 ? "event" : "events"} in {course.code}
      </h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Check every row against your syllabus. Click a cell to fix it. Dates use YYYY-MM-DD and times
        use 24-hour HH:mm; anything else is outlined in red.
      </p>

      {count === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <FileQuestion className="size-8 text-zinc-400" aria-hidden />
          <p className="mt-3 font-medium">No events found</p>
          <p className="mt-1 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
            Try another PDF, or add events yourself with the menu below.
          </p>
          <Link
            href="/"
            className="mt-4 rounded text-sm font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400"
          >
            Upload a different PDF
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([type, events]) => (
            <EventsTable key={type} type={type} events={events} />
          ))}
        </div>
      )}

      <div className="sticky bottom-0 mt-6 flex flex-col-reverse gap-3 border-t border-zinc-200 bg-background/95 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        {missingTypes.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span>Add</span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addEvent(e.target.value as EventType);
              }}
              className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">another event type…</option>
              {missingTypes.map((type) => (
                <option key={type} value={type}>
                  {EVENT_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => router.push("/export")}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Continue to export
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
