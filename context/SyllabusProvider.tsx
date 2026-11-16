"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Course, EventType, SyllabusEvent } from "@/lib/types";

interface SyllabusContextValue {
  result: Course | null;
  setResult: (r: Course | null) => void;
  updateEvent: (id: string, patch: Partial<SyllabusEvent>) => void;
  deleteEvent: (id: string) => void;
  addEvent: (type: EventType) => void; // appends a blank event of that type
}

const SyllabusContext = createContext<SyllabusContextValue | null>(null);

export function blankEvent(type: EventType): SyllabusEvent {
  const id = crypto.randomUUID();
  const title = `New ${type}`;
  switch (type) {
    case "lecture":
    case "tutorial":
    case "lab":
      return { id, type, title, meetings: [{ day: "monday" }] };
    case "assignment":
      return { id, type, title };
    case "test":
    case "quiz":
    case "exam":
      return { id, type, title };
  }
}

export function SyllabusProvider(props: { children: React.ReactNode }): React.JSX.Element {
  const [result, setResult] = useState<Course | null>(null);

  const updateEvent = useCallback((id: string, patch: Partial<SyllabusEvent>) => {
    setResult((course) =>
      course && {
        ...course,
        events: course.events.map((event) =>
          event.id === id ? ({ ...event, ...patch, id, type: event.type } as SyllabusEvent) : event,
        ),
      },
    );
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setResult((course) => course && { ...course, events: course.events.filter((e) => e.id !== id) });
  }, []);

  const addEvent = useCallback((type: EventType) => {
    setResult((course) => course && { ...course, events: [...course.events, blankEvent(type)] });
  }, []);

  const value = useMemo(
    () => ({ result, setResult, updateEvent, deleteEvent, addEvent }),
    [result, updateEvent, deleteEvent, addEvent],
  );

  return <SyllabusContext.Provider value={value}>{props.children}</SyllabusContext.Provider>;
}

export function useSyllabus(): SyllabusContextValue {
  const ctx = useContext(SyllabusContext);
  if (!ctx) throw new Error("useSyllabus must be used inside <SyllabusProvider>");
  return ctx;
}

/** For /review and /export: bounce back to the upload step when there's nothing in context. */
export function useRequireCourse(): Course | null {
  const { result } = useSyllabus();
  const router = useRouter();

  useEffect(() => {
    if (result === null) router.replace("/");
  }, [result, router]);

  return result;
}
