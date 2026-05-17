"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell, type ActiveFilter } from "@/components/app-shell";
import { TriagedInboxView } from "@/components/triaged-inbox-view";
import { ComposeDrawer } from "@/components/compose-drawer";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { SearchBar } from "@/components/search-bar";
import { CommandPalette } from "@/components/command-palette";
import { addAccount } from "@/lib/accounts/account-store";
import { toast } from "sonner";

const VALID_FILTERS: ActiveFilter[] = [
  "all",
  "needs_reply",
  "fyi",
  "newsletter",
  "noise",
  "unclassified",
  "archived",
  "trashed",
];
const FILTER_KEY = "ua-email:filter";
const ACCOUNT_KEY = "ua-email:active-account";

export default function HomePage() {
  // Persist filter + active account across reloads. Sync runs every 60s
  // and re-renders this tree; without persistence the view would jump back
  // to "all / unified" on any state-resetting cycle.
  const [filter, setFilterState] = useState<ActiveFilter>("all");
  const [activeAccountId, setActiveAccountIdState] = useState<string | "unified">("unified");
  const [composeOpen, setComposeOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const f = window.localStorage.getItem(FILTER_KEY);
      if (f && (VALID_FILTERS as string[]).includes(f)) {
        setFilterState(f as ActiveFilter);
      }
      const a = window.localStorage.getItem(ACCOUNT_KEY);
      if (a) setActiveAccountIdState(a);
    } catch {
      /* localStorage can throw in private mode / quota — non-fatal */
    }
  }, []);

  function setFilter(next: ActiveFilter) {
    setFilterState(next);
    try {
      window.localStorage.setItem(FILTER_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function setActiveAccountId(next: string | "unified") {
    setActiveAccountIdState(next);
    try {
      window.localStorage.setItem(ACCOUNT_KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <Suspense fallback={null}>
        <AuthCallback />
      </Suspense>
      <Suspense fallback={null}>
        <DemoAutoLoad />
      </Suspense>
      <AppShell
        filter={filter}
        onFilterChange={setFilter}
        activeAccountId={activeAccountId}
        onAccountChange={setActiveAccountId}
        onCompose={() => setComposeOpen(true)}
        onAddAccount={() => setAddAccountOpen(true)}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-cardBorder bg-canvasSecondary px-2.5 py-1.5 text-[11px] font-medium text-textMuted shadow-card transition-colors hover:border-aiAccent/40 hover:text-aiAccentDeep"
            >
              <kbd className="font-mono">⌘K</kbd>
            </button>
          </div>
          <TriagedInboxView
            activeAccountId={activeAccountId}
            searchQuery={searchQuery}
            filter={filter}
            onAddAccount={() => setAddAccountOpen(true)}
          />
        </div>
      </AppShell>
      <ComposeDrawer open={composeOpen} onOpenChange={setComposeOpen} />
      <AddAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onFilterChange={setFilter}
        onCompose={() => setComposeOpen(true)}
        onAddAccount={() => setAddAccountOpen(true)}
      />
    </>
  );
}

// Demo auto-load: when the URL has ?demo=auto, seed the demo inbox silently
// on first render and strip the query param. Used by the video capture pipeline
// to land directly on a populated triaged inbox without ever showing Settings.
function DemoAutoLoad() {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("demo") !== "auto") return;
    (async () => {
      try {
        const { loadDemoInbox } = await import("@/lib/demo/load-demo");
        await loadDemoInbox();
        history.replaceState(null, "", "/");
      } catch {
        /* silent — the rest of the app still works */
      }
    })();
  }, [params]);
  return null;
}

function AuthCallback() {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("auth") !== "callback") return;
    (async () => {
      try {
        const res = await fetch("/api/auth/handoff", { method: "POST" });
        if (!res.ok) {
          toast.error("Sign-in handoff failed.");
          history.replaceState(null, "", "/");
          return;
        }
        const t = await res.json();
        if (!t.accessToken) {
          toast.error("Sign-in succeeded but no access token was issued.");
          history.replaceState(null, "", "/");
          return;
        }
        await addAccount({
          id: crypto.randomUUID(),
          provider: t.provider === "google" ? "gmail" : "outlook",
          email: t.email,
          label: t.email,
          oauthTokens: {
            accessToken: t.accessToken,
            refreshToken: t.refreshToken,
            expiresAt: t.expiresAt,
            scope: t.scope ?? "",
          },
          lastSyncAt: null,
        });
        toast.success(`Connected ${t.email}`);
        history.replaceState(null, "", "/");
      } catch (e) {
        toast.error(
          "Handoff failed: " + (e instanceof Error ? e.message : "unknown"),
        );
      }
    })();
  }, [params]);

  return null;
}
