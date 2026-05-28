/**
 * /org/[slug]/bookings
 * Server component — loads bookings data, renders BookingsView client component.
 */

import { redirect, notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BookingsView } from "@/components/bookings/bookings-view";
import type { BookingRow, BookingLead } from "@/components/bookings/booking-card";

interface Props {
  params: { orgSlug: string };
}

export async function generateMetadata() {
  return { title: "Bookings — CoachOS" };
}

export default async function BookingsPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orgRow } = await supabase
    .from("orgs")
    .select("id")
    .eq("slug", params.orgSlug)
    .single();

  const org = orgRow as { id: string } | null;
  if (!org) notFound();

  const svc = createServiceClient();
  const { data: rows } = await svc
    .from("bookings")
    .select(`
      id, status, starts_at, ends_at, meeting_url,
      attendee_name, attendee_email, cal_booking_uid,
      conversation_id, recovery_attempt, recovery_sent_at,
      created_at, updated_at,
      lead:leads(id, name, avatar_url, stage, channel)
    `)
    .eq("org_id", org.id)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(100);

  const bookings: BookingRow[] = (rows ?? []).map((r) => ({
    id:               r.id,
    status:           r.status as BookingRow["status"],
    starts_at:        r.starts_at,
    ends_at:          r.ends_at,
    meeting_url:      r.meeting_url,
    attendee_name:    r.attendee_name,
    attendee_email:   r.attendee_email,
    cal_booking_uid:  r.cal_booking_uid,
    conversation_id:  r.conversation_id,
    recovery_attempt: r.recovery_attempt ?? 0,
    recovery_sent_at: r.recovery_sent_at,
    created_at:       r.created_at,
    lead: (() => {
      const l = (r.lead as unknown) as {
        id: string; name: string | null; avatar_url: string | null;
        stage: string; channel: string;
      } | null;
      return l as BookingLead | null;
    })(),
  }));

  const totalUpcoming = bookings.filter(
    (b) => b.status === "confirmed" && b.starts_at && new Date(b.starts_at) > new Date()
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">Bookings</h1>
          {totalUpcoming > 0 && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              {totalUpcoming} upcoming
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--text-3)]">
          Discovery calls, reminders, and no-show recovery — all automated.
        </p>
      </div>

      <BookingsView
        initialBookings={bookings}
        orgSlug={params.orgSlug}
        orgId={org.id}
      />
    </div>
  );
}
