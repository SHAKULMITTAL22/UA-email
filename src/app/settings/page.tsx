"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, RotateCw, CheckCircle2, XCircle, Save, AlertTriangle } from "lucide-react";
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

interface TestResult {
  ok: boolean;
  providerSent: string;
  modelUsed?: string;
  keyMasked: string;
  errorCause?: string;
  errorMessage?: string;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const accounts = useAccounts();
  const [retriaging, setRetriaging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Draft key — held locally so we can save + verify in one click,
  // instead of dribbling characters into IndexedDB on every keystroke.
  const [draftKey, setDraftKey] = useState<string>("");
  useEffect(() => {
    setDraftKey(settings.byok[settings.llmProvider] ?? "");
    setTestResult(null); // reset test when provider changes
  }, [settings.llmProvider, settings.byok]);

  // Detect when a key is stashed under a different provider than the active one
  const orphanProvider = (() => {
    if (settings.byok[settings.llmProvider]) return null;
    for (const p of ["anthropic", "openai", "gemini"] as const) {
      if (p !== settings.llmProvider && settings.byok[p]) return p;
    }
    return null;
  })();

  async function saveAndVerify() {
    const provider = settings.llmProvider;
    const byok = draftKey.trim();

    // Client-side guard: don't even fire the request with empty key
    if (!byok) {
      toast.error("Paste your API key in the field above first.");
      return;
    }

    setSaving(true);
    setTestResult(null);
    const keyMasked = `${byok.slice(0, 4)}…${byok.slice(-3)} (${byok.length} chars)`;

    // 1) Persist the key
    await update({
      byok: { ...settings.byok, [provider]: byok } as typeof settings.byok,
    });

    // 2) Hit the API to verify
    try {
      const res = await fetch("/api/ai/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          byok,
          emails: [
            {
              messageId: "test-ping",
              from: "test@ua-email.dev",
              subject: "Connection test",
              bodyExcerpt: "Connection test from Settings.",
              receivedAt: Date.now(),
            },
          ],
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        setTestResult({
          ok: false,
          providerSent: provider,
          keyMasked,
          errorCause: body.error ?? `HTTP ${res.status}`,
          errorMessage: body.message ?? "(no message)",
        });
        return;
      }

      const data = (await res.json()) as { model: string };
      setTestResult({
        ok: true,
        providerSent: provider,
        modelUsed: data.model,
        keyMasked,
      });

      // 3) Persist the verified state so the green banner survives refresh
      await update({
        lastVerified: {
          provider,
          model: data.model,
          keySuffix: byok.slice(-8),
          at: Date.now(),
        },
      });

      toast.success(`Saved & verified · ${provider} (${data.model})`);
    } catch (e) {
      setTestResult({
        ok: false,
        providerSent: provider,
        keyMasked,
        errorCause: "network",
        errorMessage: e instanceof Error ? e.message : "unknown",
      });
    } finally {
      setSaving(false);
    }
  }

  // Show the green banner on load if a verified state is persisted AND the
  // current provider + key match what was verified. Avoids stale "verified"
  // claims after the user changes provider or rotates the key.
  const currentKey = settings.byok[settings.llmProvider];
  const verifiedForCurrent =
    settings.lastVerified &&
    settings.lastVerified.provider === settings.llmProvider &&
    currentKey &&
    currentKey.endsWith(settings.lastVerified.keySuffix)
      ? settings.lastVerified
      : null;

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

        {/* Big status banner — verified-good takes the prize spot when last test passed
            OR when a persisted-verified state matches the current provider+key */}
        {testResult?.ok || verifiedForCurrent ? (
          <div className="rounded-card border border-green-500/40 bg-green-500/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <span className="font-medium text-green-300">LLM configured correctly</span>
            </div>
            <div className="text-xs text-green-300/80 font-mono">
              {testResult?.ok
                ? `${testResult.providerSent} · ${testResult.modelUsed} · key ${testResult.keyMasked}`
                : `${verifiedForCurrent!.provider} · ${verifiedForCurrent!.model} · verified ${formatRelativeTime(verifiedForCurrent!.at)}`}
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-aiAccent/30 bg-aiAccent/[0.05] p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-textMuted">Currently active:</span>
              <span className="font-medium text-aiAccent">
                {settings.llmProvider === "anthropic" && "Anthropic Claude"}
                {settings.llmProvider === "openai" && "OpenAI"}
                {settings.llmProvider === "gemini" && "Google Gemini"}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-textMuted">API key:</span>
              <span className={settings.byok[settings.llmProvider] ? "text-green-400" : "text-amber-400"}>
                {settings.byok[settings.llmProvider]
                  ? `set (${(settings.byok[settings.llmProvider] ?? "").length} chars) · click Save & verify`
                  : "not set — paste a key below"}
              </span>
            </div>
          </div>
        )}

        {/* Auto-detect wrong-provider — when a key is stashed under a different provider */}
        {orphanProvider && (
          <div className="rounded-card border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-200">
                  You have a <strong>{orphanProvider === "anthropic" ? "Anthropic" : orphanProvider === "openai" ? "OpenAI" : "Gemini"}</strong> key saved, but{" "}
                  <strong>{settings.llmProvider === "anthropic" ? "Anthropic" : settings.llmProvider === "openai" ? "OpenAI" : "Gemini"}</strong> is currently active. Switch?
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void update({ llmProvider: orphanProvider })}
                >
                  Switch to {orphanProvider === "anthropic" ? "Anthropic" : orphanProvider === "openai" ? "OpenAI" : "Gemini"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="llmProvider">Active LLM</Label>
          <select
            id="llmProvider"
            value={settings.llmProvider}
            onChange={(e) => void update({ llmProvider: e.target.value as AppSettingsProvider })}
            className="w-full bg-card border border-cardBorder rounded-card px-3 py-2 text-sm text-textPrimary"
          >
            <option value="anthropic">Anthropic Claude (with prompt caching)</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>

        {/* Single BYOK field for the active provider — value held in local draft state */}
        <div className="space-y-2">
          <Label htmlFor="active-byok">
            {settings.llmProvider === "anthropic" && "Anthropic API key"}
            {settings.llmProvider === "openai" && "OpenAI API key"}
            {settings.llmProvider === "gemini" && "Google Gemini API key"}
          </Label>
          <Input
            id="active-byok"
            type="password"
            placeholder={
              settings.llmProvider === "anthropic"
                ? "sk-ant-..."
                : settings.llmProvider === "openai"
                  ? "sk-..."
                  : "AIza..."
            }
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveAndVerify();
            }}
          />
        </div>

        <p className="text-xs text-textMuted italic">
          Keys stay in your browser. Sent to /api/ai/* on each request, never persisted server-side.
        </p>

        <div className="pt-1 flex gap-2">
          <Button onClick={saveAndVerify} disabled={saving}>
            <Save className={`h-3.5 w-3.5 mr-1.5 ${saving ? "animate-pulse" : ""}`} />
            {saving ? "Saving & verifying…" : "Save & verify"}
          </Button>
        </div>

        {testResult && !testResult.ok && (
          <div className="mt-2 rounded-card border border-red-500/30 bg-red-500/10 p-3 text-xs space-y-1" role="status">
            <div className="flex items-center gap-2 font-medium">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-red-300">Verification failed</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-0.5 mt-2 text-textMuted font-mono">
              <span>provider:</span>
              <span className="text-textPrimary">{testResult.providerSent}</span>
              <span>api key:</span>
              <span className="text-textPrimary">{testResult.keyMasked}</span>
              <span>cause:</span>
              <span className="text-red-300">{testResult.errorCause}</span>
              <span>message:</span>
              <span className="text-red-300 break-words">{testResult.errorMessage}</span>
            </div>
            {testResult.errorCause === "auth" && testResult.providerSent === "anthropic" && (
              <p className="mt-2 text-xs text-amber-300 italic">
                Hint: the request was sent with provider=&quot;anthropic&quot;. If you intended Gemini, change the dropdown above to &quot;Google Gemini&quot; — pasting a key in BYOK doesn&apos;t change the active provider.
              </p>
            )}
          </div>
        )}
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
