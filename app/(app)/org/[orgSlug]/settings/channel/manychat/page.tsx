/**
 * /org/[slug]/settings/channel/manychat
 * Shows the per-org ManyChat webhook URL + secret token.
 * Coach pastes the webhook URL into ManyChat → External Request step.
 */

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ManyChatSetupClient } from "./manychat-client";

interface Props { params: { orgSlug: string } }

export const metadata = { title: "ManyChat — CoachOS" };

export default async function ManyChatSetupPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orgRow } = await supabase
    .from("orgs").select("id, name").eq("slug", params.orgSlug).single();
  if (!orgRow) notFound();
  const org = orgRow as { id: string; name: string };

  const svc = createServiceClient();

  // Load or generate per-org ManyChat webhook secret
  const { data: intRow } = await svc
    .from("integrations")
    .select("config, active")
    .eq("org_id", org.id)
    .eq("provider", "manychat")
    .maybeSingle();

  const config = (intRow?.config ?? {}) as { webhook_token?: string };

  // Auto-generate a token if one doesn't exist yet
  let webhookToken = config.webhook_token ?? "";
  if (!webhookToken) {
    webhookToken = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    await svc.from("integrations").upsert({
      org_id:   org.id,
      provider: "manychat",
      config:   { webhook_token: webhookToken },
      active:   false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,provider" });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://coachos.app";
  const webhookUrl = `${appUrl}/api/webhooks/manychat/${org.id}`;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/org/${params.orgSlug}/settings/channel`}
          className="flex items-center gap-1 text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Channels
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--text)]">ManyChat webhook</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Paste these values into ManyChat → Automation → External Request to forward
          subscriber DMs to CoachOS.
        </p>
      </div>

      <ManyChatSetupClient
        orgId={org.id}
        orgSlug={params.orgSlug}
        webhookUrl={webhookUrl}
        webhookToken={webhookToken}
        isActive={!!intRow?.active}
      />
    </div>
  );
}
