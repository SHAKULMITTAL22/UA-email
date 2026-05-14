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
        textMuted: "#8b94a8",
        textDim: "#5a6175",
        aiAccent: "#d4ff3a",
        aiAccentSoft: "rgba(212,255,58,0.15)",
        aiAccentBorder: "rgba(212,255,58,0.35)",
        bucket: {
          needsReply: "#d4ff3a",
          fyi: "#7dd3fc",
          newsletter: "#fbbf77",
          noise: "#64748b",
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
