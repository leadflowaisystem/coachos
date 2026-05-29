/**
 * Plan limits for CoachOS subscription tiers.
 * Trial mirrors Growth limits.
 */

export type PlanTier = "trial" | "starter" | "growth" | "pro" | "cancelled";

export const PLAN_PRICES: Record<string, number> = {
  starter: 2999,
  growth:  7999,
  pro:     19999,
};

export const PLAN_NAMES: Record<string, string> = {
  trial:     "Trial",
  starter:   "Starter",
  growth:    "Growth",
  pro:       "Pro",
  cancelled: "Cancelled",
};

export interface PlanLimits {
  aiMsgsPerMonth:    number;   // -1 = unlimited
  seatsAllowed:      number;   // -1 = unlimited
  channelsAllowed:   number;   // -1 = unlimited
}

const LIMITS: Record<PlanTier, PlanLimits> = {
  trial:     { aiMsgsPerMonth: 2000, seatsAllowed: 3,  channelsAllowed: 2  },
  starter:   { aiMsgsPerMonth: 500,  seatsAllowed: 1,  channelsAllowed: 1  },
  growth:    { aiMsgsPerMonth: 2000, seatsAllowed: 3,  channelsAllowed: 2  },
  pro:       { aiMsgsPerMonth: 8000, seatsAllowed: -1, channelsAllowed: -1 },
  cancelled: { aiMsgsPerMonth: 0,   seatsAllowed: 1,  channelsAllowed: 1  },
};

export function getPlanLimits(plan: string): PlanLimits {
  return LIMITS[(plan as PlanTier)] ?? LIMITS.starter;
}

export function isTrialExpired(plan: string, trialEndsAt: string | null): boolean {
  if (plan !== "trial") return false;
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) < new Date();
}

export function isAiBlocked(
  plan: string,
  trialEndsAt: string | null,
  monthlyMsgCount: number,
): boolean {
  if (isTrialExpired(plan, trialEndsAt)) return true;
  const limits = getPlanLimits(plan);
  if (limits.aiMsgsPerMonth === 0) return true;
  if (limits.aiMsgsPerMonth === -1) return false;
  return monthlyMsgCount >= limits.aiMsgsPerMonth;
}

export const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    "500 AI replies/month",
    "1 Instagram channel",
    "Booking automation",
    "Payment dunning",
    "1 seat",
    "Email support",
  ],
  growth: [
    "2,000 AI replies/month",
    "ManyChat + Instagram via ManyChat",
    "Everything in Starter",
    "Ghost revival sequences",
    "3 seats",
    "Priority support",
    "WhatsApp — coming Q3 2026",
  ],
  pro: [
    "8,000 AI replies/month",
    "Unlimited channels",
    "Everything in Growth",
    "Agency mode (manage client orgs)",
    "Unlimited seats",
    "Dedicated support + onboarding",
  ],
};
