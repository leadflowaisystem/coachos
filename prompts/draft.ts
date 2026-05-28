/**
 * Prompt builder for reply drafting.
 * Returns { system, user } for a plain-text completion.
 * The LLM must return ONLY the reply text — no labels, no JSON, no commentary.
 */

export interface DraftInput {
  messages: Array<{ direction: "inbound" | "outbound"; content: string }>;
  voiceProfile: {
    tone: string;
    offer: string;
    price_range: string;
    sells: string;
    objections: string[];
    extra_context: string;
  } | null;
  score:   number;
  stage:   string;
  /** Cal.com booking URL to embed in hot-lead replies. */
  calLink?: string | null;
}

export function buildDraftPrompt(input: DraftInput): {
  system: string;
  user: string;
} {
  const vp = input.voiceProfile;

  const lines: string[] = [
    `You are a DM copywriter for a coaching business. Write replies that sound natural and human — never like a bot or a sales script.`,
    ``,
    `VOICE & CONTEXT`,
    `Tone: ${vp?.tone ?? "conversational and professional"}`,
  ];
  if (vp?.sells)       lines.push(`What we sell: ${vp.sells}`);
  if (vp?.offer)       lines.push(`Our offer: ${vp.offer}`);
  if (vp?.price_range) lines.push(`Price range: ${vp.price_range}`);
  if (vp?.objections?.length)
    lines.push(`Common objections to handle gracefully: ${vp.objections.join(", ")}`);
  if (vp?.extra_context) lines.push(`Extra context: ${vp.extra_context}`);

  lines.push(``);
  lines.push(`LEAD SIGNAL`);
  const hotInstruction = input.calLink
    ? `High intent — invite them to book a discovery call. Share this link naturally: ${input.calLink}`
    : "High intent — nudge toward booking a discovery call.";

  lines.push(
    `Score: ${input.score}/100 (${input.stage}). ${
      input.stage === "hot"
        ? hotInstruction
        : "Warming up — keep them engaged, don't rush the sale."
    }`
  );

  lines.push(``);
  lines.push(`RULES`);
  lines.push(`- Keep it SHORT: 1–4 sentences maximum.`);
  lines.push(`- Match the lead's energy and vocabulary.`);
  lines.push(`- Never mention you are an AI.`);
  lines.push(`- Never start with "Hey!" if the lead didn't greet first.`);
  lines.push(`- Output ONLY the reply text. No labels, no JSON, no explanation.`);

  const transcript = input.messages
    .map((m) => `${m.direction === "inbound" ? "LEAD" : "COACH"}: ${m.content}`)
    .join("\n");

  const user = `Conversation so far:\n${transcript}\n\nWrite the coach's next reply:`;

  return { system: lines.join("\n"), user };
}
