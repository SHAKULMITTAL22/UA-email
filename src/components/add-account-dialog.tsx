"use client";

import { useState } from "react";
import { Mail, AtSign, Lock, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { addAccount } from "@/lib/accounts/account-store";
import { presetForEmail } from "@/lib/accounts/imap-server-presets";
import { toast } from "sonner";
import { ImapProvider } from "@/lib/providers/imap/imap-provider";
import type { Account } from "@/lib/types/account";
import { signIn } from "next-auth/react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountAdded?: () => void;
}

export function AddAccountDialog({ open, onOpenChange, onAccountAdded }: Props) {
  const [mode, setMode] = useState<"choose" | "imap">("choose");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = email.includes("@") ? presetForEmail(email) : undefined;

  async function handleImapSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!preset) {
      setError("Couldn't auto-detect server for this domain. Custom IMAP is not yet supported.");
      return;
    }

    const account: Account = {
      id: crypto.randomUUID(),
      provider: "imap",
      email,
      label: label || `IMAP — ${email}`,
      imapCreds: {
        host: preset.host,
        port: preset.port,
        secure: preset.secure,
        user: email,
        pass,
      },
      lastSyncAt: null,
    };

    setSubmitting(true);
    try {
      const provider = new ImapProvider(account);
      await provider.list({ limit: 1 });
      await addAccount(account);
      toast.success(`Connected to ${email}`);
      onAccountAdded?.();
      onOpenChange(false);
      setEmail(""); setPass(""); setLabel(""); setMode("choose");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {mode === "choose" ? "Add an account" : "Connect via IMAP"}
          </DialogTitle>
          <DialogDescription className="text-textMuted">
            {mode === "choose"
              ? "Three ways in. IMAP works for everyone with an app password."
              : "Use an app password — never your real account password."}
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" ? (
          <div className="space-y-2 py-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => signIn("google", { callbackUrl: "/?auth=callback" })}
            >
              <Mail className="mr-2 h-4 w-4 text-aiAccent" /> Sign in with Google
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/?auth=callback" })}
            >
              <Mail className="mr-2 h-4 w-4 text-aiAccent" /> Sign in with Microsoft
            </Button>
            <Separator className="my-3" />
            <Button
              className="w-full justify-start"
              onClick={() => setMode("imap")}
            >
              <Lock className="mr-2 h-4 w-4" /> Connect via IMAP
            </Button>
          </div>
        ) : (
          <form onSubmit={handleImapSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textDim" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder="you@gmail.com"
                />
              </div>
              {preset && (
                <p className="text-xs text-textMuted">
                  Detected: <span className="font-mono">{preset.host}:{preset.port}</span>
                </p>
              )}
              {email.includes("@") && !preset && (
                <p className="text-xs text-bucket-newsletter">
                  Domain not in preset list. Custom IMAP servers coming later.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pass">App password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textDim" />
                <Input
                  id="pass"
                  type="password"
                  required
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="pl-9 font-mono"
                  placeholder="xxxx xxxx xxxx xxxx"
                />
              </div>
              {preset && <p className="text-xs text-textMuted">{preset.noteForUser}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Personal · Work · etc."
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-card border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => setMode("choose")} disabled={submitting}>
                Back
              </Button>
              <Button type="submit" disabled={submitting || !preset}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting…
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
