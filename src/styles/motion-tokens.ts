export const motion = {
  duration: {
    fast: 0.15,
    base: 0.20,
    slow: 0.28,
    dramatic: 0.5,
  },
  ease: {
    out: [0.4, 0, 0.2, 1] as const,
    in: [0.4, 0, 1, 1] as const,
    inOut: [0.4, 0, 0.2, 1] as const,
    snap: [0.85, 0, 0.15, 1] as const,
  },
  /** Spring for FLIP card reflow on triage updates */
  springReflow: {
    type: "spring" as const,
    stiffness: 380,
    damping: 32,
    mass: 0.6,
  },
  /** Slightly snappier spring for TriageCard entry animations */
  springCard: {
    type: "spring" as const,
    stiffness: 500,
    damping: 35,
    mass: 0.5,
  },
} as const;
