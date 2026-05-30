"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  orgSlug:   string;
  funnelUrl: string;
  calUrl:    string;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(value).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded p-1 text-[var(--text-3)] hover:text-[var(--brand)] hover:bg-[var(--brand)]/10 transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[var(--brand)]" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function UrlChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-[var(--text-2)]">{label}</p>
      <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-3)] px-3 py-2">
        <span className="flex-1 min-w-0 truncate text-xs font-mono text-[var(--text)]">{value}</span>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

const GUIDES = [
  {
    title: 'Guide A — Story Reply Trigger (free)',
    steps: [
      'ManyChat > Automation > New Flow',
      'Trigger: Story Reply (Any)',
      'Action: Send Message → paste your Funnel URL below',
      'Publish',
    ],
  },
  {
    title: 'Guide B — Comment Trigger (free)',
    steps: [
      'New Flow > Trigger: Comment on Post',
      'Keywords: INFO, PRICE, BOOK',
      'Action: Send Message → paste your Funnel URL or Cal.com URL below',
      'Publish',
    ],
  },
  {
    title: 'Guide C — DM Keyword Trigger (free)',
    steps: [
      'New Flow > Trigger: DM Keyword',
      'Keywords: PRICE, INFO, BOOK, COACH',
      'Action: Send Message → paste your Cal.com URL below',
      'Publish',
    ],
  },
] as const;

export function ManyChatSetupClient({ funnelUrl, calUrl }: Props) {
  return (
    <div className="space-y-8">
      {/* Intro */}
      <div className="space-y-1">
        <p className="text-sm text-[var(--text-2)] leading-relaxed">
          Use <span className="font-semibold text-[var(--text)]">ManyChat free</span> to capture
          leads from stories, comments, and keyword DMs. ManyChat auto-replies with your CoachOS
          funnel link — CoachOS handles everything from there.
        </p>
      </div>

      {/* URLs */}
      <div className="space-y-3">
        <UrlChip label="Your Funnel URL (paste in ManyChat messages)" value={funnelUrl} />
        <UrlChip label="Your Cal.com URL (paste in ManyChat messages)" value={calUrl || "Connect Cal.com first → Settings › Cal.com"} />
      </div>

      {/* Guides */}
      <div className="space-y-4">
        {GUIDES.map((guide) => (
          <div key={guide.title} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-2)] p-4 space-y-3">
            <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">
              {guide.title}
            </p>
            <ol className="space-y-1.5">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-[var(--text-3)] leading-relaxed">
                  <span className="shrink-0 font-mono text-[var(--brand)] font-semibold w-3">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--text-3)]">
        All three guides use ManyChat free features only — no paid plan or External Requests required.
      </p>
    </div>
  );
}
