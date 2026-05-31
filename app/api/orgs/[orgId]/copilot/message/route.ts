/**
 * POST /api/orgs/[orgId]/copilot/message
 * Sends a message to Ace the strategic copilot.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/ratelimit";
import { z } from "zod";
import OpenAI from "openai";

export const maxDuration = 30;

interface Params { params: { orgId: string } }

async function assertMember(orgId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("org_members").select("role")
    .eq("org_id", orgId).eq("user_id", user.id).single();
  return data ? user : null;
}

const Schema = z.object({ message: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: Params) {
  const user = await assertMember(params.orgId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await rateLimitAsync(`copilot:${params.orgId}`, { limit: 60 });
  if (!allowed) return NextResponse.json({ error: "Rate limit reached." }, { status: 429 });

  const raw    = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { message } = parsed.data;
  const orgId = params.orgId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any;

  // Load context in parallel
  const [historyRes, vpRes, orgRes] = await Promise.all([
    svc.from("copilot_chats").select("role, content").eq("org_id", orgId)
      .order("created_at", { ascending: false }).limit(20),
    svc.from("voice_profiles").select("tone, offer, sells, price_range").eq("org_id", orgId).single(),
    svc.from("orgs").select("name, plan, deep_context").eq("id", orgId).single(),
  ]);

  const history = ((historyRes.data ?? []) as { role: string; content: string }[]).reverse();
  const vp = vpRes.data as { tone: string; offer: string; sells: string; price_range: string } | null;
  const org = orgRes.data as { name: string; plan: string; deep_context: Record<string,unknown> | null } | null;
  const deepCtx = org?.deep_context ?? {};

  const systemPrompt = [
    `You are Ace, a direct and sharp business advisor for ${org?.name ?? "this coaching business"}.`,
    `You are NOT a chatbot. You are a strategic partner who has looked at their numbers.`,
    `Rules:`,
    `- Never start with "Great question!" or any filler opener.`,
    `- End EVERY response with exactly one concrete next action prefixed with "→ Next action:"`,
    `- Be blunt. Short sentences. No em dashes.`,
    `- Max 150 words per response unless asked for more.`,
    ``,
    `Coach context:`,
    vp?.tone    ? `Tone: ${vp.tone}` : "",
    vp?.offer   ? `Offer: ${vp.offer}` : "",
    vp?.sells   ? `Sells: ${vp.sells}` : "",
    vp?.price_range ? `Price range: ${vp.price_range}` : "",
    deepCtx && Object.keys(deepCtx).length > 0
      ? `Deep context: ${JSON.stringify(deepCtx).slice(0, 800)}`
      : "",
  ].filter(Boolean).join("\n");

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: message },
  ];

  const apiKey  = process.env.GROQ_API_KEYS?.split(",")[0]?.trim() ?? process.env.LLM_API_KEY ?? "no-key";
  const client  = new OpenAI({ apiKey, baseURL: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1", maxRetries: 1, timeout: 20_000 });
  const resp    = await client.chat.completions.create({
    model:       process.env.LLM_MODEL_SMART ?? "llama-3.3-70b-versatile",
    max_tokens:  250,
    temperature: 0.7,
    messages,
  });

  const reply = resp.choices[0]?.message?.content?.trim() ?? "…";

  // Extract suggested action if present
  const actionMatch = reply.match(/→ Next action:(.*?)(?:\n|$)/i);
  const suggested_action = actionMatch?.[1]?.trim() ?? null;

  // Persist both messages
  await svc.from("copilot_chats").insert([
    { org_id: orgId, role: "user",      content: message },
    { org_id: orgId, role: "assistant", content: reply   },
  ]);

  return NextResponse.json({ reply, suggested_action });
}
