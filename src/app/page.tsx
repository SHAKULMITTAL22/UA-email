"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell, type ActiveFilter } from "@/components/app-shell";
import { TriagedInboxView } from "@/components/triaged-inbox-view";
import { ComposeDrawer } from "@/components/compose-drawer";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { SearchBar } from "@/components/search-bar";
import { addAccount } from "@/lib/accounts/account-store";
import { toast } from "sonner";

export default function HomePage() {
  const [filter, setFilter] = useState<ActiveFilter>("all");
  const [activeAccountId, setActiveAccountId] = useState<string | "unified">(
    "unified",
  );
  const [composeOpen, setComposeOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      <Suspense fallback={null}>
        <AuthCallback />
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
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
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
    </>
  );
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
