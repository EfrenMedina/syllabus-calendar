import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UploadPage from "@/app/page";
import { SyllabusProvider } from "@/context/SyllabusProvider";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

describe("Upload page", () => {
  it("shows step 1 and the dropzone", () => {
    render(<UploadPage />, { wrapper: SyllabusProvider });
    expect(screen.getByText("Upload").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByLabelText(/upload syllabus pdf/i)).toBeInTheDocument();
  });

  it("loads the sample syllabus and goes to review", async () => {
    render(<UploadPage />, { wrapper: SyllabusProvider });
    await userEvent.click(screen.getByRole("button", { name: /try a sample syllabus/i }));
    expect(push).toHaveBeenCalledWith("/review");
  });
});
