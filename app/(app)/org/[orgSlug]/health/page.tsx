import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { MessageSquare, Calendar, CreditCard, Mic, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { HealthCard, type IntegrationStatus } from "@/components/integrations/health-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeUp } from "@/components/motion/primitives";

export async function generateMetadata({ params }: { params: { orgSlug: string } }) {
  return { title: `Integration health — CoachOS` };
}

export default async function HealthPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orgData } = await supabase
    .from("orgs")
    .select("id, name, active_channel, onboarding_completed_at")
    .eq("slug", params.orgSlug)
    .single();

  const org = orgData as {
    id: string;
    name: string;
    active_channel: string;
    onboarding_completed_at: string | null;
  } | null;

  if (!org) notFound();

  // Load integrations (service role so we see all rows regardless of RLS auth context)
  const service = createServiceClient();
  const { data: intRows } = await service
    .from("integrations")
    .select("provider, active, updated_at")
    .eq("org_id", org.id);

  const intMap = Object.fromEntries(
    (intRows ?? []).map((r) => [r.provider, r])
  ) as Record<string, { provider: string; active: boolean; updated_at: string } | undefined>;

  /* ── Load voice profile ── */
  const { data: voiceData } = await service
    .from("voice_profiles")
    .select("tone, offer, updated_at")
    .eq("org_id", org.id)
    .single();

  const voice = voiceData as { tone: string; offer: string; updated_at: string } | null;

  /* ── Helper: resolve status ── */
  function integrationStatus(provider: string): IntegrationStatus {
    const row = intMap[provider];
    if (!row) return "disconnected";
    return row.active ? "connected" : "disconnected";
  }

  function integrationMeta(provider: string): string | undefined {
    const row = intMap[provider];
    if (!row) return undefined;
    return `Connected ${new Date(row.updated_at).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    })}`;
  }

  /* ── Channel card config ── */
  const channelLabels: Record<string, string> = {
    manual:   "Manual (In-App)",
    manychat: "ManyChat",
    meta:     "Meta (Instagram API)",
  };
  const channelDesc: Record<string, string> = {
    manual:   "Conversations are managed directly inside CoachOS. No external account needed.",
    manychat: "ManyChat is handling inbound DMs for this workspace.",
    meta:     "Official Instagram Business API is handling inbound DMs.",
  };

  const allHealthy =
    voice &&
    (org.active_channel === "manual" ||
      integrationStatus(org.active_channel) === "connected");

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text)]">
            Integration health
          </h1>
          <p className="text-sm text-[var(--text-3)] mt-1">
            {org.name} — all connected services at a glance.
          </p>
        </div>

        {allHealthy && (
          <div className="flex items-center gap-1.5 shrink-0 mt-1">
            <CheckCircle2 className="h-4 w-4 text-[var(--brand)]" />
            <span className="text-sm text-[var(--brand)] font-medium">All systems go</span>
          </div>
        )}
      </div>

      {/* ── Cards ── */}
      <div className="space-y-4">

        {/* ── Instagram channel ── */}
        <HealthCard
          icon={<MessageSquare className="h-5 w-5" />}
          name={channelLabels[org.active_channel] ?? org.active_channel}
          provider={`channel / ${org.active_channel}`}
          status="active"
          statusLabel={org.active_channel === "manual" ? "Active" : "Connected"}
          description={channelDesc[org.active_channel]}
          meta={
            org.onboarding_completed_at
              ? `Configured ${new Date(org.onboarding_completed_at).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })}`
              : undefined
          }
          actionLabel="Change channel →"
          actionHref={`/org/${params.orgSlug}/settings/channel`}
        />

        {/* ── Voice profile ── */}
        <HealthCard
          icon={<Mic className="h-5 w-5" />}
          name="Voice Profile"
          provider="voice / ai-persona"
          status={voice ? "active" : "disconnected"}
          statusLabel={voice ? "Configured" : "Not configured"}
          description={
            voice
              ? `Tone: ${voice.tone}${voice.offer ? ` · ${voice.offer.slice(0, 60)}…` : ""}`
              : "Set up your coaching voice so the AI knows how to communicate."
          }
          meta={
            voice
              ? `Updated ${new Date(voice.updated_at).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })}`
              : undefined
          }
          actionLabel={voice ? "Edit voice →" : "Set up voice →"}
          actionHref={`/org/${params.orgSlug}/settings/voice`}
        />

        {/* ── Cal.com ── */}
        <HealthCard
          icon={<Calendar className="h-5 w-5" />}
          name="Cal.com"
          provider="calcom / bookings"
          status={integrationStatus("calcom")}
          description={
            integrationStatus("calcom") === "connected"
              ? "Booking links will be auto-created when a lead qualifies."
              : "Connect Cal.com to auto-schedule discovery calls."
          }
          meta={integrationMeta("calcom")}
          actionLabel={
            integrationStatus("calcom") === "connected"
              ? "Manage →"
              : "Connect →"
          }
          actionHref={`/org/${params.orgSlug}/settings/cal`}
        />

        {/* ── Razorpay ── */}
        <HealthCard
          icon={<CreditCard className="h-5 w-5" />}
          name="Razorpay"
          provider="razorpay / payments"
          status={integrationStatus("razorpay")}
          description={
            integrationStatus("razorpay") === "connected"
              ? "Payment links will be sent automatically when a booking is confirmed."
              : "Connect Razorpay to collect payments from your leads."
          }
          meta={integrationMeta("razorpay")}
          actionLabel={
            integrationStatus("razorpay") === "connected"
              ? "Manage →"
              : "Connect →"
          }
          actionHref={`/org/${params.orgSlug}/settings/payments`}
        />

      </div>

      {/* ── Footer CTA ── */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-2)] p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--text)]">Ready to start closing?</p>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Your workspace is set up. Head to the dashboard to manage leads.
          </p>
        </div>
        <Button variant="primary" size="sm" asChild>
          <Link href={`/org/${params.orgSlug}`}>
            Open dashboard <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

    </div>
  );
}
