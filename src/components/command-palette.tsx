"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Pencil,
  Inbox,
  Reply,
  Info,
  Newspaper,
  Trash2,
  Settings,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { ActiveFilter } from "@/components/app-shell";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onFilterChange: (f: ActiveFilter) => void;
  onCompose: () => void;
  onAddAccount: () => void;
}

interface Action {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  onSelect: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onFilterChange,
  onCompose,
  onAddAccount,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const actions: Action[] = [
    {
      id: "compose",
      label: "Compose new email",
      icon: Pencil,
      hint: "C",
      onSelect: () => {
        onCompose();
        onOpenChange(false);
      },
    },
    {
      id: "add-account",
      label: "Add account",
      icon: Plus,
      onSelect: () => {
        onAddAccount();
        onOpenChange(false);
      },
    },
    {
      id: "f-all",
      label: "Show unified inbox",
      icon: Inbox,
      onSelect: () => {
        onFilterChange("all");
        onOpenChange(false);
      },
    },
    {
      id: "f-reply",
      label: "Show needs reply",
      icon: Reply,
      onSelect: () => {
        onFilterChange("needs_reply");
        onOpenChange(false);
      },
    },
    {
      id: "f-fyi",
      label: "Show FYI",
      icon: Info,
      onSelect: () => {
        onFilterChange("fyi");
        onOpenChange(false);
      },
    },
    {
      id: "f-news",
      label: "Show newsletters",
      icon: Newspaper,
      onSelect: () => {
        onFilterChange("newsletter");
        onOpenChange(false);
      },
    },
    {
      id: "f-noise",
      label: "Show noise",
      icon: Trash2,
      onSelect: () => {
        onFilterChange("noise");
        onOpenChange(false);
      },
    },
    {
      id: "settings",
      label: "Open settings",
      icon: Settings,
      onSelect: () => {
        router.push("/settings");
        onOpenChange(false);
      },
    },
  ];

  const filtered = query.trim()
    ? actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
    : actions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Quickly switch filters, compose a message, or open settings.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b border-cardBorder px-4 py-3">
          <Search className="h-4 w-4 text-textDim" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands..."
            aria-label="Search commands"
            className="flex-1 bg-transparent text-sm text-textPrimary placeholder:text-textDim focus:outline-none"
          />
          <kbd className="rounded border border-cardBorder px-1.5 py-0.5 text-[10px] font-mono text-textMuted">
            esc
          </kbd>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2">
          {filtered.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={a.onSelect}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-textPrimary transition-colors hover:bg-aiAccentSoft hover:text-aiAccentDeep"
              >
                <Icon className="h-4 w-4 text-textMuted" aria-hidden />
                <span className="flex-1 text-left">{a.label}</span>
                {a.hint && (
                  <kbd className="rounded border border-cardBorder px-1.5 py-0.5 text-[10px] font-mono text-textMuted">
                    {a.hint}
                  </kbd>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-textDim">
              No commands match.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
