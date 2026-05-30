"use client";

import * as React from "react";
import { Search, Plus, Download, ChevronRight, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

export interface LeadRow {
  id:          string;
  name:        string;
  external_id: string;
  channel:     string;
  score:       number;
  stage:       string;
  tags?:       string[] | null;
  notes?:      string | null;
  ltv_inr?:    number | null;
  last_seen_at?: string | null;
  created_at:  string;
  source?:     string | null;
}

interface Props {
  orgId:        string;
  orgSlug:      string;
  initialLeads: LeadRow[];
}

const STAGE_COLORS: Record<string, string> = {
  cold:         "bg-[var(--bg-3)] text-[var(--text-3)] border-[var(--border)]",
  warm:         "bg-amber-500/20 text-amber-400 border-amber-500/30",
  hot:          "bg-red-500/20 text-red-400 border-red-500/30",
  booking_sent: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  booked:       "bg-[var(--brand)]/20 text-[var(--brand)] border-[var(--brand)]/30",
  won:          "bg-[var(--brand)]/30 text-[var(--brand)] border-[var(--brand)]/40",
  paid:         "bg-[var(--brand)]/40 text-[var(--brand)] border-[var(--brand)]/50",
  lost:         "bg-[var(--bg-3)] text-[var(--text-3)] border-[var(--border)]",
};

const STAGES = ["cold", "warm", "hot", "booking_sent", "booked", "won", "paid", "lost"];

function scoreColor(score: number) {
  if (score >= 75) return "text-red-400";
  if (score >= 50) return "text-amber-400";
  return "text-[var(--text-3)]";
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function CrmView({ orgId, orgSlug, initialLeads }: Props) {
  const [leads,       setLeads]       = React.useState<LeadRow[]>(initialLeads);
  const [search,      setSearch]      = React.useState("");
  const [stageFilter, setStageFilter] = React.useState("");
  const [loading,     setLoading]     = React.useState(false);
  const [selected,    setSelected]    = React.useState<LeadRow | null>(null);
  const [showAdd,     setShowAdd]     = React.useState(false);
  const [nextCursor,  setNextCursor]  = React.useState<string | null>(null);
  const [editNotes,   setEditNotes]   = React.useState("");

  // New lead form state
  const [newName,   setNewName]   = React.useState("");
  const [newHandle, setNewHandle] = React.useState("");
  const [newEmail,  setNewEmail]  = React.useState("");
  const [newStage,  setNewStage]  = React.useState("cold");
  const [saving,    setSaving]    = React.useState(false);

  async function fetchLeads(reset = true) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search)      params.set("search", search);
      if (stageFilter) params.set("stage",  stageFilter);
      if (!reset && nextCursor) params.set("cursor", nextCursor);

      const res  = await fetch(`/api/orgs/${orgId}/leads?${params}`);
      const data = await res.json();
      setLeads(reset ? (data.leads ?? []) : (prev: LeadRow[]) => [...prev, ...(data.leads ?? [])]);
      setNextCursor(data.next_cursor ?? null);
    } finally {
      setLoading(false);
    }
  }

  // Debounced search
  React.useEffect(() => {
    const t = setTimeout(() => fetchLeads(true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, stageFilter]);

  async function addLead() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/leads`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: newName, handle: newHandle, email: newEmail, stage: newStage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLeads((prev) => [data.lead, ...prev]);
      setShowAdd(false);
      setNewName(""); setNewHandle(""); setNewEmail(""); setNewStage("cold");
      toast({ title: "Lead added", variant: "success" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    if (!selected) return;
    try {
      await fetch(`/api/orgs/${orgId}/leads/${selected.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ notes: editNotes }),
      });
      setLeads((prev) => prev.map((l) => l.id === selected.id ? { ...l, notes: editNotes } : l));
      setSelected((s) => s ? { ...s, notes: editNotes } : s);
      toast({ title: "Notes saved", variant: "success" });
    } catch {
      toast({ title: "Error saving notes", variant: "destructive" });
    }
  }

  function exportCsv() {
    const header = ["Name", "Handle", "Stage", "Score", "LTV", "Last Contact", "Tags", "Source"];
    const rows   = leads.map((l) => [
      l.name, l.external_id, l.stage, l.score,
      l.ltv_inr ?? 0, formatDate(l.last_seen_at),
      (l.tags ?? []).join(";"), l.source ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const a   = document.createElement("a");
    a.href    = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-3)]" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] pl-8 pr-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <select
          value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}</option>)}
        </select>
        <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--bg-3)] transition-colors">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-[#0A0A0C] hover:opacity-90 transition-opacity">
          <Plus className="h-3.5 w-3.5" /> Add Lead
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-2)]">
              {["Name", "Stage", "Score", "Tags", "Last Contact", "LTV"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide">{h}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-3)]">No leads yet. Add one above or paste a DM in the AI Reply Assistant.</td></tr>
            )}
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => { setSelected(lead); setEditNotes(lead.notes ?? ""); }}
                className="border-b border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--bg-2)] cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--text)] truncate max-w-[160px]">{lead.name}</p>
                  <p className="text-[11px] text-[var(--text-3)] truncate">@{lead.external_id}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-[11px] font-semibold border rounded px-1.5 py-0.5", STAGE_COLORS[lead.stage] ?? STAGE_COLORS.cold)}>
                    {lead.stage.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm">
                  <span className={scoreColor(lead.score)}>{lead.score}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(lead.tags ?? []).slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] border border-[var(--brand)]/30 text-[var(--brand)] rounded px-1.5 py-0.5">{t}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-3)]">{formatDate(lead.last_seen_at)}</td>
                <td className="px-4 py-3 font-mono text-sm text-[var(--text-2)]">
                  {lead.ltv_inr ? `₹${lead.ltv_inr.toLocaleString("en-IN")}` : "—"}
                </td>
                <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-[var(--text-3)]" /></td>
              </tr>
            ))}
            {loading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[var(--text-3)]" /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && !loading && (
        <button onClick={() => fetchLeads(false)} className="text-xs text-[var(--brand)] hover:underline">Load more →</button>
      )}

      {/* Side panel */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 w-full max-w-md bg-[var(--bg-1)] border-l border-[var(--border)] h-full overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--text)]">{selected.name}</h2>
                <p className="text-xs text-[var(--text-3)]">@{selected.external_id} · {selected.channel}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-3 text-center">
                <p className={cn("font-mono text-xl font-bold", scoreColor(selected.score))}>{selected.score}</p>
                <p className="text-[10px] text-[var(--text-3)]">Score</p>
              </div>
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-3 text-center">
                <p className="text-xs font-semibold text-[var(--text)]">{selected.stage.replace("_", " ")}</p>
                <p className="text-[10px] text-[var(--text-3)]">Stage</p>
              </div>
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] p-3 text-center">
                <p className="font-mono text-sm font-bold text-[var(--brand)]">{selected.ltv_inr ? `₹${selected.ltv_inr.toLocaleString("en-IN")}` : "—"}</p>
                <p className="text-[10px] text-[var(--text-3)]">LTV</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide mb-2">Notes</p>
              <textarea
                value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                rows={4} placeholder="Add notes about this lead…"
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] resize-none"
              />
              <button onClick={saveNotes} className="mt-2 text-xs text-[var(--brand)] hover:underline">Save notes</button>
            </div>

            {(selected.tags ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selected.tags ?? []).map((t) => (
                    <span key={t} className="text-xs border border-[var(--brand)]/30 text-[var(--brand)] rounded px-2 py-0.5">{t}</span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide mb-1">Timeline</p>
              <p className="text-xs text-[var(--text-3)]">Added {formatDate(selected.created_at)} · Last seen {formatDate(selected.last_seen_at)}</p>
            </div>

            <a
              href={`/org/${orgSlug}/inbox`}
              className="block w-full text-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-2)] py-2.5 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--bg-3)] transition-colors"
            >
              Open in Inbox →
            </a>
          </div>
        </div>
      )}

      {/* Add Lead sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 w-full max-w-sm bg-[var(--bg-1)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold text-[var(--text)]">Add lead manually</h2>
            <div className="space-y-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name *"
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
              <input value={newHandle} onChange={(e) => setNewHandle(e.target.value)} placeholder="Instagram handle (optional)"
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" placeholder="Email (optional)"
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
              <select value={newStage} onChange={(e) => setNewStage(e.target.value)}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-3)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                {STAGES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-[var(--radius)] border border-[var(--border)] py-2.5 text-sm text-[var(--text-2)] hover:bg-[var(--bg-3)] transition-colors">Cancel</button>
              <button onClick={addLead} disabled={saving || !newName.trim()}
                className="flex-1 rounded-[var(--radius)] bg-[var(--brand)] py-2.5 text-sm font-semibold text-[#0A0A0C] hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Saving…" : "Add Lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
