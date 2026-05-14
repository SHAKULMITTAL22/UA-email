"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { AccountSwitcher } from "@/components/account-switcher";
import { TriagedInboxView } from "@/components/triaged-inbox-view";
import { ComposeDrawer } from "@/components/compose-drawer";
import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { addAccount } from "@/lib/accounts/account-store";
import { toast } from "sonner";

export default function HomePage() {
  const [activeAccountId, setActiveAccountId] = useState<string | "unified">("unified");
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <main className="space-y-8">
      <Suspense fallback={null}>
        <AuthCallback />
      </Suspense>
      <div className="flex items-center justify-between">
        <AccountSwitcher activeAccountId={activeAccountId} onChange={setActiveAccountId} />
        <Button onClick={() => setComposeOpen(true)} size="sm">
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Compose
        </Button>
      </div>
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
      <ComposeDrawer open={composeOpen} onOpenChange={setComposeOpen} />
      <TriagedInboxView activeAccountId={activeAccountId} searchQuery={searchQuery} />
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
