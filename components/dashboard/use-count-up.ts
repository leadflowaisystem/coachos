"use client";

import { useState, useEffect, useRef } from "react";

/** Animates from 0 to `target` over `duration` ms with ease-out cubic. */
export function useCountUp(target: number, duration = 1400, delay = 0): number {
  const [value, setValue] = useState(0);
  const startTs  = useRef<number | null>(null);
  const rafId    = useRef<number>(0);
  const started  = useRef(false);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    if (started.current) return;   // only run once per mount
    started.current = true;

    const delayTimer = setTimeout(() => {
      const tick = (ts: number) => {
        if (startTs.current === null) startTs.current = ts;
        const elapsed  = ts - startTs.current;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setValue(Math.round(eased * target));
        if (progress < 1) rafId.current = requestAnimationFrame(tick);
      };
      rafId.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(delayTimer);
      cancelAnimationFrame(rafId.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
}
