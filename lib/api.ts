import type { ApiResponse, Course } from "@/lib/types";

/** Upload a syllabus PDF to the BFF. Resolves with the normalized Course, throws on ok:false. */
export async function extractSyllabus(file: File): Promise<Course> {
  const form = new FormData();
  form.append("file", file);

  let body: ApiResponse<Course>;
  try {
    const res = await fetch("/api/extract", { method: "POST", body: form });
    body = (await res.json()) as ApiResponse<Course>;
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }

  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}
