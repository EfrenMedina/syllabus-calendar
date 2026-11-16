import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { UploadDropzone } from "@/components/UploadDropzone";
import { extractSyllabus } from "@/lib/api";
import { PSY100_NORMALIZED } from "@/lib/__fixtures__/psy100";

vi.mock("@/lib/api", () => ({ extractSyllabus: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn() } }));

const mockExtract = vi.mocked(extractSyllabus);
const pdf = () => new File(["%PDF-1.4"], "syllabus.pdf", { type: "application/pdf" });

async function upload(file: File) {
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(screen.getByTestId("dropzone-input"), file);
}

describe("UploadDropzone", () => {
  afterEach(() => vi.clearAllMocks());

  it("shows the dropzone", () => {
    render(<UploadDropzone onExtracted={vi.fn()} />);
    expect(screen.getByText(/drop your syllabus pdf here/i)).toBeInTheDocument();
  });

  it("shows a loading state while extracting", async () => {
    mockExtract.mockReturnValue(new Promise(() => {}));
    render(<UploadDropzone onExtracted={vi.fn()} />);
    await upload(pdf());
    expect(await screen.findByText(/extracting events/i)).toBeInTheDocument();
  });

  it("calls onExtracted with the result on success", async () => {
    mockExtract.mockResolvedValue(PSY100_NORMALIZED);
    const onExtracted = vi.fn();
    render(<UploadDropzone onExtracted={onExtracted} />);
    await upload(pdf());
    await waitFor(() => expect(onExtracted).toHaveBeenCalledWith(PSY100_NORMALIZED));
  });

  it("toasts the error and does not call onExtracted on failure", async () => {
    mockExtract.mockRejectedValue(new Error("Only PDF files are supported."));
    const onExtracted = vi.fn();
    render(<UploadDropzone onExtracted={onExtracted} />);
    await upload(pdf());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Only PDF files are supported."));
    expect(onExtracted).not.toHaveBeenCalled();
    expect(screen.getByText(/drop your syllabus pdf here/i)).toBeInTheDocument();
  });

  it("rejects a non-pdf without calling the API", async () => {
    render(<UploadDropzone onExtracted={vi.fn()} />);
    await upload(new File(["x"], "photo.png", { type: "image/png" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Only PDF files are supported."));
    expect(mockExtract).not.toHaveBeenCalled();
  });
});
