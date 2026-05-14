"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/hooks/use-accounts";
import { makeProvider } from "@/lib/providers/factory";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: {
    to?: string;
    subject?: string;
    body?: string;
    accountId?: string;
  };
}

export function ComposeDrawer({ open, onOpenChange, initial }: Props) {
  const accounts = useAccounts();
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setFrom("");
      setTo("");
      setSubject("");
      setBody("");
      return;
    }
    if (initial) {
      if (initial.accountId !== undefined) setFrom(initial.accountId);
      if (initial.to !== undefined) setTo(initial.to);
      if (initial.subject !== undefined) setSubject(initial.subject);
      if (initial.body !== undefined) setBody(initial.body);
    }
  }, [open, initial]);

  async function handleSend() {
    const acct = accounts?.find((a) => a.id === from);
    if (!acct) {
      toast.error("Select an account");
      return;
    }
    setSending(true);
    try {
      const provider = makeProvider(acct);
      await provider.send({
        to: to
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((email) => ({ email })),
        subject,
        body,
      });
      toast.success("Sent");
      setTo("");
      setSubject("");
      setBody("");
      onOpenChange(false);
    } catch (e) {
      toast.error("Send failed: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="bg-canvas border border-cardBorder rounded-t-drawer sm:rounded-drawer w-full sm:max-w-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="compose-title"
          >
            <header className="flex items-center justify-between">
              <h2 id="compose-title" className="font-display text-xl text-textPrimary">
                New message
              </h2>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close compose">
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="from">From</Label>
                <select
                  id="from"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full bg-card border border-cardBorder rounded-card px-3 py-2 text-sm text-textPrimary"
                >
                  <option value="">Select an account…</option>
                  {accounts?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="someone@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="body">Body</Label>
                <textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="w-full bg-card border border-cardBorder rounded-card p-3 text-sm text-textPrimary placeholder:text-textDim resize-none focus:outline-none focus:border-aiAccent/60"
                  placeholder="Write your message…"
                />
              </div>
            </div>

            <footer className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={() => void handleSend()} disabled={sending || !from || !to || !subject}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1.5" />
                    Send
                  </>
                )}
              </Button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
