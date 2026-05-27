/**
 * Provider-agnostic AI wrapper.
 *
 * Uses the OpenAI SDK pointed at Groq's OpenAI-compatible endpoint by default.
 * Override via env:
 *   LLM_API_KEY      — Groq API key (gsk_...)
 *   LLM_BASE_URL     — defaults to https://api.groq.com/openai/v1
 *   LLM_MODEL_FAST   — cheap/fast model for qualification (default: llama-3.1-8b-instant)
 *   LLM_MODEL_SMART  — quality model for drafts (default: llama-3.3-70b-versatile)
 */

import OpenAI from "openai";
import { buildQualifyPrompt } from "@/prompts/qualify";
import { buildDraftPrompt } from "@/prompts/draft";
import { createServiceClient } from "@/lib/supabase/server";

// ── Client ──────────────────────────────────────────────────────
const client = new OpenAI({
  apiKey:  process.env.LLM_API_KEY  ?? "no-key",
  baseURL: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
  maxRetries: 2,
  timeout:    20_000,
});

const MODEL_FAST  = process.env.LLM_MODEL_FAST  ?? "llama-3.1-8b-instant";
const MODEL_SMART = process.env.LLM_MODEL_SMART ?? "llama-3.3-70b-versatile";

// ── Pricing (INR/token) — approximate Groq retail at ₹85/USD ───
// llama-3.1-8b:         $0.05/1M in, $0.08/1M out
// llama-3.3-70b:        $0.59/1M in, $0.79/1M out
const PRICE: Record<string, { in: number; out: number }> = {};
Object.defineProperty(PRICE, MODEL_FAST,  { get: () => ({ in: 0.00000425, out: 0.0000068  }), enumerable: true });
Object.defineProperty(PRICE, MODEL_SMART, { get: () => ({ in: 0.0000501,  out: 0.0000671  }), enumerable: true });

function priceFor(model: string) {
  return PRICE[model] ?? { in: 0.000005, out: 0.000008 };
}

// ── Public types ─────────────────────────────────────────────────
export type AiLeadStage = "cold" | "warm" | "hot";

export interface QualifyResult {
  score:     number;
  stage:     AiLeadStage;
  reasoning: string;
  tokensIn:  number;
  tokensOut: number;
  costInr:   number;
}

export interface DraftResult {
  content:   string;
  tokensIn:  number;
  tokensOut: number;
  costInr:   number;
}

type ConvMsg     = { direction: "inbound" | "outbound"; content: string; sent_at?: string };
type VoiceProf   = {
  tone: string; offer: string; price_range: string;
  sells: string; objections: string[]; extra_context: string;
} | null;

