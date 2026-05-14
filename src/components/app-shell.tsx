"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export type ActiveFilter =
  | "all"
  | "needs_reply"
  | "fyi"
  | "newsletter"
  | "noise"
  | "unclassified";

interface AppShellProps {
  children: React.ReactNode;
  filter: ActiveFilter;
  onFilterChange: (f: ActiveFilter) => void;
  activeAccountId: string | "unified";
  onAccountChange: (id: string | "unified") => void;
  onCompose: () => void;
  onAddAccount?: () => void;
}

export function AppShell({
  children,
  filter,
  onFilterChange,
  activeAccountId,
  onAccountChange,
  onCompose,
  onAddAccount,
}: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <MobileTopBar
        onMenuClick={() => setMobileSidebarOpen(true)}
        onCompose={onCompose}
      />

      <Sidebar
        filter={filter}
        onFilterChange={onFilterChange}
        activeAccountId={activeAccountId}
        onAccountChange={onAccountChange}
        onCompose={onCompose}
        {...(onAddAccount ? { onAddAccount } : {})}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <main className="flex-1 min-w-0 pb-24 lg:pb-0">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>

      <MobileBottomNav filter={filter} onFilterChange={onFilterChange} />
    </div>
  );
}
