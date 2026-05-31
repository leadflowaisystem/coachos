/**
 * POST /api/orgs/[orgId]/payments/manual
 * Records a payment that happened outside the automated flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { getAccessState } from "@/lib/access";
import { z } from "zod";

interface Params { params: { orgId: string } }

async function assertMember(orgId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("org_members").select("role")
    .eq("org_id", orgId).eq("user_id", user.id).single();
  return data ? user : null;
}

const Schema = z.object({
  lead_id:        z.string().uuid(),
  amount_inr:     z.number().positive(),
  payment_method: z.enum(["upi", "bank_transfer", "cash", "other"]),
  received_at:    z.string().datetime(),
  description:    z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const user = await assertMember(params.orgId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessState(params.orgId);
  if (!access.canUseManualBookingPayment) {
    return NextResponse.json({ error: "Manual payment recording requires Starter plan or above." }, { status: 403 });
  }

  const raw    = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { lead_id, amount_inr, payment_method, received_at, description } = parsed.data;
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any;

  // Verify lead belongs to org
  const { data: leadRow } = await svc.from("leads").select("id, ltv_inr").eq("id", lead_id).eq("org_id", params.orgId).single();
  if (!leadRow) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const lead = leadRow as { id: string; ltv_inr: number | null };

  // Insert payment row
  const { data: payment, error } = await svc.from("payments").insert({
    org_id:        params.orgId,
    lead_id,
    amount_inr,
    status:        "paid",
    notes:         description ? `${payment_method}: ${description}` : payment_method,
    source:        "manual",
    captured_at:   received_at,
    created_at:    now,
    updated_at:    now,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const p = payment as { id: string };

  // Update lead stage → won, ltv_inr += amount
  const currentLtv = lead.ltv_inr ?? 0;
  await svc.from("leads").update({
    stage:      "won",
    ltv_inr:    currentLtv + amount_inr,
    updated_at: now,
  }).eq("id", lead_id);

  // Fire payment.captured so existing handler sends confirmation
  await inngest.send({
    name: "payment.captured",
    data: { orgId: params.orgId, paymentId: p.id, leadId: lead_id },
  });

  return NextResponse.json({ payment_id: p.id });
}
