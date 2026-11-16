"use client";

import { useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import toast from "react-hot-toast";
import { FileUp, LoaderCircle } from "lucide-react";
import { extractSyllabus } from "@/lib/api";
import { MAX_UPLOAD_BYTES } from "@/lib/limits";
import type { Course } from "@/lib/types";

function rejectionMessage(rejections: FileRejection[]): string {
  const code = rejections[0]?.errors[0]?.code;
  if (code === "file-too-large") return "That PDF is over 10 MB.";
  if (code === "too-many-files") return "Upload one PDF at a time.";
  return "Only PDF files are supported.";
}

export function UploadDropzone(props: { onExtracted: (r: Course) => void }): React.JSX.Element {
  const [loading, setLoading] = useState(false);

  async function handleDrop(accepted: File[], rejected: FileRejection[]) {
    if (rejected.length > 0) {
      toast.error(rejectionMessage(rejected));
      return;
    }
    const file = accepted[0];
    if (!file) return;

    setLoading(true);
    try {
      const course = await extractSyllabus(file);
      props.onExtracted(course);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setLoading(false);
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    disabled: loading,
    onDrop: handleDrop,
  });

  return (
    <div
      {...getRootProps({
        "aria-label": "Upload syllabus PDF",
        "aria-busy": loading,
      })}
      className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
        isDragActive
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
          : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
      } ${loading ? "cursor-progress" : ""}`}
    >
      <input {...getInputProps()} data-testid="dropzone-input" />
      {loading ? (
        <div role="status" className="flex flex-col items-center gap-2">
          <LoaderCircle className="size-7 animate-spin text-blue-600 dark:text-blue-400" aria-hidden />
          <p className="text-base font-medium">Extracting events…</p>
          <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
            This usually takes 10–20 seconds. The first upload after a while can take up to a minute.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <FileUp className="size-7 text-blue-600 dark:text-blue-400" aria-hidden />
          <p className="text-base font-medium">
            {isDragActive ? "Drop it here" : "Drop your syllabus PDF here"}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">or click to browse · PDF up to 10 MB</p>
        </div>
      )}
    </div>
  );
}
