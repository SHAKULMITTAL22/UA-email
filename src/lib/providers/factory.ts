import type { Account } from "@/lib/types/account";
import type { MailProvider } from "@/lib/providers/mail-provider";
import { ImapProvider } from "@/lib/providers/imap/imap-provider";
import { GmailProvider } from "@/lib/providers/gmail/gmail-provider";
import { OutlookProvider } from "@/lib/providers/outlook/outlook-provider";

export function makeProvider(account: Account): MailProvider {
  switch (account.provider) {
    case "imap":
      return new ImapProvider(account);
    case "gmail":
      return new GmailProvider(account);
    case "outlook":
      return new OutlookProvider(account);
  }
}
