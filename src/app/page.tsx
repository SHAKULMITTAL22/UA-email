"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccountSwitcher } from "@/components/account-switcher";
import { TriagedInboxView } from "@/components/triaged-inbox-view";
import { addAccount } from "@/lib/accounts/account-store";
import { toast } from "sonner";

export default function HomePage() {
  const [activeAccountId, setActiveAccountId] = useState<string | "unified">("unified");

  return (
    <main className="space-y-8">
      <Suspense fallback={null}>
        <AuthCallback />
      </Suspense>
      <div className="flex items-center justify-between">
        <AccountSwitcher activeAccountId={activeAccountId} onChange={setActiveAccountId} />
      </div>
      <TriagedInboxView activeAccountId={activeAccountId} />
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
