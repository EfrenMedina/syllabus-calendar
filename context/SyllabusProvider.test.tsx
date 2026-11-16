import { describe, expect, it, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import { SyllabusProvider, useSyllabus } from "@/context/SyllabusProvider";
import { PSY100_NORMALIZED } from "@/lib/__fixtures__/psy100";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

function seeded() {
  const hook = renderHook(() => useSyllabus(), { wrapper: SyllabusProvider });
  act(() => hook.result.current.setResult(structuredClone(PSY100_NORMALIZED)));
  return hook;
}

describe("SyllabusProvider", () => {
  it("useSyllabus throws outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Consumer() {
      useSyllabus();
      return null;
    }
    expect(() => render(<Consumer />)).toThrow(/SyllabusProvider/);
  });

  it("deleteEvent removes only the targeted event", () => {
    const { result } = seeded();
    act(() => result.current.deleteEvent("tt1"));
    expect(result.current.result!.events.map((e) => e.id)).toEqual(["ps1", "lec"]);
  });

  it("updateEvent patches one event and leaves the others untouched", () => {
    const { result } = seeded();
    const before = result.current.result!.events;
    act(() => result.current.updateEvent("ps1", { title: "PS 1 (revised)" }));
    const after = result.current.result!.events;
    expect(after[0].title).toBe("PS 1 (revised)");
    expect(after[1]).toBe(before[1]);
    expect(after[2]).toBe(before[2]);
  });

  it("addEvent appends a blank event with an id", () => {
    const { result } = seeded();
    act(() => result.current.addEvent("assignment"));
    const events = result.current.result!.events;
    expect(events).toHaveLength(4);
    expect(events[3]).toMatchObject({ type: "assignment" });
    expect(events[3].id).toBeTruthy();
  });

  it("addEvent gives recurring types one starter meeting", () => {
    const { result } = seeded();
    act(() => result.current.addEvent("lab"));
    expect(result.current.result!.events[3]).toMatchObject({ type: "lab", meetings: [{ day: "monday" }] });
  });
});
