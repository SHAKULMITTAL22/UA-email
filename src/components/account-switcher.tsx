"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/hooks/use-accounts";

interface Props {
  activeAccountId?: string | "unified";
  onChange?: (id: string | "unified") => void;
  onAddAccount?: () => void;
}

export function AccountSwitcher({ activeAccountId = "unified", onChange, onAddAccount }: Props) {
  const [open, setOpen] = useState(false);
  const accounts = useAccounts() ?? [];

  const active =
    activeAccountId === "unified"
      ? { id: "unified", email: accounts.length ? "All accounts" : "No accounts yet", label: "Unified Inbox" }
      : accounts.find((a) => a.id === activeAccountId);

  return (
    <>
      <div className="relative inline-block">
        <Button
          variant="ghost"
          className="gap-2 text-textPrimary"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Inbox className="h-4 w-4 text-aiAccent" aria-hidden />
          <span className="font-display text-xl italic leading-none">
            {active?.label ?? "No account"}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </Button>

        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            className="absolute left-0 top-full z-10 mt-2 w-72 rounded-drawer border border-aiAccentBorder bg-card p-1 shadow-cardHover"
          >
            <SwitcherItem
              label="Unified Inbox"
              sub={accounts.length ? `${accounts.length} account${accounts.length === 1 ? "" : "s"}` : "No accounts yet"}
              onClick={() => { onChange?.("unified"); setOpen(false); }}
              active={activeAccountId === "unified"}
            />
            {accounts.map((a) => (
              <SwitcherItem
                key={a.id}
                label={a.label}
                sub={a.email}
                onClick={() => { onChange?.(a.id); setOpen(false); }}
                active={a.id === activeAccountId}
              />
            ))}
            <li className="mt-1 border-t border-cardBorder pt-1">
              <button
                onClick={() => { setOpen(false); onAddAccount?.(); }}
                className="flex w-full items-center gap-2 rounded-card px-3 py-2 text-sm text-aiAccent hover:bg-aiAccentSoft"
              >
                <Plus className="h-4 w-4" />
                Add account
              </button>
            </li>
          </motion.ul>
        )}
      </div>
    </>
  );
}

function SwitcherItem({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        role="option"
        aria-selected={active}
        className={cn(
          "flex w-full items-center gap-3 rounded-card px-3 py-2 text-left transition-colors hover:bg-aiAccentSoft",
          active && "bg-aiAccentSoft",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 shrink-0 rounded-full transition-colors",
            active ? "bg-aiAccent shadow-[0_0_8px_-1px_#0066ff]" : "bg-cardBorder",
          )}
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-textPrimary">{label}</span>
          <span className="truncate text-xs text-textMuted">{sub}</span>
        </span>
      </button>
    </li>
  );
}
