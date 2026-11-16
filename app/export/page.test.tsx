import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExportPage from "@/app/export/page";
import { SyllabusProvider, useSyllabus } from "@/context/SyllabusProvider";
import { PSY100_NORMALIZED } from "@/lib/__fixtures__/psy100";
import type { Course } from "@/lib/types";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

function Seed({ course }: { course: Course | null }) {
  const { setResult } = useSyllabus();
  useEffect(() => setResult(course), [course, setResult]);
  return null;
}

function renderWith(course: Course | null) {
  render(
    <SyllabusProvider>
      <Seed course={course} />
      <ExportPage />
    </SyllabusProvider>,
  );
}

describe("Export page", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.clearAllMocks());

  it("redirects to / when there is no course", () => {
    renderWith(null);
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows the event count", () => {
    renderWith(PSY100_NORMALIZED);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("3 events ready to export");
  });

  it("downloads {code}.ics through an object URL", async () => {
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this);
    });
    renderWith(PSY100_NORMALIZED);
    await userEvent.click(screen.getByRole("button", { name: /download psy100\.ics/i }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toHaveAttribute("download", "PSY100.ics");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("blocks the download and lists what needs fixing", () => {
    renderWith({
      ...PSY100_NORMALIZED,
      events: [{ id: "m", type: "exam", title: "Final exam" }],
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Final exam: Missing a date");
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
  });
});
