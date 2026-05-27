/**
 * GET   /api/orgs/[orgId]/voice  — read voice profile
 * PUT   /api/orgs/[orgId]/voice  — upsert voice profile
 *
 * Voice profile is stored 1-per-org in the voice_profiles table.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

interface Params { params: { orgId: string } }

async function assertMember(orgId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();
  return data ? user : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await assertMember(params.orgId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data } = await service
    .from("voice_profiles")
    .select("*")
    .eq("org_id", params.orgId)
    .single();

  // Return null if not yet created — client shows empty form
  return NextResponse.json({ voiceProfile: data ?? null });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await assertMember(params.orgId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const fields: {
    tone?: string;
    offer?: string;
    price_range?: string;
    sells?: string;
    objections?: string[];
    extra_context?: string;
  } = {};
  if ("tone"          in body) fields.tone          = body.tone          as string;
  if ("offer"         in body) fields.offer         = body.offer         as string;
  if ("price_range"   in body) fields.price_range   = body.price_range   as string;
  if ("sells"         in body) fields.sells         = body.sells         as string;
  if ("objections"    in body) fields.objections    = body.objections    as string[];
  if ("extra_context" in body) fields.extra_context = body.extra_context as string;

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No fields provided" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const service = createServiceClient();

  const { data: existing } = await service
    .from("voice_profiles")
    .select("id")
    .eq("org_id", params.orgId)
    .single();

  let result;
  if (existing) {
    result = await service
      .from("voice_profiles")
      .update({ ...fields, updated_at: now })
      .eq("org_id", params.orgId)
      .select("*")
      .single();
  } else {
    result = await service
      .from("voice_profiles")
      .insert({ org_id: params.orgId, ...fields, updated_at: now })
      .select("*")
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ voiceProfile: result.data });
}
