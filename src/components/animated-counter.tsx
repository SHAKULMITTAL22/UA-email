"use client";
import { useEffect, useRef, useState } from "react";
import { useInView, animate, useMotionValue } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
}

/**
 * Rolls up from 0 to value over `duration` seconds when first scrolled
 * into view. After the first reveal, value changes snap (no replay) to
 * keep live count updates honest.
 */
export function AnimatedCounter({ value, duration = 0.6 }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState("0");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView) return;
    if (startedRef.current) {
      // Subsequent value changes — snap, don't replay.
      setDisplay(value.toString());
      motionValue.set(value);
      return;
    }
    startedRef.current = true;

    // Respect reduced motion: skip the animation entirely.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value.toString());
      return;
    }

    const controls = animate(motionValue, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setDisplay(Math.round(v).toString()),
    });
    return () => controls.stop();
  }, [inView, value, duration, motionValue]);

  return <span ref={ref}>{display}</span>;
}
