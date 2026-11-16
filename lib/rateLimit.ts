import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Each upload is a paid Claude call, so cap uploads per IP.
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// Upstash's own names, or the KV_* names Vercel's Storage integration sets.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

// Shared across all serverless instances when Redis is configured (production).
const upstash =
  redisUrl && redisToken
    ? new Ratelimit({
        redis: new Redis({ url: redisUrl, token: redisToken }),
        limiter: Ratelimit.slidingWindow(LIMIT, "10 m"),
        prefix: "syllabus-extract",
      })
    : null;

// Fallback for local dev: per-instance memory only. On Vercel each instance has its own
// copy, so this is best-effort — set the Upstash env vars in production.
const memory = new Map<string, number[]>();
let warned = false;

function memoryLimit(key: string, now: number): RateLimitResult {
  if (!warned && process.env.NODE_ENV === "production") {
    console.warn("Redis env vars not set; rate limiting is per-instance only.");
    warned = true;
  }
  const recent = (memory.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    memory.set(key, recent);
    return { allowed: false, retryAfterSeconds: Math.ceil((recent[0] + WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  memory.set(key, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** The caller's IP as Vercel reports it. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const now = Date.now();
  if (!upstash) return memoryLimit(key, now);

  try {
    const { success, reset } = await upstash.limit(key);
    return { allowed: success, retryAfterSeconds: Math.max(1, Math.ceil((reset - now) / 1000)) };
  } catch (err) {
    // If Redis is down, fall back to memory rather than letting every request through.
    console.error("Rate limiter unavailable, using memory fallback:", err);
    return memoryLimit(key, now);
  }
}

/** Test helper. */
export function resetMemoryRateLimit(): void {
  memory.clear();
}
