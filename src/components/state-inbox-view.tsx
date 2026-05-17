"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Archive, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TriageCard } from "@/components/triage-card";
import { useStateMessages } from "@/hooks/use-triaged-inbox";
import { getDB } from "@/lib/db/db";
import { motion as motionTokens } from "@/styles/motion-tokens";
import type { MessageRow } from "@/lib/db/schema";

interface Props {
  state: "archived" | "trashed";
  activeAccountId?: string | "unified";
  searchQuery?: string;
}

const META: Record<
  Props["state"],
  { label: string; icon: typeof Archive; blurb: string }
> = {
  archived: {
    label: "Archived",
    icon: Archive,
    blurb: "Messages you archived. Still searchable, hidden from buckets.",
  },
  trashed: {
    label: "Trash",
    icon: Trash2,
    blurb: "Deleted messages. Empty trash to remove from this device permanently.",
  },
};

export function StateInboxView({ state, activeAccountId, searchQuery = "" }: Props) {
  const messages = useStateMessages(state, activeAccountId);
  const [emptying, setEmptying] = useState(false);
  const meta = META[state];
  const Icon = meta.icon;

  const filtered = (() => {
    if (!messages) return messages;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.snippet.toLowerCase().includes(q) ||
        m.from.email.toLowerCase().includes(q),
    );
  })();

  async function restore(m: MessageRow) {
    await getDB().messages.update(m.id, {
      flags: { ...m.flags, archived: false, trashed: false },
    });
    toast.success("Restored to inbox");
  }

  async function emptyTrash() {
    if (!messages || messages.length === 0) return;
    if (
      !confirm(
        `Empty trash? This will permanently remove ${messages.length} message${messages.length === 1 ? "" : "s"} from this device. They are not removed from the email server.`,
      )
    )
      return;
    setEmptying(true);
    try {
      const db = getDB();
      const ids = messages.map((m) => m.id);
      await db.messages.bulkDelete(ids);
      toast.success(`Trash emptied (${ids.length} message${ids.length === 1 ? "" : "s"})`);
    } finally {
      setEmptying(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl text-textPrimary sm:text-4xl flex items-center gap-2">
            <Icon className="h-7 w-7 text-textMuted" aria-hidden />
            {meta.label}
          </h1>
          {state === "trashed" && messages && messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void emptyTrash()}
              disabled={emptying}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {emptying ? "Emptying…" : "Empty trash"}
            </Button>
          )}
        </div>
        <p className="text-sm text-textMuted max-w-2xl">{meta.blurb}</p>
      </header>

      {messages === undefined ? (
        <p className="text-sm text-textMuted">Loading…</p>
      ) : filtered && filtered.length === 0 ? (
        <div className="rounded-card border border-cardBorder bg-card p-10 text-center">
          <Icon className="h-8 w-8 text-textDim mx-auto mb-3" aria-hidden />
          <p className="text-sm text-textMuted">
            {searchQuery.trim()
              ? `No ${state} messages match "${searchQuery}".`
              : `Nothing ${state === "archived" ? "archived" : "in trash"} yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered?.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: motionTokens.duration.base,
                delay: Math.min(i * 0.02, 0.4),
                ease: motionTokens.ease.out,
              }}
              className="group/state relative"
            >
              <TriageCard message={m} />
              {/* Restore button overlay (top-right, on hover) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void restore(m);
                }}
                title="Restore to inbox"
                aria-label="Restore to inbox"
                className="absolute right-2 top-2 z-10 hidden rounded-md border border-cardBorder bg-canvasSecondary p-1.5 text-textMuted shadow-card transition-colors hover:border-aiAccent hover:text-aiAccent group-hover/state:inline-flex"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
