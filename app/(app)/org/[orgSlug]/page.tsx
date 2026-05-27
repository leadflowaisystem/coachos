"use client";

import {
  Inbox,
  CalendarDays,
  CreditCard,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

/* ── Section preview data ── */
const sections = [
  {
    key: "inbox",
    phase: "Phase 2",
    icon: <Inbox className="h-5 w-5" />,
    title: "Inbox",
    tagline: "AI-powered Instagram DMs",
    description:
      "Real-time DM threads, automatic lead scoring, and one-click AI reply drafts — all in a unified inbox. Plug in your channel and watch warm leads rise to the top.",
    emptyTitle: "Your inbox is warming up",
    emptyDescription:
      "Phase 2 wires live Instagram DMs to this view. No more toggling between apps to chase leads.",
  },
  {
    key: "bookings",
    phase: "Phase 3",
    icon: <CalendarDays className="h-5 w-5" />,
    title: "Bookings",
    tagline: "Frictionless discovery calls",
    description:
      "Connect Cal.com once, share a smart link in your DMs, and watch qualified leads book themselves. No back-and-forth, no no-shows.",
    emptyTitle: "Booking links not live yet",
    emptyDescription:
      "Phase 3 integrates your Cal.com calendar so leads can self-serve a slot straight from a DM conversation.",
  },
  {
    key: "payments",
    phase: "Phase 3",
    icon: <CreditCard className="h-5 w-5" />,
    title: "Payments",
    tagline: "Revenue at a glance",
    description:
      "Track Razorpay collections, spot failed retries before they churn, and reconcile every rupee to the lead that converted.",
    emptyTitle: "Revenue tracking coming soon",
    emptyDescription:
      "Phase 3 pulls your Razorpay data here — collections, failures, and subscription health in one panel.",
  },
  {
    key: "attribution",
    phase: "Phase 4",
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Attribution",
    tagline: "Close-loop analytics",
    description:
      "See exactly which DM thread started the journey that ended in a paid client. Full funnel — first touch to final payment — without a spreadsheet in sight.",
    emptyTitle: "Attribution lands in Phase 4",
    emptyDescription:
      "Every lead source, conversation, booking, and payment tied together. Know what's working before you scale.",
  },
] as const;

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function WorkspaceHomePage() {
  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-1"
      >
        <h1 className="font-display text-2xl font-semibold text-[var(--text)]">
          Welcome to CoachOS
        </h1>
        <p className="text-sm text-[var(--text-3)]">
          Your workspace is set up. Each section below unlocks in a future phase — here&apos;s what&apos;s coming.
        </p>
      </motion.div>

      {/* ── Section preview grid ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {sections.map((s) => (
          <motion.div key={s.key} variants={cardVariants}>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg-3)] text-[var(--brand)]">
                      {s.icon}
                    </div>
                    <div>
                      <CardTitle>{s.title}</CardTitle>
                      <CardDescription>{s.tagline}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="muted" className="shrink-0 mt-0.5 text-[10px]">
                    {s.phase}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <EmptyState
                  title={s.emptyTitle}
                  description={s.emptyDescription}
                  className="py-10"
                />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
