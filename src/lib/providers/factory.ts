import type { Account } from "@/lib/types/account";
import type { MailProvider } from "@/lib/providers/mail-provider";
import { ImapProvider } from "@/lib/providers/imap/imap-provider";
// Phase-2 follow-up imports for Gmail + Outlook land in Task 11/12.

export function makeProvider(account: Account): MailProvider {
  switch (account.provider) {
    case "imap":
      return new ImapProvider(account);
    case "gmail":
      throw new Error("GmailProvider not implemented yet (Task 11)");
    case "outlook":
      throw new Error("OutlookProvider not implemented yet (Task 12)");
  }
}
