/**
 * Prompt builder for lead qualification.
 * Returns { system, user } for a JSON-mode completion.
 * The LLM must return: { "score": 0-100, "reasoning": "one sentence" }
 */

export interface QualifyInput {
  messages: Array<{ direction: "inbound" | "outbound"; content: string }>;
  voiceProfile: {
    tone: string;
    offer: string;
    sells: string;
    objections: string[];
  } | null;
}

export function buildQualifyPrompt(input: QualifyInput): {
  system: string;
  user: string;
} {
  const vp = input.voiceProfile;

  const coachContext = vp
    ? [
        `What the coach sells: ${vp.sells || "coaching services"}`,
        vp.offer ? `Core offer: ${vp.offer}` : "",
        vp.objections?.length
          ? `Common objections: ${vp.objections.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Coaching services (no profile configured yet).";

  const system = `You are a sales qualification AI for a coaching business.

CONTEXT
${coachContext}

TASK
Read the DM conversation and return a JSON object with exactly two fields:
  "score"     — integer 0 to 100 representing buying intent
  "reasoning" — one concise sentence explaining the score

SCORING GUIDE
  0–29  (cold)  : browsing, vague curiosity, no budget/urgency signals
  30–69 (warm)  : engaged, asking real questions, some buying signals
  70–100 (hot)  : clear intent, mentioned budget or urgency, ready to act

OUTPUT FORMAT
Respond ONLY with valid JSON. No markdown. No extra text. Example:
{"score":74,"reasoning":"Lead asked about pricing and mentioned a specific timeline."}`;

  const transcript = input.messages
    .map((m) => `${m.direction === "inbound" ? "LEAD" : "COACH"}: ${m.content}`)
    .join("\n");

  const user = `Conversation:\n${transcript}\n\nReturn the qualification JSON:`;

  return { system, user };
}
