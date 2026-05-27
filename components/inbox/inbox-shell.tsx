"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Plus, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Switch }                    from "@/components/ui/switch";
import { Button }                    from "@/components/ui/button";
import { ConversationListPanel }     from "./conversation-list-panel";
import { NewDmSheet }                from "./new-dm-sheet";
import { formatInr }                 from "@/lib/time";
import { cn }                        from "@/lib/utils";
import type { InboxConversation }    from "@/types/inbox";

interface Props {
  orgSlug:         string;
  orgId:           string;
  orgName:         string;
  autoSendReplies: boolean;
  conversations:   InboxConversation[];
  monthCostInr:    number;
  children:        React.ReactNode;
}

export function InboxShell({
  orgSlug,
  orgId,
  orgName,
  autoSendReplies: initialAutoSend,
  conversations,
  monthCostInr,
  children,
}: Props) {
  const pathname  = usePathname();
  const [dmOpen,     setDmOpen]     = React.useState(false);
  const [autoSend,   setAutoSend]   = React.useState(initialAutoSend);
  const [savingAuto, setSavingAuto] = React.useState(false);

  // On mobile: hide list when inside a conversation
  const inThread = /\/inbox\/[^/]+/.test(pathname);

  async function toggleAutoSend(val: boolean) {
    setAutoSend(val);
    setSavingAuto(true);
    try {
      await fetch(`/api/orgs/${orgId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ auto_send_replies: val }),
      });
    } catch { /* non-fatal */ }
    finally { setSavingAuto(false); }
  }

  return (
    // Full-bleed: cancel AppShell's p-6 padding so split pane reaches edges
    <div
      className="-m-6 flex overflow-hidden bg-[var(--bg)]"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      {/* ── Left panel ────────────────────────────── */}
      <div className={cn("flex flex-col shrink-0", inThread ? "hidden md:flex" : "flex")}>
        {/* Mini toolbar above list — auto-send toggle + usage */}
        <div className="flex h-9 shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-1)] px-3">
          <div className="flex items-center gap-1.5">
            <Switch
              id="auto-send"
              checked={autoSend}
              onCheckedChange={toggleAutoSend}
              disabled={savingAuto}
              aria-label="Auto-send replies"
            />
            <label htmlFor="auto-send" className="text-[11px] text-[var(--text-3)] cursor-pointer select-none">
              Auto-send
            </label>
          </div>
          {monthCostInr > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-3)]">
              <Zap className="h-2.5 w-2.5 text-[var(--brand)]" />
              {formatInr(monthCostInr)} this month
            </div>
          )}
        </div>

        <ConversationListPanel
          orgSlug={orgSlug}
          conversations={conversations}
          onNewDm={() => setDmOpen(true)}
        />
      </div>

      {/* ── Right panel ───────────────────────────── */}
      <div className={cn(
        "flex flex-1 flex-col overflow-hidden min-w-0",
        !inThread && "hidden md:flex"
      )}>
        {children}
      </div>

      {/* ── New DM sheet ──────────────────────────── */}
      <NewDmSheet
        open={dmOpen}
        onOpenChange={setDmOpen}
        orgId={orgId}
        orgSlug={orgSlug}
      />
    </div>
  );
}
