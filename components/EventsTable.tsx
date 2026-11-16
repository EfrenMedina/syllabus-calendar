"use client";

import { useState } from "react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Plus, Trash2, X } from "lucide-react";
import { useSyllabus } from "@/context/SyllabusProvider";
import { EVENT_TYPE_BADGE, EVENT_TYPE_LABEL, isValidDate, isValidTime } from "@/lib/eventStyles";
import {
  WEEKDAYS,
  isRecurring,
  type EventType,
  type Meeting,
  type SyllabusEvent,
  type Weekday,
} from "@/lib/types";

type TableMeta = {
  updateEvent: (id: string, patch: Partial<SyllabusEvent>) => void;
  deleteEvent: (id: string) => void;
};

const features = tableFeatures({ tableMeta: {} as TableMeta });
const helper = createColumnHelper<typeof features, SyllabusEvent>();

type FieldKind = "text" | "date" | "time";

const PLACEHOLDER: Record<FieldKind, string> = { text: "Title", date: "YYYY-MM-DD", time: "HH:mm" };

function isValid(kind: FieldKind, value: string): boolean {
  if (value === "") return kind !== "text";
  if (kind === "date") return isValidDate(value);
  if (kind === "time") return isValidTime(value);
  return true;
}

const inputBase =
  "h-9 min-w-0 rounded-md border bg-white px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:bg-zinc-950";
const inputOk = "border-zinc-300 focus-visible:border-blue-500 dark:border-zinc-700";
const inputBad =
  "border-red-500 text-red-700 focus-visible:border-red-500 focus-visible:ring-red-500/30 dark:text-red-400";

/** A controlled input that keeps a local draft and commits on blur (or Enter). */
function EditableField(props: {
  value: string | undefined;
  kind: FieldKind;
  label: string;
  onCommit: (value: string | undefined) => void;
  className?: string;
}) {
  const external = props.value ?? "";
  const [draft, setDraft] = useState(external);
  // Reset the draft when the value changes from outside (e.g. another row was deleted).
  const [synced, setSynced] = useState(external);
  if (external !== synced) {
    setSynced(external);
    setDraft(external);
  }

  const valid = isValid(props.kind, draft.trim());

  function commit() {
    const next = draft.trim();
    if (next === external) return;
    props.onCommit(next === "" ? undefined : next);
  }

  return (
    <input
      type="text"
      inputMode={props.kind === "text" ? "text" : "numeric"}
      value={draft}
      placeholder={PLACEHOLDER[props.kind]}
      aria-label={props.label}
      aria-invalid={!valid}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={`${inputBase} ${valid ? inputOk : inputBad} ${props.className ?? "w-full"}`}
    />
  );
}

function MeetingsEditor(props: {
  meetings: Meeting[];
  title: string;
  onChange: (meetings: Meeting[]) => void;
}) {
  const { meetings, title, onChange } = props;

  function patch(index: number, change: Partial<Meeting>) {
    onChange(meetings.map((m, i) => (i === index ? { ...m, ...change } : m)));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {meetings.map((meeting, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select
            value={meeting.day}
            aria-label={`Day for ${title} meeting ${i + 1}`}
            onChange={(e) => patch(i, { day: e.target.value as Weekday })}
            className={`${inputBase} ${inputOk} w-28 shrink-0 capitalize`}
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day} className="capitalize">
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </option>
            ))}
          </select>
          <EditableField
            kind="time"
            value={meeting.startTime}
            label={`Start time for ${title} meeting ${i + 1}`}
            onCommit={(v) => patch(i, { startTime: v })}
            className="w-20 shrink-0 text-center"
          />
          <span aria-hidden className="text-zinc-400">
            –
          </span>
          <EditableField
            kind="time"
            value={meeting.endTime}
            label={`End time for ${title} meeting ${i + 1}`}
            onCommit={(v) => patch(i, { endTime: v })}
            className="w-20 shrink-0 text-center"
          />
          <button
            type="button"
            aria-label={`Remove ${title} meeting ${i + 1}`}
            onClick={() => onChange(meetings.filter((_, j) => j !== i))}
            disabled={meetings.length === 1}
            title={meetings.length === 1 ? "A class needs at least one meeting" : undefined}
            className="rounded p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-zinc-200"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...meetings, { day: "monday" }])}
        className="self-start rounded text-xs font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400"
      >
        + Add meeting
      </button>
    </div>
  );
}

