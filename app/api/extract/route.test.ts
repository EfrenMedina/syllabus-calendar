// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/extract/route";
import { PSY100_RAW } from "@/lib/__fixtures__/psy100";
import { resetMemoryRateLimit } from "@/lib/rateLimit";

function uploadRequest(file?: File, ip = "203.0.113.7"): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("http://localhost/api/extract", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": ip },
  });
}

const pdf = (size = 100) =>
  new File([new Uint8Array(size)], "syllabus.pdf", { type: "application/pdf" });

describe("POST /api/extract", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("EXTRACT_SERVICE_URL", "http://upstream.test");
    vi.stubEnv("EXTRACT_SERVICE_TOKEN", "secret-token");
    resetMemoryRateLimit();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it("rejects a non-pdf with BAD_FILE", async () => {
    const res = await POST(uploadRequest(new File(["x"], "a.png", { type: "image/png" })));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("BAD_FILE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a pdf over 4 MB with BAD_FILE", async () => {
    const res = await POST(uploadRequest(pdf(4 * 1024 * 1024 + 1)));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("BAD_FILE");
  });

  it("rejects a request with no file", async () => {
    const res = await POST(uploadRequest());
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("BAD_FILE");
  });

  it("returns the normalized course on the happy path", async () => {
    fetchMock.mockResolvedValue(Response.json(PSY100_RAW));
    const res = await POST(uploadRequest(pdf()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.code).toBe("PSY100");
    expect(body.data.events).toHaveLength(3);
    expect(body.data.events[0]).toMatchObject({ type: "assignment", time: "23:59" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://upstream.test/extract",
      expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer secret-token" } }),
    );
  });

  it("refuses to call upstream when the service token is missing", async () => {
    vi.stubEnv("EXTRACT_SERVICE_TOKEN", "");
    const res = await POST(uploadRequest(pdf()));
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rate-limits an IP after 5 uploads without calling upstream", async () => {
    fetchMock.mockImplementation(async () => Response.json(PSY100_RAW));
    for (let i = 0; i < 5; i++) {
      expect((await POST(uploadRequest(pdf()))).status).toBe(200);
    }
    const res = await POST(uploadRequest(pdf()));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(5);

    // A different IP is unaffected.
    expect((await POST(uploadRequest(pdf(), "198.51.100.2"))).status).toBe(200);
  });

  it("does not count rejected files against the limit", async () => {
    fetchMock.mockImplementation(async () => Response.json(PSY100_RAW));
    for (let i = 0; i < 10; i++) {
      await POST(uploadRequest(new File(["x"], "a.png", { type: "image/png" })));
    }
    expect((await POST(uploadRequest(pdf()))).status).toBe(200);
  });

  it("maps an upstream 500 to UPSTREAM_DOWN", async () => {
    fetchMock.mockResolvedValue(Response.json({ detail: "boom" }, { status: 500 }));
    const res = await POST(uploadRequest(pdf()));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("UPSTREAM_DOWN");
  });

  it("maps a network failure to UPSTREAM_DOWN", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await POST(uploadRequest(pdf()));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("UPSTREAM_DOWN");
  });

  it("maps an upstream 422 to EXTRACT_FAILED", async () => {
    fetchMock.mockResolvedValue(Response.json({ detail: "nope" }, { status: 422 }));
    const res = await POST(uploadRequest(pdf()));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("EXTRACT_FAILED");
  });

  it("passes an upstream 400 detail through as BAD_FILE", async () => {
    fetchMock.mockResolvedValue(Response.json({ detail: "No readable text found" }, { status: 400 }));
    const res = await POST(uploadRequest(pdf()));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toEqual({ code: "BAD_FILE", message: "No readable text found" });
  });
});
