"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FunnelStep {
  label:    string;
  value:    number;
  color:    string;
  bgColor:  string;
}

interface FunnelChartProps {
  steps: FunnelStep[];
}

function pct(a: number, b: number): string {
  if (b === 0) return "–";
  return `${Math.min(100, Math.round((a / b) * 100))}%`;
}

export function FunnelChart({ steps }: FunnelChartProps) {
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="space-y-2.5">
      {steps.map((step, i) => {
        const prev  = i > 0 ? steps[i - 1].value : step.value;
        const conv  = i > 0 ? pct(step.value, prev) : "100%";
        const width = Math.max((step.value / max) * 100, step.value > 0 ? 4 : 0);

        return (
          <div key={step.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--text-2)]">{step.label}</span>
              <div className="flex items-center gap-3">
                {i > 0 && (
                  <span className={cn(
                    "font-mono text-[11px]",
                    parseInt(conv) >= 70 ? "text-[var(--brand)]"  :
                    parseInt(conv) >= 40 ? "text-amber-400"       : "text-red-400"
                  )}>
                    {conv}
                  </span>
                )}
                <span className="font-mono font-semibold tabular-nums text-[var(--text)]">
                  {step.value.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
            <div className="h-6 w-full rounded-[var(--radius-sm)] bg-[var(--bg-3)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className={cn("h-full rounded-[var(--radius-sm)]", step.bgColor)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
