"use client";

import * as React from "react";
import { Copy, Check, Zap, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

interface Props {
  orgId:        string;
  orgSlug:      string;
  webhookUrl:   string;
  webhookToken: string;
  isActive:     boolean;
}

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Select and copy manually.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-[var(--text-2)]">{label}</p>
      <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-3)] px-3 py-2.5">
        <span className={`flex-1 min-w-0 truncate text-sm text-[var(--text)] ${mono ? "font-mono" : ""}`}>
          {value}
        </span>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded p-1 text-[var(--text-3)] hover:text-[var(--brand)] hover:bg-[var(--brand)]/10 transition-colors"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[var(--brand)]" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function ManyChatSetupClient({ orgId, orgSlug, webhookUrl, webhookToken, isActive }: Props) {
  const [marking, setMarking] = React.useState(false);
  const [active,  setActive]  = React.useState(isActive);

  async function markActive() {
    setMarking(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/integrations`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          provider: "manychat",
          config:   { webhook_token: webhookToken },
          active:   true,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setActive(true);
      toast({ title: "ManyChat marked active", description: "CoachOS will accept webhook calls from ManyChat.", variant: "success" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      {active && (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-3 py-2 text-xs text-[var(--brand)]">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ManyChat webhook is active and accepting leads.
        </div>
      )}

      {/* Credentials */}
      <div className="space-y-4">
        <CopyField label="Webhook URL (paste as POST URL in ManyChat)" value={webhookUrl} />
        <CopyField label="Secret token (add as X-Webhook-Token header)" value={webhookToken} />
      </div>

      {/* Step-by-step instructions */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-2)] p-4 space-y-3">
        <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">Setup steps</p>
        <ol className="space-y-2">
          {[
            "In ManyChat, open the flow that handles inbound DMs.",
            "Add an External Request step with method POST.",
            "Paste the Webhook URL above as the request URL.",
            'Add header: Key = "X-Webhook-Token", Value = the secret token above.',
            'Set the request body to JSON: { "subscriber_id": "{{subscriber id}}", "name": "{{full name}}", "message": "{{last input text}}" }',
            'Click "Test Request" in ManyChat — if CoachOS returns 200, you\'re live.',
            "Click Mark as active below to enable lead processing.",
          ].map((step, i) => (
            <li key={i} className="flex gap-2.5 text-xs text-[var(--text-3)] leading-relaxed">
              <span className="shrink-0 font-mono text-[var(--brand)] font-semibold w-4 text-right">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Activate */}
      {!active && (
        <Button
          variant="primary"
          onClick={markActive}
          disabled={marking}
          className="w-full sm:w-auto"
        >
          {marking ? (
            <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            <><Zap className="h-4 w-4" /> Mark as active</>
          )}
        </Button>
      )}
    </div>
  );
}
