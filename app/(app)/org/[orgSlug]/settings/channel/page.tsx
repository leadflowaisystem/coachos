/**
 * /org/[slug]/settings/channel — Channel integrations
 * Placeholder — Instagram DM / ManyChat / Meta connection UI goes here.
 */

import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Instagram, Zap } from "lucide-react";

interface Props { params: { orgSlug: string } }

export const metadata = { title: "Channels — CoachOS" };

export default async function ChannelSettingsPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orgRow } = await supabase
    .from("orgs").select("id, name").eq("slug", params.orgSlug).single();
  if (!orgRow) notFound();

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
        <h1 className="font-display text-2xl font-semibold text-[var(--text)]">Channels</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Connect your DM channels so CoachOS can receive and reply to leads automatically.
        </p>
      </div>

      <div className="space-y-3">
        {[
          {
            icon: <Instagram className="h-5 w-5" />,
            name: "Instagram DMs",
            description: "Connect via Meta Business API to receive DMs directly in your inbox.",
            note: "Requires Meta Business Account",
          },
          {
            icon: <Zap className="h-5 w-5" />,
            name: "ManyChat",
            description: "Forward ManyChat subscriber messages to CoachOS via webhook.",
            note: "Webhook URL provided after connecting",
          },
        ].map((ch) => (
          <div
            key={ch.name}
            className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-1)] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg-3)] text-[var(--brand)]">
                {ch.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{ch.name}</p>
                <p className="text-xs text-[var(--text-3)]">{ch.description}</p>
              </div>
            </div>
            <button
              disabled
              className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--bg-3)] px-3 py-1.5 text-xs font-medium text-[var(--text-3)] cursor-not-allowed opacity-60"
            >
              Connect
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--text-3)] leading-relaxed rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-3">
        Native Instagram integration requires approval from Meta. In the meantime, use the{" "}
        <strong className="text-[var(--text-2)]">Simulate DM</strong> button in your inbox to
        test the full AI pipeline with any message.
      </p>
    </div>
  );
}
