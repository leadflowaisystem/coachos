/**
 * lib/access.ts — single source of truth for org feature access.
 *
 * Call getAccessState(orgId) from any server context. The return value
 * drives every gate: AI replies, channel connections, agency features.
 *
 * Designed to be cacheable (60s Upstash TTL in lib/cache.ts) so per-request
 * DB cost is minimal for high-traffic orgs.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getPlanLimits }       from "@/lib/plan";

export interface AccessState {
  status:              "trial_active" | "trial_expired" | "subscribed" | "cancelled" | "past_due";
  plan:                "trial" | "starter" | "growth" | "pro" | null;
  trialDaysLeft:       number | null;
  canSendAi:           boolean;
  canUseAgency:        boolean;
  canConnectChannels:  number;       // -1 = unlimited
  aiMsgsUsedThisMonth: number;
  aiMsgsLimit:         number;       // -1 = unlimited
  reason?:             "trial_expired" | "limit_reached" | "cancelled" | "past_due";
}

type OrgRow = {
  plan:                 string;
  trial_ends_at:        string | null;
  subscription_status:  string;
  monthly_ai_msg_count: number;
  ai_msgs_reset_at:     string;
};

function buildState(org: OrgRow): AccessState {
  const now          = new Date();
  const plan         = org.plan as string;
  const subStatus    = org.subscription_status; // trialing | active | cancelled | past_due | halted
  const trialEndsAt  = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const trialExpired = plan === "trial" && !!trialEndsAt && trialEndsAt < now;
  const trialDaysLeft = (plan === "trial" && trialEndsAt && !trialExpired)
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000))
    : null;

  // ── Determine status ──────────────────────────────────────────
  let status: AccessState["status"];
  if (plan === "trial") {
    status = trialExpired ? "trial_expired" : "trial_active";
  } else if (plan === "cancelled" || subStatus === "cancelled" || subStatus === "halted") {
    status = "cancelled";
  } else if (subStatus === "past_due") {
    status = "past_due";
  } else {
    status = "subscribed";
  }

  // ── Derive feature gates ──────────────────────────────────────
  const limits = getPlanLimits(plan ?? "cancelled");

  let canSendAi          = false;
  let canUseAgency       = false;
  let canConnectChannels = 0;
  let reason: AccessState["reason"];

  switch (status) {
    case "trial_active":
      // Trial mirrors Growth features (2000 msgs, 3 seats, 2 channels)
      canSendAi          = org.monthly_ai_msg_count < 2000;
      canUseAgency       = false;   // agency is Pro-only
      canConnectChannels = 2;
      if (!canSendAi) reason = "limit_reached";
      break;

    case "trial_expired":
      canSendAi          = false;
      canConnectChannels = 0;
      reason             = "trial_expired";
      break;

    case "subscribed":
      canSendAi = limits.aiMsgsPerMonth === -1
        ? true
        : org.monthly_ai_msg_count < limits.aiMsgsPerMonth;
      canUseAgency       = plan === "pro";
      canConnectChannels = limits.channelsAllowed;
      if (!canSendAi) reason = "limit_reached";
      break;

    case "cancelled":
      canSendAi          = false;
      canConnectChannels = 1;   // keep read-only, 1 channel
      reason             = "cancelled";
      break;

    case "past_due":
      canSendAi          = false;
      canConnectChannels = limits.channelsAllowed;  // don't lock channels on grace period
      reason             = "past_due";
      break;
  }

  return {
    status,
    plan:                (plan ?? null) as AccessState["plan"],
    trialDaysLeft,
    canSendAi,
    canUseAgency,
    canConnectChannels,
    aiMsgsUsedThisMonth: org.monthly_ai_msg_count,
    aiMsgsLimit:         status === "trial_active" ? 2000 : limits.aiMsgsPerMonth,
    reason,
  };
}

/**
 * Fetch the org's current access state from the DB.
 * Cache at the call site (60 s) for high-frequency paths.
 */
export async function getAccessState(orgId: string): Promise<AccessState> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("orgs")
    .select("plan, trial_ends_at, subscription_status, monthly_ai_msg_count, ai_msgs_reset_at")
    .eq("id", orgId)
    .single();

  if (!data) {
    // Unknown org — default to blocked
    return {
      status:              "cancelled",
      plan:                null,
      trialDaysLeft:       null,
      canSendAi:           false,
      canUseAgency:        false,
      canConnectChannels:  0,
      aiMsgsUsedThisMonth: 0,
      aiMsgsLimit:         0,
      reason:              "cancelled",
    };
  }

  return buildState(data as OrgRow);
}

/**
 * Lightweight version — returns only the canSendAi flag.
 * Slightly faster than getAccessState() when full state isn't needed.
 */
export async function canOrgSendAi(orgId: string): Promise<boolean> {
  const state = await getAccessState(orgId);
  return state.canSendAi;
}
