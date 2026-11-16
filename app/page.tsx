"use client";

import { useRouter } from "next/navigation";
import { StepIndicator } from "@/components/StepIndicator";
import { UploadDropzone } from "@/components/UploadDropzone";
import { useSyllabus } from "@/context/SyllabusProvider";
import { getSampleCourse } from "@/lib/sampleCourse";
import type { Course } from "@/lib/types";

export default function UploadPage() {
  const { setResult } = useSyllabus();
  const router = useRouter();

  function handleCourse(course: Course) {
    setResult(course);
    router.push("/review");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator current={1} />
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Turn your syllabus into a calendar</h1>
      <p className="mt-2 mb-6 text-zinc-600 dark:text-zinc-400">
        Upload a course syllabus PDF. You&apos;ll review every date before anything is exported.
      </p>
      <UploadDropzone onExtracted={handleCourse} />
      <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
        No PDF handy?{" "}
        <button
          type="button"
          onClick={() => handleCourse(getSampleCourse())}
          className="rounded font-medium text-blue-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-400"
        >
          Try a sample syllabus
        </button>
      </p>
    </div>
  );
}
