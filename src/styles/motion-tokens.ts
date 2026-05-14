export const motion = {
  duration: {
    fast: 0.15,
    base: 0.20,
    slow: 0.28,
  },
  ease: {
    out: [0.4, 0, 0.2, 1] as const,
    in: [0.4, 0, 1, 1] as const,
    inOut: [0.4, 0, 0.2, 1] as const,
  },
  /** Spring for FLIP card reflow on triage updates */
  springReflow: {
    type: "spring" as const,
    stiffness: 380,
    damping: 32,
    mass: 0.6,
  },
} as const;
