import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        canvas: "#f7f9fc",
        canvasSecondary: "#ffffff",
        canvasTinted: "#eef3ff",

        // Card surfaces
        card: "#ffffff",
        cardHover: "#f7faff",
        cardBorder: "#e2e8f0",
        cardBorderActive: "#0066ff",

        // Text
        textPrimary: "#0a0e1c",
        textSecondary: "#475569",
        textMuted: "#64748b",
        textDim: "#94a3b8",

        // AI accent (the new signature color)
        aiAccent: "#0066ff",
        aiAccentSoft: "#e6efff",
        aiAccentBorder: "#b9d2ff",
        aiAccentDeep: "#0052cc",

        // Bucket colors
        bucket: {
          needsReply: "#0066ff",
          fyi: "#0891b2",
          newsletter: "#ea580c",
          noise: "#64748b",
        },

        // Status colors
        success: "#16a34a",
        error: "#dc2626",
        warning: "#d97706",

        // Accent surfaces (filled pills/chips)
        bucketSurface: {
          needsReply: "#e6efff",
          fyi: "#cffafe",
          newsletter: "#ffedd5",
          noise: "#f1f5f9",
        },
      },
      fontFamily: {
        body: ["var(--font-geist)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "10px",
        drawer: "14px",
      },
      transitionTimingFunction: {
        "ua-out": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        ua: "200ms",
      },
      backdropBlur: { card: "20px" },
      boxShadow: {
        card: "0 1px 2px rgba(10, 14, 28, 0.04), 0 0 0 1px rgba(226, 232, 240, 0.8)",
        cardHover:
          "0 8px 24px rgba(10, 14, 28, 0.08), 0 0 0 1px rgba(0, 102, 255, 0.15)",
        cardActive:
          "0 12px 32px rgba(10, 14, 28, 0.1), 0 0 0 2px rgba(0, 102, 255, 0.3)",
        sidebar: "1px 0 0 rgba(226, 232, 240, 0.8)",
        aiGlow:
          "0 0 0 1px rgba(0, 102, 255, 0.3), 0 8px 24px rgba(0, 102, 255, 0.15)",
      },
    },
  },
  plugins: [animate],
};

export default config;
