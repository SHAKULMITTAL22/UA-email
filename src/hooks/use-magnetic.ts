"use client";
import { useRef, useEffect } from "react";

/**
 * Subtle cursor-pull. Returns a ref attach to a button/element with
 * Tailwind `transition-transform` for the smooth return. Hover-capable
 * pointer devices only — no-ops on touch.
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.3) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Hover-only: skip on touch / coarse pointer devices.
    if (typeof window !== "undefined") {
      const supportsHover = window.matchMedia("(hover: hover)").matches;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!supportsHover || reducedMotion) return;
    }

    function onMove(e: MouseEvent) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      // Cap raw translate at ~6px regardless of strength.
      const tx = Math.max(-6, Math.min(6, x * strength));
      const ty = Math.max(-6, Math.min(6, y * strength));
      el.style.transform = `translate(${tx}px, ${ty}px)`;
    }
    function onLeave() {
      if (!el) return;
      el.style.transform = "translate(0,0)";
    }

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return ref;
}
