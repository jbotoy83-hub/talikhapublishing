type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function getRequestRateLimitKey(headers: Headers) {
  return headers.get("x-real-ip")?.trim()
    || headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

export function allowRequest(key: string, limit = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
