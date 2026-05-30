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
import { buildQualifyPrompt }        from "@/prompts/qualify";
import { buildDraftPrompt }          from "@/prompts/draft";
import { buildRevivalPrompt }        from "@/prompts/revival";
import { buildBookingConfirmPrompt } from "@/prompts/booking-confirm";
import { buildPaymentLinkPrompt }    from "@/prompts/payment-link";
import { createServiceClient } from "@/lib/supabase/server";
import { isTrialExpired, getPlanLimits } from "@/lib/plan";
import { getAccessState }               from "@/lib/access";

// ── Plan-gating error ─────────────────────────────────────────────
export class AiBlockedError extends Error {
  constructor(public reason: "trial_expired" | "limit_reached" | "cancelled") {
    super(`AI blocked: ${reason}`);
    this.name = "AiBlockedError";
  }
}

/**
 * Asserts the org can make another AI reply. Throws AiBlockedError if not.
 * Also auto-resets the monthly counter when the month rolls over, and
 * increments it for this call.
 */
async function assertAiNotBlocked(orgId: string): Promise<void> {
  const service = createServiceClient();

  const { data } = await service
    .from("orgs")
    .select("plan, trial_ends_at, monthly_ai_msg_count, ai_msgs_reset_at, subscription_status")
    .eq("id", orgId)
    .single();

  if (!data) return; // Unknown org — don't block; let the insert fail downstream

  const org = data as {
    plan: string;
    trial_ends_at: string | null;
    monthly_ai_msg_count: number;
    ai_msgs_reset_at: string;
    subscription_status: string;
  };

  // Auto-reset when month rolls over
  const resetAt = new Date(org.ai_msgs_reset_at);
  const now = new Date();
  if (resetAt.getFullYear() !== now.getFullYear() || resetAt.getMonth() !== now.getMonth()) {
    await service.from("orgs").update({
      monthly_ai_msg_count: 1,
      ai_msgs_reset_at: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    }).eq("id", orgId);
    return; // Fresh month — not blocked
  }

  // Use canonical access state for consistent gating
  const access = await getAccessState(orgId);

  if (!access.canSendAi) {
    const reason = access.reason ?? "cancelled";
    throw new AiBlockedError(
      reason === "trial_expired" ? "trial_expired" :
      reason === "limit_reached" ? "limit_reached" :
      "cancelled"
    );
  }

  // Increment counter (pre-charge before the API call to avoid over-usage on retries)
  await service.from("orgs").update({
    monthly_ai_msg_count: org.monthly_ai_msg_count + 1,
  }).eq("id", orgId);
}

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
      ? {
          tone:        params.voiceProfile.tone,
          offer:       params.voiceProfile.offer,
          price_range: params.voiceProfile.price_range,
          sells:       params.voiceProfile.sells,
          objections:  params.voiceProfile.objections,
        }
      : null,
  });

  const response = await client.chat.completions.create({
    model:           MODEL_FAST,
    max_tokens:      120,          // label response is short
    temperature:     0.0,          // deterministic scoring
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user   },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: { score?: unknown; stage?: unknown; reasoning?: unknown } = {};
  try { parsed = JSON.parse(raw); } catch { /* fallback to defaults */ }

  // Model returns score/stage as "hot" | "warm" | "cold" labels
  const VALID_STAGES: AiLeadStage[] = ["hot", "warm", "cold"];
  const rawStage = (
    typeof parsed.stage === "string" ? parsed.stage :
    typeof parsed.score === "string" ? parsed.score : "cold"
  ).toLowerCase().trim() as string;

  const stage: AiLeadStage = VALID_STAGES.includes(rawStage as AiLeadStage)
    ? (rawStage as AiLeadStage)
    : "cold";

  // Map label → representative numeric score for draft prompt context + UI
  const SCORE_MAP: Record<AiLeadStage, number> = { hot: 85, warm: 50, cold: 15 };
  const score = SCORE_MAP[stage];

  const tokensIn  = response.usage?.prompt_tokens     ?? 0;
  const tokensOut = response.usage?.completion_tokens ?? 0;
  const p = priceFor(MODEL_FAST);
  const costInr = tokensIn * p.in + tokensOut * p.out;

  console.log(`[ai:qualify] stage=${stage} score=${score} tokens=${tokensIn}+${tokensOut} cost=₹${costInr.toFixed(4)}`);
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
  calLink?:     string | null;
}): Promise<DraftResult> {
  if (!process.env.LLM_API_KEY) {
    console.warn("[ai] LLM_API_KEY not set — skipping draft.");
    return { content: "Thanks for reaching out! I'd love to chat more about how we can work together.", tokensIn: 0, tokensOut: 0, costInr: 0 };
  }

  // Gate on plan limits — throws AiBlockedError if over limit / trial expired
  await assertAiNotBlocked(params.orgId);

  const { system, user } = buildDraftPrompt({
    messages:     params.messages,
    voiceProfile: params.voiceProfile,
    score:        params.score,
    stage:        params.stage,
    calLink:      params.calLink,
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

// ── generateRevivalNudge ─────────────────────────────────────
export interface RevivalResult {
  content:   string;
  tokensIn:  number;
  tokensOut: number;
  costInr:   number;
}

type VoiceProf4 = {
  tone: string; offer: string; sells: string;
  objections: string[]; extra_context: string;
} | null;

export async function generateRevivalNudge(params: {
  messages:     { direction: "inbound" | "outbound"; content: string }[];
  voiceProfile: VoiceProf4;
  inactiveDays: number;
  attempt:      1 | 2 | 3;
  orgId:        string;
  calLink?:     string | null;
}): Promise<RevivalResult> {
  if (!process.env.LLM_API_KEY) {
    console.warn("[ai] LLM_API_KEY not set — skipping revival nudge.");
    return {
      content:   "Hey! It's been a while — just wanted to check in and see how things are going. Are you still interested in connecting?",
      tokensIn: 0, tokensOut: 0, costInr: 0,
    };
  }

  // Gate on plan limits
  await assertAiNotBlocked(params.orgId);

  const { system, user } = buildRevivalPrompt({
    messages:     params.messages,
    voiceProfile: params.voiceProfile,
    inactiveDays: params.inactiveDays,
    attempt:      params.attempt,
    calLink:      params.calLink,
  });

  const response = await client.chat.completions.create({
    model:       MODEL_SMART,
    max_tokens:  200,
    temperature: 0.85,
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

  console.log(`[ai:revival] attempt=${params.attempt} tokens=${tokensIn}+${tokensOut} cost=₹${costInr.toFixed(4)}`);
  await incrementUsage(params.orgId, tokensIn, tokensOut, costInr);

  return { content, tokensIn, tokensOut, costInr };
}

// ── generateBookingConfirmMessage ─────────────────────────────────
/**
 * Generates a short (~35 word) booking confirmation message.
 * Includes the meeting URL verbatim when provided.
 * Uses the LLM_API_KEY; falls back to a template when the key is absent.
 */
export async function generateBookingConfirmMessage(params: {
  leadFirstName:        string;
  meetingTimeFormatted: string;
  meetingUrl:           string | null;
  voiceProfile:         VoiceProf;
  orgId:                string;
}): Promise<DraftResult> {
  if (!process.env.LLM_API_KEY) {
    const urlPart = params.meetingUrl ? ` ${params.meetingUrl}.` : " The meeting link will be sent shortly.";
    const name    = params.leadFirstName ? `, ${params.leadFirstName}` : "";
    return {
      content:   `Done${name}. ${params.meetingTimeFormatted} is locked in.${urlPart} Talk soon.`,
      tokensIn:  0, tokensOut: 0, costInr: 0,
    };
  }

  // NOTE: intentionally NO assertAiNotBlocked here.
  // Booking confirmation messages are operational (not AI reply quota).

  const { system, user } = buildBookingConfirmPrompt({
    leadFirstName:        params.leadFirstName,
    meetingTimeFormatted: params.meetingTimeFormatted,
    meetingUrl:           params.meetingUrl,
    coachTone:            params.voiceProfile?.tone  ?? "",
    coachOffer:           params.voiceProfile?.offer ?? "",
  });

  try {
    const response = await client.chat.completions.create({
      model:       MODEL_SMART,
      max_tokens:  100,
      temperature: 0.75,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: user   },
      ],
    });

    const content   = response.choices[0]?.message?.content?.trim() ?? "…";
    const tokensIn  = response.usage?.prompt_tokens     ?? 0;
    const tokensOut = response.usage?.completion_tokens ?? 0;
    const p         = priceFor(MODEL_SMART);
    const costInr   = tokensIn * p.in + tokensOut * p.out;

    console.log(`[ai:booking-confirm] tokens=${tokensIn}+${tokensOut} cost=₹${costInr.toFixed(4)}`);
    await incrementUsage(params.orgId, tokensIn, tokensOut, costInr);

    return { content, tokensIn, tokensOut, costInr };
  } catch (err) {
    console.error("[ai:booking-confirm] LLM call failed, using template fallback:", err);
    const urlPart = params.meetingUrl ? ` ${params.meetingUrl}.` : " The meeting link will be sent shortly.";
    const name    = params.leadFirstName ? `, ${params.leadFirstName}` : "";
    return {
      content:  `Done${name}. ${params.meetingTimeFormatted} is locked in.${urlPart} Talk soon.`,
      tokensIn: 0, tokensOut: 0, costInr: 0,
    };
  }
}

// ── generatePaymentLinkMessage ─────────────────────────────────────
/**
 * Generates a short (~35 word) message to accompany a payment link.
 * The payment URL MUST appear verbatim in the output.
 * Falls back to a template when LLM_API_KEY is absent.
 */
export async function generatePaymentLinkMessage(params: {
  leadFirstName: string;
  amountInr:     number;
  description:   string;
  paymentUrl:    string;
  voiceProfile:  VoiceProf;
  orgId:         string;
}): Promise<DraftResult> {
  if (!process.env.LLM_API_KEY) {
    const name   = params.leadFirstName ? `, ${params.leadFirstName}` : "";
    const amount = `₹${params.amountInr.toLocaleString("en-IN")}`;
    return {
      content:   `Here you go${name}. ${amount} for ${params.description}: ${params.paymentUrl} Takes 30 seconds.`,
      tokensIn:  0, tokensOut: 0, costInr: 0,
    };
  }

  // NOTE: intentionally NO assertAiNotBlocked here.
  // Payment link messages are operational (not AI reply quota).

  const { system, user } = buildPaymentLinkPrompt({
    leadFirstName: params.leadFirstName,
    amountInr:     params.amountInr,
    description:   params.description,
    paymentUrl:    params.paymentUrl,
    coachTone:     params.voiceProfile?.tone  ?? "",
    coachOffer:    params.voiceProfile?.offer ?? "",
  });

  let content: string;
  let tokensIn = 0, tokensOut = 0, costInr = 0;

  try {
    const response = await client.chat.completions.create({
      model:       MODEL_SMART,
      max_tokens:  100,
      temperature: 0.75,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: user   },
      ],
    });

    content  = response.choices[0]?.message?.content?.trim() ?? "…";
    tokensIn  = response.usage?.prompt_tokens     ?? 0;
    tokensOut = response.usage?.completion_tokens ?? 0;
    const p  = priceFor(MODEL_SMART);
    costInr  = tokensIn * p.in + tokensOut * p.out;
    console.log(`[ai:payment-link] tokens=${tokensIn}+${tokensOut} cost=₹${costInr.toFixed(4)}`);
    await incrementUsage(params.orgId, tokensIn, tokensOut, costInr);
  } catch (err) {
    console.error("[ai:payment-link] LLM call failed, using template fallback:", err);
    const name   = params.leadFirstName ? `, ${params.leadFirstName}` : "";
    const amount = `₹${params.amountInr.toLocaleString("en-IN")}`;
    content = `Here you go${name}. ${amount} for ${params.description}: ${params.paymentUrl} Takes 30 seconds.`;
  }

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
