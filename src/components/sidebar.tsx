"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  Reply,
  Info,
  Newspaper,
  Trash2,
  Settings,
  Pencil,
  Sparkles,
  X,
  Plus,
} from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { useTriagedInbox } from "@/hooks/use-triaged-inbox";
import { useAccounts } from "@/hooks/use-accounts";
import { useMagnetic } from "@/hooks/use-magnetic";
import { cn } from "@/lib/utils";
import type { ActiveFilter } from "@/components/app-shell";

const FILTER_ITEMS: Array<{
  id: ActiveFilter;
  label: string;
  icon: typeof Inbox;
  bucketColor: string;
}> = [
  { id: "all", label: "Unified Inbox", icon: Inbox, bucketColor: "text-aiAccent" },
  {
    id: "needs_reply",
    label: "Needs reply",
    icon: Reply,
    bucketColor: "text-bucket-needsReply",
  },
  { id: "fyi", label: "FYI", icon: Info, bucketColor: "text-bucket-fyi" },
  {
    id: "newsletter",
    label: "Newsletters",
    icon: Newspaper,
    bucketColor: "text-bucket-newsletter",
  },
  { id: "noise", label: "Noise", icon: Trash2, bucketColor: "text-bucket-noise" },
];

interface SidebarProps {
  filter: ActiveFilter;
  onFilterChange: (f: ActiveFilter) => void;
  activeAccountId: string | "unified";
  onAccountChange: (id: string | "unified") => void;
  onCompose: () => void;
  onAddAccount?: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  filter,
  onFilterChange,
  activeAccountId,
  onAccountChange,
  onCompose,
  onAddAccount,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const triaged = useTriagedInbox(activeAccountId);
  const accounts = useAccounts();
  const composeRef = useMagnetic<HTMLButtonElement>(0.25);

  const counts: Record<ActiveFilter, number> = {
    all: triaged?.reduce((a, b) => a + b.messages.length, 0) ?? 0,
    needs_reply: triaged?.find((b) => b.bucket === "needs_reply")?.messages.length ?? 0,
    fyi: triaged?.find((b) => b.bucket === "fyi")?.messages.length ?? 0,
    newsletter: triaged?.find((b) => b.bucket === "newsletter")?.messages.length ?? 0,
    noise: triaged?.find((b) => b.bucket === "noise")?.messages.length ?? 0,
    unclassified:
      triaged?.find((b) => b.bucket === "unclassified")?.messages.length ?? 0,
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const content = (
    <div className="flex h-full flex-col gap-6 p-5">
      <Link
        href="/"
        className="hidden lg:inline-flex outline-none focus-visible:ring-2 focus-visible:ring-aiAccent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded-sm"
      >
        <Wordmark size="md" />
      </Link>

      <Button
        ref={composeRef}
        onClick={onCompose}
        className="w-full justify-start gap-2 transition-transform shadow-aiGlow"
      >
        <Pencil className="h-4 w-4" />
        Compose
      </Button>

      <nav className="space-y-1" aria-label="Filters">
        <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-textMuted">
          Filters
        </div>
        {FILTER_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = filter === item.id;
          return (
            <button
              key={item.id}
              data-active={isActive}
              onClick={() => {
                onFilterChange(item.id);
                onMobileClose();
              }}
              className="sidebar-item w-full"
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-aiAccent" : item.bucketColor,
                )}
                aria-hidden
              />
              <span>{item.label}</span>
              {counts[item.id] > 0 && (
                <span className="sidebar-count">{counts[item.id]}</span>
              )}
            </button>
          );
        })}
      </nav>

      <nav className="space-y-1" aria-label="Accounts">
        <div className="flex items-center justify-between px-3 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-textMuted">
            Accounts
          </span>
          {onAddAccount && (
            <button
              onClick={() => {
                onAddAccount();
                onMobileClose();
              }}
              aria-label="Add account"
              className="rounded-md p-1 text-textDim hover:bg-aiAccentSoft hover:text-aiAccent transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          data-active={activeAccountId === "unified"}
          onClick={() => {
            onAccountChange("unified");
            onMobileClose();
          }}
          className="sidebar-item w-full"
          aria-current={activeAccountId === "unified" ? "page" : undefined}
        >
          <Sparkles className="h-4 w-4 text-aiAccent" aria-hidden />
          <span>All accounts</span>
        </button>
        {accounts?.map((a) => (
          <button
            key={a.id}
            data-active={activeAccountId === a.id}
            onClick={() => {
              onAccountChange(a.id);
              onMobileClose();
            }}
            className="sidebar-item w-full"
            aria-current={activeAccountId === a.id ? "page" : undefined}
          >
            <span
              aria-hidden
              className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-aiAccentSoft text-[10px] font-semibold text-aiAccent"
            >
              {a.email[0]?.toUpperCase() ?? "?"}
            </span>
            <span className="truncate">{a.email}</span>
          </button>
        ))}
        {accounts && accounts.length === 0 && onAddAccount && (
          <button
            onClick={() => {
              onAddAccount();
              onMobileClose();
            }}
            className="sidebar-item w-full !text-aiAccentDeep font-medium"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span>Add account</span>
          </button>
        )}
      </nav>

      <div className="mt-auto space-y-1 border-t border-cardBorder pt-4">
        <Link
          href="/settings"
          className="sidebar-item"
          onClick={onMobileClose}
        >
          <Settings className="h-4 w-4" aria-hidden />
          <span>Settings</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className="hidden lg:flex lg:w-[260px] lg:flex-shrink-0 lg:flex-col lg:bg-canvasSecondary lg:border-r lg:border-cardBorder"
        aria-label="Primary navigation"
      >
        {content}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-textPrimary/40 lg:hidden"
              onClick={onMobileClose}
              aria-hidden
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] overflow-y-auto bg-canvas shadow-2xl lg:hidden"
              aria-label="Primary navigation"
            >
              <div className="flex items-center justify-between border-b border-cardBorder p-5">
                <Wordmark size="sm" />
                <button
                  onClick={onMobileClose}
                  aria-label="Close menu"
                  className="rounded-full p-1 text-textMuted transition-colors hover:bg-aiAccentSoft hover:text-aiAccent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
