import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventsTable } from "@/components/EventsTable";
import type { AssignmentEvent, RecurringEvent } from "@/lib/types";

const updateEvent = vi.fn();
const deleteEvent = vi.fn();
const addEvent = vi.fn();

vi.mock("@/context/SyllabusProvider", () => ({
  useSyllabus: () => ({ updateEvent, deleteEvent, addEvent }),
}));

const assignments: AssignmentEvent[] = [
  { id: "a1", type: "assignment", title: "Problem Set 1", date: "2025-09-25", time: "23:59" },
  { id: "a2", type: "assignment", title: "Problem Set 2", date: "2025-10-02" },
];

describe("EventsTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders one body row per event", () => {
    render(<EventsTable type="assignment" events={assignments} />);
    const [, body] = screen.getAllByRole("rowgroup");
    expect(within(body).getAllByRole("row")).toHaveLength(2);
  });

  it("writes an edited title back on blur", async () => {
    const user = userEvent.setup();
    render(<EventsTable type="assignment" events={assignments} />);
    const input = screen.getByLabelText("Title for Problem Set 1");
    await user.clear(input);
    await user.type(input, "PS1");
    await user.tab();
    expect(updateEvent).toHaveBeenCalledWith("a1", { title: "PS1" });
  });

  it("clearing an optional field commits undefined", async () => {
    const user = userEvent.setup();
    render(<EventsTable type="assignment" events={assignments} />);
    await user.clear(screen.getByLabelText("Time for Problem Set 1"));
    await user.tab();
    expect(updateEvent).toHaveBeenCalledWith("a1", { time: undefined });
  });

  it("deletes the row whose trash button is clicked", async () => {
    render(<EventsTable type="assignment" events={assignments} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Problem Set 1" }));
    expect(deleteEvent).toHaveBeenCalledWith("a1");
  });

  it("adds a row of the table's type", async () => {
    render(<EventsTable type="assignment" events={assignments} />);
    await userEvent.click(screen.getByRole("button", { name: /add row/i }));
    expect(addEvent).toHaveBeenCalledWith("assignment");
  });

  it("flags an invalid date", async () => {
    const user = userEvent.setup();
    render(<EventsTable type="assignment" events={assignments} />);
    const input = screen.getByLabelText("Date for Problem Set 1");
    await user.clear(input);
    await user.type(input, "2025/09/25");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.className).toMatch(/border-red-500/);
  });

  it("edits and adds meetings on a recurring event", async () => {
    const lecture: RecurringEvent = {
      id: "l1",
      type: "lecture",
      title: "Lecture",
      meetings: [{ day: "tuesday", startTime: "11:00", endTime: "12:00" }],
      startDate: "2025-09-02",
      endDate: "2025-11-27",
    };
    const user = userEvent.setup();
    render(<EventsTable type="lecture" events={[lecture]} />);

    await user.selectOptions(screen.getByLabelText("Day for Lecture meeting 1"), "thursday");
    expect(updateEvent).toHaveBeenLastCalledWith("l1", {
      meetings: [{ day: "thursday", startTime: "11:00", endTime: "12:00" }],
    });

    await user.click(screen.getByRole("button", { name: /add meeting/i }));
    expect(updateEvent).toHaveBeenLastCalledWith("l1", {
      meetings: [{ day: "tuesday", startTime: "11:00", endTime: "12:00" }, { day: "monday" }],
    });
  });
});
