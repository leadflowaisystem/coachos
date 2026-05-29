/**
 * /org/[slug]/settings/payments — Razorpay integration (per-org collection)
 * Coaches connect their own Razorpay account to collect coaching fees.
 */

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RazorpaySettingsForm } from "./razorpay-form-client";

interface Props { params: { orgSlug: string } }

export const metadata = { title: "Payments (Razorpay) — CoachOS" };

export default async function PaymentsSettingsPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orgRow } = await supabase
    .from("orgs").select("id, name").eq("slug", params.orgSlug).single();
  if (!orgRow) notFound();
  const org = orgRow as { id: string; name: string };

  const svc = createServiceClient();
  const { data: intRow } = await svc
    .from("integrations")
    .select("config, active")
    .eq("org_id", org.id)
    .eq("provider", "razorpay")
    .maybeSingle();

  const config = (intRow?.config ?? {}) as { key_id?: string };
  const isConnected = !!intRow?.active;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/org/${params.orgSlug}/settings`}
          className="flex items-center gap-1 text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Settings
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--text)]">Payments (Razorpay)</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Connect your Razorpay account to track collections, dunning retries, and revenue attribution.
        </p>
      </div>

      <RazorpaySettingsForm
        orgId={org.id}
        orgSlug={params.orgSlug}
        initialKeyId={config.key_id ?? ""}
        isConnected={isConnected}
      />
    </div>
  );
}