// Column builders. Each reads the event off the row and writes back through table meta.

const titleColumn = helper.display({
  id: "title",
  header: "Title",
  cell: ({ row, table }) => (
    <EditableField
      kind="text"
      value={row.original.title}
      label={`Title for ${row.original.title || "event"}`}
      onCommit={(v) => table.options.meta?.updateEvent(row.original.id, { title: v ?? "" })}
    />
  ),
});

function fieldColumn(id: string, header: string, kind: FieldKind) {
  return helper.display({
    id,
    header,
    cell: ({ row, table }) => {
      const event = row.original as unknown as Record<string, string | undefined>;
      return (
        <EditableField
          kind={kind}
          value={event[id]}
          label={`${header} for ${row.original.title || "event"}`}
          onCommit={(v) =>
            table.options.meta?.updateEvent(row.original.id, { [id]: v } as Partial<SyllabusEvent>)
          }
        />
      );
    },
  });
}

const meetingsColumn = helper.display({
  id: "meetings",
  header: "Meetings",
  cell: ({ row, table }) => {
    const event = row.original;
    if (!isRecurring(event)) return null;
    return (
      <MeetingsEditor
        meetings={event.meetings}
        title={event.title || "class"}
        onChange={(meetings) => table.options.meta?.updateEvent(event.id, { meetings })}
      />
    );
  },
});

const deleteColumn = helper.display({
  id: "delete",
  header: () => <span className="sr-only">Delete</span>,
  cell: ({ row, table }) => (
    <button
      type="button"
      aria-label={`Delete ${row.original.title || "event"}`}
      onClick={() => table.options.meta?.deleteEvent(row.original.id)}
      className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  ),
});

const assignmentColumns = helper.columns([
  titleColumn,
  fieldColumn("date", "Date", "date"),
  fieldColumn("time", "Time", "time"),
  deleteColumn,
]);

const evaluationColumns = helper.columns([
  titleColumn,
  fieldColumn("date", "Date", "date"),
  fieldColumn("startTime", "Start", "time"),
  fieldColumn("endTime", "End", "time"),
  deleteColumn,
]);

const recurringColumns = helper.columns([
  titleColumn,
  meetingsColumn,
  fieldColumn("startDate", "Start date", "date"),
  fieldColumn("endDate", "End date", "date"),
  deleteColumn,
]);

function columnsFor(type: EventType) {
  if (type === "assignment") return assignmentColumns;
  if (type === "lecture" || type === "tutorial" || type === "lab") return recurringColumns;
  return evaluationColumns;
}

// Min widths per column keep inputs usable; the card scrolls horizontally on narrow screens.
const COLUMN_CLASS: Record<string, string> = {
  title: "min-w-44",
  meetings: "min-w-80",
  date: "min-w-32 w-36",
  startDate: "min-w-32 w-36",
  endDate: "min-w-32 w-36",
  time: "min-w-24 w-28",
  startTime: "min-w-24 w-28",
  endTime: "min-w-24 w-28",
  delete: "w-10",
};

export function EventsTable(props: { type: EventType; events: SyllabusEvent[] }): React.JSX.Element {
  const { updateEvent, deleteEvent, addEvent } = useSyllabus();

  const table = useTable({
    features,
    columns: columnsFor(props.type),
    data: props.events,
    getRowId: (event) => event.id,
    meta: { updateEvent, deleteEvent },
  });

  const headingId = `events-${props.type}`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 id={headingId} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE[props.type]}`}>
          {EVENT_TYPE_LABEL[props.type]}
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{props.events.length}</span>
      </div>
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className={`border-b border-zinc-200 px-1.5 pb-2 text-left text-xs font-normal text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 ${COLUMN_CLASS[header.column.id] ?? ""}`}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-1.5 py-2 align-top">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => addEvent(props.type)}
        className="mt-2 inline-flex items-center gap-1 rounded px-1 py-1 text-sm text-zinc-600 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <Plus className="size-4" aria-hidden />
        Add row
      </button>
    </section>
  );
}
