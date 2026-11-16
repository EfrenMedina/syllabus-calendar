import { describe, expect, it, vi, beforeEach } from "vitest";
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import ReviewPage from "@/app/review/page";
import { SyllabusProvider, useSyllabus } from "@/context/SyllabusProvider";
import type { Course } from "@/lib/types";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

function Seed({ course }: { course: Course | null }) {
  const { setResult } = useSyllabus();
  useEffect(() => setResult(course), [course, setResult]);
  return null;
}

function renderWith(course: Course | null) {
  render(
    <SyllabusProvider>
      <Seed course={course} />
      <ReviewPage />
    </SyllabusProvider>,
  );
}

const oneOfEach: Course = {
  code: "PSY100",
  timezone: "America/Toronto",
  events: [
    { id: "t", type: "test", title: "Term Test" },
    { id: "a", type: "assignment", title: "Essay" },
    { id: "l", type: "lecture", title: "Lecture", meetings: [{ day: "monday" }] },
  ],
};

describe("Review page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a section per type in display order", () => {
    renderWith(oneOfEach);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Lectures", "Assignments", "Tests"]);
  });

  it("shows the event count and course code", () => {
    renderWith(oneOfEach);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Found 3 events in PSY100");
  });

  it("redirects to / when there is no course", () => {
    renderWith(null);
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows an empty state when no events were found", () => {
    renderWith({ code: "X", timezone: "America/Toronto", events: [] });
    expect(screen.getByText("No events found")).toBeInTheDocument();
  });
});
