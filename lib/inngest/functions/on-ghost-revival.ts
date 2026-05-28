/**
 * Inngest function: lead.ghost_revival
 *
 * Fires when a lead has gone inactive and a revival sequence is triggered.
 * Sends 2–3 AI-personalised nudges from the conversation transcript + voice profile.
 * Stops automatically if the lead replies between nudges.
 * Also stops if the sequence_run row is set to 'stopped' from the UI.
 *
 * Env:
 *   TEST_REVIVAL_DELAY_MS — ms between nudges instead of 3 days (dev testing)
 */

import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { sendChannelMessage, getCalLink } from "@/lib/booking";
import { generateRevivalNudge } from "@/lib/ai";

interface GhostRevivalData {
  orgId:          string;
  leadId:         string;
  conversationId: string;
  sequenceRunId:  string;
  startedAt:      string;  // ISO — used to detect new inbound messages
  inactiveDays:   number;
}

const TOTAL_NUDGES = 3;

export const onGhostRevival = inngest.createFunction(
  {
    id:      "on-ghost-revival",
    name:    "Ghost Revival: re-engage inactive lead",
    retries: 1,
  },
  { event: "lead.ghost_revival" },
  async ({ event, step }) => {
    const {
      orgId, leadId, conversationId, sequenceRunId, startedAt, inactiveDays,
    } = event.data as GhostRevivalData;

    const delayMs = process.env.TEST_REVIVAL_DELAY_MS
      ? parseInt(process.env.TEST_REVIVAL_DELAY_MS, 10)
      : 3 * 24 * 60 * 60 * 1000; // 3 days

    // ── Load context ─────────────────────────────────────────────
    const ctx = await step.run("load-revival-context", async () => {
      const svc = createServiceClient();
      const [msgRes, voiceRes, calLinkRes] = await Promise.all([
        svc.from("messages")
           .select("direction, content")
           .eq("conversation_id", conversationId)
           .order("sent_at", { ascending: true })
           .limit(20),
        svc.from("voice_profiles")
           .select("tone, offer, sells, objections, extra_context")
           .eq("org_id", orgId)
           .single(),
        getCalLink(orgId),
      ]);

      return {
        messages:    (msgRes.data ?? []) as { direction: "inbound" | "outbound"; content: string }[],
        voiceProfile: voiceRes.data as {
          tone: string; offer: string; sells: string;
          objections: string[]; extra_context: string;
        } | null,
        calLink: calLinkRes,
      };
    });

    // ── Helper: check if sequence was stopped from UI ─────────────
    async function isStopped(): Promise<boolean> {
      const svc = createServiceClient();
      const { data } = await svc
        .from("sequence_runs")
        .select("status")
        .eq("id", sequenceRunId)
        .single();
      return (data as { status: string } | null)?.status !== "active";
    }

    // ── Helper: check if lead replied after sequence started ──────
    async function hasReplied(): Promise<boolean> {
      const svc = createServiceClient();
      const { data } = await svc
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("direction", "inbound")
        .gt("sent_at", startedAt)
        .limit(1);
      return (data?.length ?? 0) > 0;
    }

    async function markStopped(reason: "replied" | "stopped_manually") {
      const svc = createServiceClient();
      const now = new Date().toISOString();
      await svc.from("sequence_runs").update({
        status:     "stopped",
        stopped_at: now,
        updated_at: now,
        metadata:   { stop_reason: reason },
      }).eq("id", sequenceRunId);
    }

    async function updateStep(n: number, status?: "completed") {
      const svc = createServiceClient();
      await svc.from("sequence_runs").update({
        step_current: n,
        ...(status ? { status } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", sequenceRunId);
    }

    // ── Nudge 1 ───────────────────────────────────────────────────
    const s1 = await step.run("check-before-1", isStopped);
    if (s1) return { outcome: "stopped_before_nudge_1" };

    const r1 = await step.run("check-replied-1", hasReplied);
    if (r1) {
      await step.run("stop-on-reply-1", () => markStopped("replied"));
      return { outcome: "replied", nudge: 1 };
    }

    const nudge1 = await step.run("gen-nudge-1", () =>
      generateRevivalNudge({
        messages: ctx.messages, voiceProfile: ctx.voiceProfile,
        inactiveDays, attempt: 1, orgId, calLink: ctx.calLink,
      })
    );
    await step.run("send-nudge-1", async () => {
      await sendChannelMessage(conversationId, orgId, nudge1.content, "system");
      await updateStep(1);
    });

    // ── Nudge 2 ───────────────────────────────────────────────────
    await step.sleep("wait-nudge-2", delayMs);

    const s2 = await step.run("check-before-2", isStopped);
    if (s2) return { outcome: "stopped_before_nudge_2" };

    const r2 = await step.run("check-replied-2", hasReplied);
    if (r2) {
      await step.run("stop-on-reply-2", () => markStopped("replied"));
      return { outcome: "replied", nudge: 2 };
    }

    const nudge2 = await step.run("gen-nudge-2", () =>
      generateRevivalNudge({
        messages: ctx.messages, voiceProfile: ctx.voiceProfile,
        inactiveDays, attempt: 2, orgId, calLink: ctx.calLink,
      })
    );
    await step.run("send-nudge-2", async () => {
      await sendChannelMessage(conversationId, orgId, nudge2.content, "system");
      await updateStep(2);
    });

    // ── Nudge 3 ───────────────────────────────────────────────────
    await step.sleep("wait-nudge-3", delayMs);

    const s3 = await step.run("check-before-3", isStopped);
    if (s3) return { outcome: "stopped_before_nudge_3" };

    const r3 = await step.run("check-replied-3", hasReplied);
    if (r3) {
      await step.run("stop-on-reply-3", () => markStopped("replied"));
      return { outcome: "replied", nudge: 3 };
    }

    const nudge3 = await step.run("gen-nudge-3", () =>
      generateRevivalNudge({
        messages: ctx.messages, voiceProfile: ctx.voiceProfile,
        inactiveDays, attempt: 3, orgId, calLink: ctx.calLink,
      })
    );
    await step.run("send-nudge-3", async () => {
      await sendChannelMessage(conversationId, orgId, nudge3.content, "system");
      await updateStep(TOTAL_NUDGES, "completed");
    });

    console.log(`[revival] sequence ${sequenceRunId} completed for lead ${leadId}`);
    return { outcome: "completed", nudges: TOTAL_NUDGES };
  }
);
