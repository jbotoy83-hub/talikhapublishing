import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;
  const key = `${limit}:${windowMs}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    const window = windowMs >= 60000 ? `${Math.round(windowMs / 60000)} m` : `${Math.round(windowMs / 1000)} s`;
    limiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, window as `${number} m` | `${number} s`), analytics: false });
    limiters.set(key, limiter);
  }
  return limiter;
}

export function getRequestRateLimitKey(headers: Headers) {
  return headers.get("x-real-ip")?.trim()
    || headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

export async function allowRequest(key: string, limit = 5, windowMs = 15 * 60 * 1000) {
  const limiter = getLimiter(limit, windowMs);
  if (!limiter) return true;
  const { success } = await limiter.limit(key);
  return success;
}
