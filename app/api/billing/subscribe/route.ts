/**
 * POST /api/billing/subscribe
 * Body: { orgId: string, plan: "starter" | "growth" | "pro" }
 *
 * Creates a Razorpay platform subscription and returns the checkout short_url.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createPlatformSubscription } from "@/lib/platform-billing";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { orgId, plan } = body as { orgId?: string; plan?: string };

  if (!orgId || !plan || !["starter", "growth", "pro"].includes(plan)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  // Verify user is owner of this org
  const svc = createServiceClient();
  const { data: member } = await svc
    .from("org_members").select("role")
    .eq("org_id", orgId).eq("user_id", user.id).single();

  if (!member || (member as { role: string }).role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const result = await createPlatformSubscription(
    orgId,
    plan as "starter" | "growth" | "pro",
    user.email,
  );

  if (!result) {
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }

  // Persist subscription_id pending activation
  await svc.from("orgs").update({
    subscription_id:     result.subscriptionId,
    subscription_status: "created",
  }).eq("id", orgId);

  await logAudit(svc, orgId, user.id, "billing.subscribe_initiated", { plan });

  return NextResponse.json({ shortUrl: result.shortUrl });
}
