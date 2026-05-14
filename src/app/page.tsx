"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Pencil, Settings } from "lucide-react";
import { AccountSwitcher } from "@/components/account-switcher";
import { TriagedInboxView } from "@/components/triaged-inbox-view";
import { ComposeDrawer } from "@/components/compose-drawer";
import { SearchBar } from "@/components/search-bar";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { Button } from "@/components/ui/button";
import { addAccount } from "@/lib/accounts/account-store";
import { toast } from "sonner";

export default function HomePage() {
  const [activeAccountId, setActiveAccountId] = useState<string | "unified">("unified");
  const [composeOpen, setComposeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <main className="space-y-8">
      <Suspense fallback={null}>
        <AuthCallback />
      </Suspense>
      <div className="flex items-center justify-between">
        <AccountSwitcher
          activeAccountId={activeAccountId}
          onChange={setActiveAccountId}
          onAddAccount={() => setAddOpen(true)}
        />
        <div className="flex items-center gap-2">
          <Button onClick={() => setComposeOpen(true)} size="sm">
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Compose
          </Button>
          <Link
            href="/settings"
            aria-label="Settings"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-textPrimary hover:bg-white/[0.04] transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
      <ComposeDrawer open={composeOpen} onOpenChange={setComposeOpen} />
      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} />
      <TriagedInboxView
        activeAccountId={activeAccountId}
        searchQuery={searchQuery}
        onAddAccount={() => setAddOpen(true)}
      />
    </main>
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
        toast.error("Handoff failed: " + (e instanceof Error ? e.message : "unknown"));
      }
    })();
  }, [params]);

  return null;
}
