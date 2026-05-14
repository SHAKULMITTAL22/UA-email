"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  /** Phase-2 plugs in real accounts from Dexie. */
  accounts?: { id: string; email: string; label: string }[];
  activeAccountId?: string | "unified";
  onChange?: (id: string | "unified") => void;
}

export function AccountSwitcher({ accounts = [], activeAccountId = "unified", onChange }: Props) {
  const [open, setOpen] = useState(false);
  const active =
    activeAccountId === "unified"
      ? { id: "unified", email: "All accounts", label: "Unified Inbox" }
      : accounts.find((a) => a.id === activeAccountId);

  return (
    <div className="relative inline-block">
      <Button
        variant="ghost"
        className="gap-2 text-textPrimary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Inbox className="h-4 w-4 text-aiAccent" aria-hidden />
        <span className="font-display italic text-lg">{active?.label ?? "No account"}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <motion.ul
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          role="listbox"
          className="absolute left-0 top-full z-10 mt-2 w-72 rounded-drawer border border-cardBorder bg-card backdrop-blur-card p-1"
        >
          <SwitcherItem label="Unified Inbox" sub="All accounts" onClick={() => { onChange?.("unified"); setOpen(false); }} active={activeAccountId === "unified"} />
          {accounts.map((a) => (
            <SwitcherItem key={a.id} label={a.label} sub={a.email} onClick={() => { onChange?.(a.id); setOpen(false); }} active={a.id === activeAccountId} />
          ))}
          <li className="mt-1 border-t border-cardBorder pt-1">
            <button className="flex w-full items-center gap-2 rounded-card px-3 py-2 text-sm text-aiAccent hover:bg-white/5">
              <Plus className="h-4 w-4" />
              Add account
            </button>
          </li>
        </motion.ul>
      )}
    </div>
  );
}

function SwitcherItem({ label, sub, active, onClick }: { label: string; sub: string; active?: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        role="option"
        aria-selected={active}
        className={cn(
          "flex w-full flex-col items-start rounded-card px-3 py-2 text-left transition-colors hover:bg-white/5",
          active && "bg-white/5",
        )}
      >
        <span className="text-sm text-textPrimary">{label}</span>
        <span className="text-xs text-textMuted">{sub}</span>
      </button>
    </li>
  );
}
