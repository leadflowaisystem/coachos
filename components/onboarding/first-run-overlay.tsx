"use client";

/**
 * FirstRunOverlay — one-time guided tour for new coaches.
 *
 * Shows automatically the first time a coach lands on any org page after
 * completing the onboarding wizard. State is persisted in localStorage
 * (key: `coachos_first_run_done_<orgSlug>`) so it never shows again on
 * the same device once dismissed or completed.
 *
 * 4 steps:
 *   1 → Welcome — workspace is ready
 *   2 → Simulate a DM — test the AI pipeline
 *   3 → AI replies automatically — see what happens
 *   4 → Connect ManyChat — go live with real Instagram DMs
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  orgSlug: string;
}

const STEP_COUNT = 4;

const STEPS = [
  {
    emoji: "🚀",
    title: "Welcome to CoachOS",
    body:  "Your workspace is set up and your AI is ready. Let's walk through your first lead in 2 minutes.",
    primaryLabel: "Show me how →",
    primaryAction: "next" as const,
  },
  {
    emoji: "💬",
    title: "Simulate your first DM",
    body:  'Head to your Inbox and click “Simulate DM” to fire a test conversation through the full AI pipeline — scoring, booking, and payment.',
    primaryLabel: "Open Inbox →",
    primaryAction: "inbox" as const,
  },
  {
    emoji: "✨",
    title: "AI replies automatically",
    body:  "CoachOS scores every lead, replies in your voice, books discovery calls, and sends payment links — all without you lifting a finger.",
    primaryLabel: "Got it, next →",
    primaryAction: "next" as const,
  },
  {
    emoji: "🔗",
    title: "Connect ManyChat to go live",
    body:  "Your test worked! Now connect ManyChat to start receiving real Instagram DMs from your audience.",
    primaryLabel: "Connect ManyChat →",
    primaryAction: "manychat" as const,
    secondaryLabel: "I'll do this later",
  },
] as const;

function storageKey(orgSlug: string) {
  return `coachos_first_run_done_${orgSlug}`;
}

export function FirstRunOverlay({ orgSlug }: Props) {
  const router = useRouter();
  const [step,    setStep]    = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  // Only check localStorage on the client — avoids SSR mismatch
  React.useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey(orgSlug))) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — silently skip
    }
  }, [orgSlug]);

  function dismiss() {
    try { localStorage.setItem(storageKey(orgSlug), "1"); } catch { /* ignore */ }
    setVisible(false);
  }

  function handlePrimary(action: typeof STEPS[number]["primaryAction"]) {
    switch (action) {
      case "next":
        if (step < STEP_COUNT - 1) {
          setStep((s) => s + 1);
        } else {
          dismiss();
        }
        break;
      case "inbox":
        dismiss();
        router.push(`/org/${orgSlug}/inbox`);
        break;
      case "manychat":
        dismiss();
        router.push(`/org/${orgSlug}/settings/channel/manychat`);
        break;
    }
  }

  const current = STEPS[step];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="first-run-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <motion.div
            key={`step-${step}`}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0, scale: 0.95,    y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-8 shadow-2xl"
          >
            {/* Dismiss */}
            <button
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-md p-1 text-[var(--text-3)] hover:bg-[var(--bg-3)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Step dots */}
            <div className="mb-6 flex items-center gap-1.5">
              {Array.from({ length: STEP_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className={
                    i === step
                      ? "h-1.5 w-5 rounded-full bg-[var(--brand)] transition-all"
                      : "h-1.5 w-1.5 rounded-full bg-[var(--bg-3)] transition-all"
                  }
                />
              ))}
            </div>

            {/* Emoji */}
            <div className="mb-4 text-4xl leading-none select-none">{current.emoji}</div>

            {/* Copy */}
            <h2 className="font-display text-xl font-semibold text-[var(--text)] mb-2">
              {current.title}
            </h2>
            <p className="text-sm text-[var(--text-2)] leading-relaxed mb-8">
              {current.body}
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handlePrimary(current.primaryAction)}
                className="w-full rounded-xl bg-[var(--brand)] py-3 text-sm font-semibold text-[#0A0A0C] hover:opacity-90 transition-opacity min-h-[44px]"
              >
                {current.primaryLabel}
              </button>

              {"secondaryLabel" in current && (
                <button
                  onClick={dismiss}
                  className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors py-1 min-h-[44px]"
                >
                  {current.secondaryLabel}
                </button>
              )}

              {step > 0 && !("secondaryLabel" in current) && (
                <button
                  onClick={dismiss}
                  className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors py-1 min-h-[44px]"
                >
                  Skip tour
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
