"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Download, TriangleAlert } from "lucide-react";
import { StepIndicator } from "@/components/StepIndicator";
import { useRequireCourse } from "@/context/SyllabusProvider";
import { buildICS, findExportBlockers } from "@/lib/ics";
import { isRecurring } from "@/lib/types";

function fileNameFor(code: string): string {
  const safe = code.trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "syllabus"}.ics`;
}

export default function ExportPage() {
  const course = useRequireCourse();
  const blockers = useMemo(() => (course ? findExportBlockers(course) : []), [course]);

  if (!course) return null;

  const total = course.events.length;
  const weekly = course.events.filter(isRecurring).length;
  const deadlines = total - weekly;
  const fileName = fileNameFor(course.code);

  function download() {
    const ics = buildICS(course!);
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const stats = [
    { label: "Events", value: total },
    { label: "Weekly classes", value: weekly },
    { label: "Deadlines and tests", value: deadlines },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator current={3} />
      <h1 className="text-2xl font-semibold tracking-tight">
        {blockers.length === 0
          ? `${total} ${total === 1 ? "event" : "events"} ready to export`
          : "Almost ready to export"}
      </h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        You&apos;ll get one calendar file for {course.code} with every class, deadline, and test.
      </p>

      <dl className="mb-6 grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-900">
            <dt className="text-xs text-zinc-600 dark:text-zinc-400">{stat.label}</dt>
            <dd className="mt-0.5 text-2xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {blockers.length > 0 ? (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
        >
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-4" aria-hidden />
            {blockers.length === 1 ? "1 thing needs fixing" : `${blockers.length} things need fixing`} before
            you can export
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            {blockers.map((b, i) => (
              <li key={`${b.eventId}-${i}`}>
                <span className="font-medium">{b.title || "Untitled event"}</span>: {b.reason}
              </li>
            ))}
          </ul>
          <Link
            href="/review"
            className="mt-3 inline-block rounded text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Fix in review
          </Link>
        </div>
      ) : total === 0 ? (
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          There&apos;s nothing to export yet. Go back and add at least one event.
        </p>
      ) : (
        <div className="mb-6">
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Download className="size-4" aria-hidden />
            Download {fileName}
          </button>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-foreground">Google Calendar:</span> Settings → Import and export →
            Import, then pick the file. Tip: import into a new calendar so you can remove it in one click.
            <br />
            <span className="font-medium text-foreground">Apple Calendar or Outlook:</span> open the file and
            confirm the import.
          </p>
        </div>
      )}

      <Link
        href="/review"
        className="inline-flex items-center gap-1.5 rounded text-sm text-zinc-600 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to review
      </Link>
    </div>
  );
}
