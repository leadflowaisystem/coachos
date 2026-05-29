/**
 * Simple in-memory rate limiter.
 * 30 requests per IP per minute by default.
 * Resets per window — sliding window approximation.
 *
 * NOT suitable for multi-instance production (use Upstash Redis there).
 * Fine for single-instance Vercel serverless cold-starts because each
 * instance resets on cold start and multi-instance abuse is still bounded.
 */

interface Window {
  count:     number;
  resetAt:   number;
}

const store = new Map<string, Window>();
const DEFAULT_LIMIT  = 30;
const DEFAULT_WINDOW = 60_000; // 1 minute

export function rateLimit(
  identifier: string,
  { limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW }: { limit?: number; windowMs?: number } = {}
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = store.get(identifier);

  if (!existing || now > existing.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  existing.count++;
  const allowed   = existing.count <= limit;
  const remaining = Math.max(0, limit - existing.count);
  return { allowed, remaining };
}

/** Extract the real IP from Next.js request headers. */
export function getIp(req: { headers: { get: (k: string) => string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
