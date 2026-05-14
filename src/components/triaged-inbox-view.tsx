"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion as motionTokens } from "@/styles/motion-tokens";

const BUCKETS = [
  { id: "needs_reply", label: "Needs reply", color: "text-bucket-needsReply" },
  { id: "fyi", label: "FYI", color: "text-bucket-fyi" },
  { id: "newsletter", label: "Newsletters", color: "text-bucket-newsletter" },
  { id: "noise", label: "Noise", color: "text-bucket-noise" },
] as const;

/**
 * Phase-1: empty-state shell. Each bucket renders with a skeleton card
 * to communicate that the AI pipeline runs here once Phase 2 wires it.
 */
export function TriagedInboxView({ loading = true }: { loading?: boolean }) {
  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-textPrimary">Your inbox, triaged</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-textMuted">
            <Sparkles className="h-3.5 w-3.5 text-aiAccent" aria-hidden />
            <span>Add an account to begin.</span>
          </p>
        </div>
      </header>

      <div className="space-y-6">
        {BUCKETS.map((b, i) => (
          <motion.section
            key={b.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: motionTokens.duration.base, delay: i * 0.04, ease: motionTokens.ease.out }}
            aria-labelledby={`bucket-${b.id}`}
          >
            <h2
              id={`bucket-${b.id}`}
              className={cn("mb-2 text-xs uppercase tracking-[2px]", b.color)}
            >
              — {b.label}
            </h2>
            <div className="space-y-2">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full rounded-card bg-card" />
                  <Skeleton className="h-20 w-full rounded-card bg-card opacity-60" />
                </>
              ) : (
                <p className="text-sm text-textMuted">No mail in this bucket yet.</p>
              )}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
}
