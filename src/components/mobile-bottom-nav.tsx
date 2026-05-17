"use client";

import { Inbox, Reply, Info, Newspaper, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveFilter } from "@/components/app-shell";

const ITEMS: Array<{ id: ActiveFilter; label: string; icon: typeof Inbox }> = [
  { id: "all", label: "All", icon: Inbox },
  { id: "needs_reply", label: "Reply", icon: Reply },
  { id: "fyi", label: "FYI", icon: Info },
  { id: "newsletter", label: "News", icon: Newspaper },
  { id: "archived", label: "Archive", icon: Archive },
];

interface MobileBottomNavProps {
  filter: ActiveFilter;
  onFilterChange: (f: ActiveFilter) => void;
}

export function MobileBottomNav({ filter, onFilterChange }: MobileBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 border-t border-cardBorder bg-canvas/95 backdrop-blur-xl lg:hidden"
      aria-label="Filter buckets"
    >
      <div className="flex items-stretch justify-around">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const active = filter === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onFilterChange(it.id)}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors",
                active ? "text-aiAccent" : "text-textMuted",
              )}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="text-[10px] font-medium">{it.label}</span>
              {active && (
                <span
                  className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-aiAccent"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
