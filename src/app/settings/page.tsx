"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, RotateCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/hooks/use-settings";
import { useAccounts } from "@/hooks/use-accounts";
import { removeAccount } from "@/lib/accounts/account-store";
import { retriageAll } from "@/lib/sync/sync-loop";
import { toast } from "sonner";

type AppSettingsProvider = "anthropic" | "openai" | "gemini";

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const accounts = useAccounts();
  const [retriaging, setRetriaging] = useState(false);

  async function handleRetriageAll() {
    setRetriaging(true);
    try {
      const byok = settings.byok[settings.llmProvider];
      const result = await retriageAll({
        provider: settings.llmProvider,
        ...(byok ? { byok } : {}),
      });
      if (result.aiError) {
        toast.error(`AI failed (${result.aiError.cause}): ${result.aiError.message}`);
      } else if (result.totalUnclassified === 0) {
        toast.success("Nothing to re-triage — every message is already classified.");
      } else {
        toast.success(`Re-triaged ${result.processed} of ${result.totalUnclassified} messages.`);
      }
    } catch (e) {
      toast.error(`Re-triage failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setRetriaging(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-textMuted hover:text-textPrimary">
        <ChevronLeft className="h-4 w-4" /> Back to inbox
      </Link>

      <h1 className="font-display text-3xl text-textPrimary">Settings</h1>

      <section className="space-y-3 rounded-card border border-aiAccent/30 bg-aiAccent/[0.04] p-4">
        <h2 className="text-xs uppercase tracking-[2px] text-aiAccent">— Try the demo</h2>
        <p className="text-sm text-textMuted">
          No accounts? No API keys? Load 12 realistic emails with pre-baked AI triage results to see UA-Email in action.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              const { loadDemoInbox } = await import("@/lib/demo/load-demo");
              await loadDemoInbox();
              toast.success("Demo inbox loaded — head back to home");
            }}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Load demo inbox
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              const { clearDemoInbox } = await import("@/lib/demo/load-demo");
              await clearDemoInbox();
              toast.success("Demo data cleared");
            }}
          >
            Clear demo
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-card border border-cardBorder bg-card p-4">
        <h2 className="text-xs uppercase tracking-[2px] text-aiAccent">— Re-triage your inbox</h2>
        <p className="text-sm text-textMuted">
          Process every unclassified message in your real accounts in one pass. Use this after fixing an API key or switching LLM providers.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleRetriageAll} disabled={retriaging}>
            <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${retriaging ? "animate-spin" : ""}`} />
            {retriaging ? "Re-triaging…" : "Re-triage all unclassified"}
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              if (typeof navigator !== "undefined" && navigator.serviceWorker) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const r of regs) await r.unregister();
                if (typeof caches !== "undefined") {
                  const keys = await caches.keys();
                  await Promise.all(keys.map((k) => caches.delete(k)));
                }
                toast.success("Cache cleared. Reloading…");
                setTimeout(() => location.reload(), 500);
              }
            }}
          >
            Force update (clears cache)
          </Button>
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[2px] text-aiAccent">— AI provider</h2>
        <div className="space-y-2">
          <Label htmlFor="llmProvider">Default LLM</Label>
          <select
            id="llmProvider"
            value={settings.llmProvider}
            onChange={(e) => void update({ llmProvider: e.target.value as AppSettingsProvider })}
            className="w-full bg-card border border-cardBorder rounded-card px-3 py-2 text-sm text-textPrimary"
          >
            <option value="anthropic">Anthropic Claude (default — with prompt caching)</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="anthropic-byok">Anthropic API key (optional — BYOK)</Label>
          <Input
            id="anthropic-byok"
            type="password"
            placeholder="sk-ant-..."
            value={settings.byok.anthropic ?? ""}
            onChange={(e) => void update({ byok: { ...settings.byok, anthropic: e.target.value } })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="openai-byok">OpenAI API key (BYOK)</Label>
          <Input
            id="openai-byok"
            type="password"
            placeholder="sk-..."
            value={settings.byok.openai ?? ""}
            onChange={(e) => void update({ byok: { ...settings.byok, openai: e.target.value } })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gemini-byok">Gemini API key (BYOK)</Label>
          <Input
            id="gemini-byok"
            type="password"
            value={settings.byok.gemini ?? ""}
            onChange={(e) => void update({ byok: { ...settings.byok, gemini: e.target.value } })}
          />
        </div>
        <p className="text-xs text-textMuted italic">
          Keys stay in your browser. Sent to /api/ai/* on each request, never persisted server-side.
        </p>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[2px] text-aiAccent">— Sync</h2>
        <div className="space-y-2">
          <Label htmlFor="sync-interval">Sync interval (seconds)</Label>
          <Input
            id="sync-interval"
            type="number"
            min={15}
            max={3600}
            value={settings.syncIntervalSec}
            onChange={(e) =>
              void update({ syncIntervalSec: Math.max(15, Math.min(3600, Number(e.target.value))) })
            }
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[2px] text-aiAccent">— Accounts</h2>
        {!accounts?.length && <p className="text-sm text-textMuted">No accounts yet.</p>}
        {accounts?.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-card border border-cardBorder bg-card p-3">
            <div>
              <div className="text-sm text-textPrimary">{a.label}</div>
              <div className="text-xs text-textMuted">
                {a.email} · {a.provider}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!confirm(`Remove ${a.email}? All its cached messages will be deleted from this device.`)) return;
                await removeAccount(a.id);
                toast.success("Account removed");
              }}
              className="text-red-400 hover:text-red-300"
            >
              Remove
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
