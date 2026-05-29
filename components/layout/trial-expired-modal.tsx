"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CreditCard, X } from "lucide-react";
import Link from "next/link";
import { isTrialExpired } from "@/lib/plan";

interface Props {
  plan:        string;
  trialEndsAt: string | null;
  orgSlug:     string;
}

export function TrialExpiredModal({ plan, trialEndsAt, orgSlug }: Props) {
  const expired = isTrialExpired(plan, trialEndsAt);
  const [dismissed, setDismissed] = React.useState(false);

  if (!expired || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="trial-expired-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-8 shadow-2xl"
        >
          {/* Dismiss — lets them look around but AI will still be blocked */}
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-4 top-4 rounded-md p-1 text-[var(--text-3)] hover:bg-[var(--bg-3)] transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Icon */}
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-7 w-7 text-amber-400" />
          </div>

          {/* Copy */}
          <h2 className="font-display text-xl font-semibold text-[var(--text)] mb-2">
            Your free trial has ended
          </h2>
          <p className="text-sm text-[var(--text-2)] leading-relaxed mb-6">
            Your 14-day trial is over. AI replies, lead scoring, and automations are paused.
            Pick a plan to keep your pipeline moving.
          </p>

          {/* CTA */}
          <div className="flex flex-col gap-3">
            <Link
              href={`/org/${orgSlug}/settings/billing`}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              Choose a plan
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
            >
              Remind me later
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
