/**
 * Rate limiting — in-memory sliding window.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ TODO: Upgrade to Upstash Redis when reaching ~50 active orgs       │
 * │                                                                     │
 * │ The in-memory store resets on every Vercel cold-start. On a        │
 * │ single-instance deployment (typical for early-stage) it works      │
 * │ fine. Once you have multiple concurrent instances or sustained      │
 * │ traffic, move to Upstash:                                           │
 * │                                                                     │
 * │   1. Sign up at upstash.com → create a Redis DB (free tier =       │
 * │      10 k commands/day, enough for ~50 active orgs)                │
 * │   2. Add env vars:                                                  │
 * │        UPSTASH_REDIS_REST_URL=https://...upstash.io                │
 * │        UPSTASH_REDIS_REST_TOKEN=AXxx...                             │
 * │   3. npm install @upstash/redis @upstash/ratelimit                 │
 * │   4. Swap the implementation below with:                            │
 * │                                                                     │
 * │      import { Redis } from "@upstash/redis";                       │
 * │      import { Ratelimit } from "@upstash/ratelimit";               │
 * │      const redis = new Redis({...});                                │
 * │      const rl = new Ratelimit({                                    │
 * │        redis,                                                        │
 * │        limiter: Ratelimit.slidingWindow(30, "1 m"),                 │
 * │      });                                                             │
 * │      export async function rateLimit(id: string) {                  │
 * │        const { success, remaining } = await rl.limit(id);           │
 * │        return { allowed: success, remaining };                       │
 * │      }                                                               │
 * │                                                                     │
 * │ See docs/SCALE.md for the full migration guide.                    │
 * └─────────────────────────────────────────────────────────────────────┘
 */

interface Window {
  count:   number;
  resetAt: number;
}

const store = new Map<string, Window>();
const DEFAULT_LIMIT  = 30;
const DEFAULT_WINDOW = 60_000; // 1 minute

export function rateLimit(
  identifier: string,
  { limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW }: { limit?: number; windowMs?: number } = {}
): { allowed: boolean; remaining: number } {
  const now      = Date.now();
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
