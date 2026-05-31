/**
 * PATCH /api/orgs/[orgId]/coach/commitments/[commitmentId]
 * Update commitment status (done | partial | missed | pending) + optional note.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import { z } from "zod";

interface Params { params: { orgId: string; commitmentId: string } }

async function assertMember(orgId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("org_members").select("role")
    .eq("org_id", orgId).eq("user_id", user.id).single();
  return data ? user : null;
}

const PatchSchema = z.object({
  status: z.enum(["pending","done","partial","missed"]),
  notes:  z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await assertMember(params.orgId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw    = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.notes !== undefined) updates.notes = sanitizeText(parsed.data.notes);
  if (parsed.data.status === "done")   updates.completed_at = now;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any;
  const { data, error } = await svc
    .from("coach_commitments")
    .update(updates)
    .eq("id", params.commitmentId)
    .eq("org_id", params.orgId)
    .select("*")
    .single();

  if (error) {
    console.error("[coach/commitments PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ commitment: data });
}
