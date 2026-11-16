import { normalizeCourse, type RawCourse } from "@/lib/normalize";
import type { ApiResponse, Course } from "@/lib/types";
import { MAX_UPLOAD_BYTES } from "@/lib/limits";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
// Render's free tier can take ~50s to cold start.
export const maxDuration = 120;

const UPSTREAM_TIMEOUT_MS = 90_000;

type ErrorCode = "BAD_FILE" | "EXTRACT_FAILED" | "UPSTREAM_DOWN" | "SERVER_ERROR" | "RATE_LIMITED";

function fail(status: number, code: ErrorCode, message: string, headers?: HeadersInit): Response {
  const body: ApiResponse<Course> = { ok: false, error: { code, message } };
  return Response.json(body, { status, headers });
}

async function upstreamDetail(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : undefined;
  } catch {
    return undefined;
  }
}

/** Validate the upload, forward it to the FastAPI service, and return a normalized Course. */
export async function POST(request: Request): Promise<Response> {
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(400, "BAD_FILE", "Upload a PDF file.");
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, "BAD_FILE", "Upload a PDF file.");
    }
    if (file.type !== "application/pdf") {
      return fail(400, "BAD_FILE", "Only PDF files are supported.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return fail(400, "BAD_FILE", "That PDF is over 4 MB.");
    }

    const serviceUrl = process.env.EXTRACT_SERVICE_URL;
    const serviceToken = process.env.EXTRACT_SERVICE_TOKEN;
    if (!serviceUrl || !serviceToken) {
      console.error("EXTRACT_SERVICE_URL or EXTRACT_SERVICE_TOKEN is not set");
      return fail(500, "SERVER_ERROR", "The server isn't configured correctly.");
    }

    // Checked after validation so a wrong file type doesn't use up someone's quota.
    const limit = await checkRateLimit(clientIp(request));
    if (!limit.allowed) {
      const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
      return fail(
        429,
        "RATE_LIMITED",
        `Too many uploads. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        { "Retry-After": String(limit.retryAfterSeconds) },
      );
    }

    const upstreamForm = new FormData();
    upstreamForm.append("file", file, file.name || "syllabus.pdf");

    let upstream: Response;
    try {
      upstream = await fetch(`${serviceUrl.replace(/\/$/, "")}/extract`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceToken}` },
        body: upstreamForm,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (err) {
      console.error("Extraction service unreachable:", err);
      return fail(502, "UPSTREAM_DOWN", "The extraction service is unavailable. Try again in a minute.");
    }

    if (!upstream.ok) {
      const detail = await upstreamDetail(upstream);
      if (upstream.status === 400 || upstream.status === 413) {
        return fail(400, "BAD_FILE", detail ?? "That PDF couldn't be read.");
      }
      if (upstream.status === 422) {
        return fail(422, "EXTRACT_FAILED", "Couldn't find events in that syllabus. Try another PDF.");
      }
      console.error("Extraction service error:", upstream.status, detail);
      return fail(502, "UPSTREAM_DOWN", "The extraction service is unavailable. Try again in a minute.");
    }

    const raw = (await upstream.json()) as RawCourse;
    const body: ApiResponse<Course> = { ok: true, data: normalizeCourse(raw) };
    return Response.json(body);
  } catch (err) {
    console.error("Unexpected /api/extract error:", err);
    return fail(500, "SERVER_ERROR", "Something went wrong. Try again.");
  }
}
