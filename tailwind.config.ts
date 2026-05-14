import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0a0e1c",
        canvasSecondary: "#0f1429",
        card: "rgba(255,255,255,0.035)",
        cardHover: "rgba(255,255,255,0.06)",
        cardBorder: "rgba(255,255,255,0.07)",
        cardBorderActive: "rgba(212,255,58,0.25)",
        textPrimary: "#f5f7fa",
        textSecondary: "#c5cad6",
        textMuted: "#a8b0c4",
        textDim: "#7a8298",
        aiAccent: "#d4ff3a",
        aiAccentSoft: "rgba(212,255,58,0.15)",
        aiAccentBorder: "rgba(212,255,58,0.35)",
        bucket: {
          needsReply: "#d4ff3a",
          fyi: "#7dd3fc",
          newsletter: "#fbbf77",
          /* `#64748b` looked right but failed AA contrast against the dark
             canvas. Brighten just enough to pass 4.5:1 while staying muted
             relative to the other buckets. */
          noise: "#94a3b8",
        },
        success: "#4ade80",
        error: "#f87171",
        warning: "#fbbf77",
      },
      fontFamily: {
        body: ["var(--font-geist)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "8px",
        drawer: "10px",
      },
      transitionTimingFunction: {
        "ua-out": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        ua: "200ms",
      },
      backdropBlur: { card: "20px" },
    },
  },
  plugins: [animate],
};

export default config;