// ── qualifyLead ──────────────────────────────────────────────────
export async function qualifyLead(params: {
  messages:     ConvMsg[];
  voiceProfile: VoiceProf;
  orgId:        string;
}): Promise<QualifyResult> {
  if (!process.env.LLM_API_KEY) {
    console.warn("[ai] LLM_API_KEY not set — skipping qualification.");
    return { score: 20, stage: "cold", reasoning: "No LLM key configured.", tokensIn: 0, tokensOut: 0, costInr: 0 };
  }

  const { system, user } = buildQualifyPrompt({
    messages: params.messages,
    voiceProfile: params.voiceProfile
      ? { tone: params.voiceProfile.tone, offer: params.voiceProfile.offer,
          sells: params.voiceProfile.sells, objections: params.voiceProfile.objections }
      : null,
  });

  const response = await client.chat.completions.create({
    model:           MODEL_FAST,
    max_tokens:      220,
    temperature:     0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user   },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: { score?: unknown; reasoning?: unknown } = {};
  try { parsed = JSON.parse(raw); } catch { /* fallback to defaults */ }

  const score    = Math.max(0, Math.min(100, Number(parsed.score ?? 20)));
  const stage: AiLeadStage = score >= 70 ? "hot" : score >= 30 ? "warm" : "cold";
  const tokensIn  = response.usage?.prompt_tokens     ?? 0;
  const tokensOut = response.usage?.completion_tokens ?? 0;
  const p = priceFor(MODEL_FAST);
  const costInr = tokensIn * p.in + tokensOut * p.out;

  console.log(`[ai:qualify] score=${score} stage=${stage} tokens=${tokensIn}+${tokensOut} cost=₹${costInr.toFixed(4)}`);
  await incrementUsage(params.orgId, tokensIn, tokensOut, costInr);

  return {
    score, stage,
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    tokensIn, tokensOut, costInr,
  };
}

// ── draftReply ───────────────────────────────────────────────────
export async function draftReply(params: {
  messages:     ConvMsg[];
  voiceProfile: VoiceProf;
  score:        number;
  stage:        string;
  orgId:        string;
}): Promise<DraftResult> {
  if (!process.env.LLM_API_KEY) {
    console.warn("[ai] LLM_API_KEY not set — skipping draft.");
    return { content: "Thanks for reaching out! I'd love to chat more about how we can work together.", tokensIn: 0, tokensOut: 0, costInr: 0 };
  }

  const { system, user } = buildDraftPrompt({
    messages:     params.messages,
    voiceProfile: params.voiceProfile,
    score:        params.score,
    stage:        params.stage,
  });

  const response = await client.chat.completions.create({
    model:       MODEL_SMART,
    max_tokens:  320,
    temperature: 0.72,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user   },
    ],
  });

  const content   = response.choices[0]?.message?.content?.trim() ?? "…";
  const tokensIn  = response.usage?.prompt_tokens     ?? 0;
  const tokensOut = response.usage?.completion_tokens ?? 0;
  const p = priceFor(MODEL_SMART);
  const costInr = tokensIn * p.in + tokensOut * p.out;

  console.log(`[ai:draft] tokens=${tokensIn}+${tokensOut} cost=₹${costInr.toFixed(4)}`);
  await incrementUsage(params.orgId, tokensIn, tokensOut, costInr);

  return { content, tokensIn, tokensOut, costInr };
}

// ── incrementUsage ────────────────────────────────────────────────
async function incrementUsage(
  orgId: string, tokensIn: number, tokensOut: number, costInr: number
) {
  try {
    const service = createServiceClient();
    const month = new Date().toISOString().slice(0, 7) + "-01"; // "YYYY-MM-01"

    const { data: existing } = await service
      .from("ai_usage")
      .select("tokens_in, tokens_out, cost_inr")
      .eq("org_id", orgId)
      .eq("month", month)
      .single();

    const row = existing as { tokens_in: number; tokens_out: number; cost_inr: number } | null;

    if (row) {
      await service.from("ai_usage").update({
        tokens_in:  row.tokens_in  + tokensIn,
        tokens_out: row.tokens_out + tokensOut,
        cost_inr:   Number(row.cost_inr) + costInr,
      }).eq("org_id", orgId).eq("month", month);
    } else {
      await service.from("ai_usage").insert({
        org_id: orgId, month, tokens_in: tokensIn, tokens_out: tokensOut, cost_inr: costInr,
      });
    }

    // Increment org-level totals
    const { data: org } = await service
      .from("orgs")
      .select("ai_tokens_used, ai_cost_inr")
      .eq("id", orgId)
      .single();

    const orgRow = org as { ai_tokens_used: number; ai_cost_inr: number } | null;
    if (orgRow) {
      await service.from("orgs").update({
        ai_tokens_used: (orgRow.ai_tokens_used ?? 0) + tokensIn + tokensOut,
        ai_cost_inr:    Number(orgRow.ai_cost_inr ?? 0) + costInr,
      }).eq("id", orgId);
    }
  } catch (err) {
    // Non-fatal — don't block the main flow
    console.error("[ai] incrementUsage failed:", err);
  }
}
