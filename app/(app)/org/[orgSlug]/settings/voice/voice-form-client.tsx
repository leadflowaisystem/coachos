"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, CheckCircle2 } from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly",     label: "Friendly" },
  { value: "direct",       label: "Direct" },
  { value: "energetic",    label: "Energetic" },
  { value: "empathetic",   label: "Empathetic" },
];

interface VoiceState {
  tone:         string;
  offer:        string;
  price_range:  string;
  sells:        string;
  objections:   string[];
  extra_context:string;
}

interface Props {
  orgId:   string;
  orgSlug: string;
  initial: VoiceState | null;
}

export function VoiceProfileForm({ orgId, orgSlug, initial }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [objInput, setObjInput] = useState("");

  const [form, setForm] = useState<VoiceState>({
    tone:          initial?.tone          ?? "professional",
    offer:         initial?.offer         ?? "",
    price_range:   initial?.price_range   ?? "",
    sells:         initial?.sells         ?? "",
    objections:    initial?.objections    ?? [],
    extra_context: initial?.extra_context ?? "",
  });

  function set<K extends keyof VoiceState>(k: K, v: VoiceState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function addObjection() {
    const t = objInput.trim();
    if (!t || form.objections.includes(t)) return;
    set("objections", [...form.objections, t]);
    setObjInput("");
  }

  function removeObjection(obj: string) {
    set("objections", form.objections.filter((o) => o !== obj));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`/api/orgs/${orgId}/voice`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Failed to save");
      }
      toast({ variant: "success", title: "Voice profile saved" });
      router.refresh();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card elevated>
      <CardContent className="space-y-5 pt-5">

        {/* Tone */}
        <div className="space-y-1.5">
          <Label>Communication tone</Label>
          <Select value={form.tone} onValueChange={(v) => set("tone", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose tone…" />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Offer */}
        <div className="space-y-1.5">
          <Label htmlFor="vf-offer">What do you offer?</Label>
          <Textarea
            id="vf-offer"
            rows={2}
            value={form.offer}
            onChange={(e) => set("offer", e.target.value)}
            placeholder="e.g., 1:1 fitness coaching for busy professionals who want to lose 10kg in 90 days"
          />
        </div>

        {/* Price range */}
        <div className="space-y-1.5">
          <Label htmlFor="vf-price">Price range</Label>
          <Input
            id="vf-price"
            value={form.price_range}
            onChange={(e) => set("price_range", e.target.value)}
            placeholder="e.g., ₹25,000 – ₹50,000 / month"
          />
        </div>

        {/* What you solve */}
        <div className="space-y-1.5">
          <Label htmlFor="vf-sells">What problem do you solve?</Label>
          <Textarea
            id="vf-sells"
            rows={2}
            value={form.sells}
            onChange={(e) => set("sells", e.target.value)}
            placeholder="e.g., Busy professionals stuck in poor habits who need accountability"
          />
        </div>

        {/* Objections */}
        <div className="space-y-2">
          <Label>Common objections</Label>
          <div className="flex gap-2">
            <Input
              value={objInput}
              onChange={(e) => setObjInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addObjection())}
              placeholder="e.g., Too expensive…"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={addObjection}
              disabled={!objInput.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {form.objections.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {form.objections.map((obj) => (
                <span
                  key={obj}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-3)] px-2.5 py-1 text-xs text-[var(--text-2)]"
                >
                  {obj}
                  <button
                    type="button"
                    onClick={() => removeObjection(obj)}
                    className="text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Extra context */}
        <div className="space-y-1.5">
          <Label htmlFor="vf-extra">
            Extra context{" "}
            <span className="text-[var(--text-3)] font-normal">(optional)</span>
          </Label>
          <Textarea
            id="vf-extra"
            rows={2}
            value={form.extra_context}
            onChange={(e) => set("extra_context", e.target.value)}
            placeholder="Anything else the AI should know about your style, boundaries, or approach…"
          />
        </div>

      </CardContent>

      <CardFooter className="justify-end gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/org/${orgSlug}/health`)}
          disabled={saving}
        >
          Back to health
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="gap-2"
        >
          {saving ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Save changes
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
