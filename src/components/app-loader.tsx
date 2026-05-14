"use client";

import { Wordmark } from "@/components/wordmark";

export function AppLoader() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6"
      role="status"
      aria-label="Loading UA Email"
    >
      <Wordmark size="lg" />
      <div aria-hidden className="relative h-9 w-9">
        <span className="absolute inset-0 rounded-full border border-white/10" />
        <span
          className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-aiAccent border-r-aiAccent/60"
          style={{ animationDuration: "900ms" }}
        />
      </div>
    </div>
  );
}
