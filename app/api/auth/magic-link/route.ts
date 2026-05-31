/**
 * POST /api/auth/magic-link
 *
 * Server-side magic link sender with:
 * - Rate limit: 5 requests per 15 min per IP
 * - Disposable email blocklist
 * - Audit log entry
 * - Delegates actual send to Supabase (signInWithOtp via admin client)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimitAsync, getIp } from "@/lib/ratelimit";
import { isDisposableEmail } from "@/lib/disposable-domains";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const Schema = z.object({
  email:       z.string().email("Invalid email address").max(254),
  redirectTo:  z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const ip = getIp(req);

  // Rate limit: 5 magic-link requests per IP per 15 min
  const rl = await rateLimitAsync(`magic-link:${ip}`, { limit: 5, windowMs: 15 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait 15 minutes before trying again." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { email, redirectTo } = parsed.data;

  // Reject disposable email domains
  if (isDisposableEmail(email)) {
    return NextResponse.json(
      { error: "Please use a permanent email address. Disposable email addresses are not accepted." },
      { status: 400 }
    );
  }

  const svc = createServiceClient();

  // Send magic link via Supabase (service role bypasses email-send restrictions)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://coachos-pi.vercel.app";
  const { error } = await svc.auth.admin.generateLink({
    type:    "magiclink",
    email,
    options: { redirectTo: redirectTo ?? `${appUrl}/auth/callback` },
  });

  // Always log the attempt (success or failure)
  void logAudit(svc, null, null, "auth.magic_link_request", {
    email_domain: email.split("@")[1],
    ip,
    user_agent: req.headers.get("user-agent")?.slice(0, 200),
    success: !error,
  });

  if (error) {
    console.error("[magic-link] Supabase error:", error.message);
    // Don't expose internal errors — return generic message
    return NextResponse.json({ error: "Could not send magic link. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
