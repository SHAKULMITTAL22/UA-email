import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0f0f14",
        card: "rgba(255,255,255,0.04)",
        cardBorder: "rgba(255,255,255,0.08)",
        textPrimary: "#fafafa",
        textMuted: "#a1a1aa",
        textDim: "#71717a",
        aiAccent: "#a78bfa",
        bucket: {
          needsReply: "#a78bfa",
          fyi: "#60a5fa",
          newsletter: "#facc15",
          noise: "#71717a",
        },
      },
      fontFamily: {
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
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
      backdropBlur: { card: "8px" },
    },
  },
  plugins: [animate],
};

export default config;
