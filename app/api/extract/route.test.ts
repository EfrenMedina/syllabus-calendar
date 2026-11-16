// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/extract/route";
import { PSY100_RAW } from "@/lib/__fixtures__/psy100";

function uploadRequest(file?: File): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("http://localhost/api/extract", { method: "POST", body: form });
}

const pdf = (size = 100) =>
  new File([new Uint8Array(size)], "syllabus.pdf", { type: "application/pdf" });

describe("POST /api/extract", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("EXTRACT_SERVICE_URL", "http://upstream.test");
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

  it("rejects a pdf over 10 MB with BAD_FILE", async () => {
    const res = await POST(uploadRequest(pdf(10 * 1024 * 1024 + 1)));
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
    expect(fetchMock).toHaveBeenCalledWith("http://upstream.test/extract", expect.objectContaining({ method: "POST" }));
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
