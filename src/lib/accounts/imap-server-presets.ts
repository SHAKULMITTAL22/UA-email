export interface ImapPreset {
  host: string;
  port: number;
  secure: boolean;
  noteForUser: string;
}

const PRESETS: Record<string, ImapPreset> = {
  "gmail.com":   { host: "imap.gmail.com",       port: 993, secure: true, noteForUser: "Use a Google App Password (not your account password). Generate at https://myaccount.google.com/apppasswords." },
  "googlemail.com": { host: "imap.gmail.com",    port: 993, secure: true, noteForUser: "Use a Google App Password." },
  "outlook.com": { host: "outlook.office365.com", port: 993, secure: true, noteForUser: "Use an app password — enable Modern Authentication in your Microsoft account first." },
  "hotmail.com": { host: "outlook.office365.com", port: 993, secure: true, noteForUser: "Use an app password." },
  "live.com":    { host: "outlook.office365.com", port: 993, secure: true, noteForUser: "Use an app password." },
  "office365.com": { host: "outlook.office365.com", port: 993, secure: true, noteForUser: "Use an app password." },
  "yahoo.com":   { host: "imap.mail.yahoo.com",  port: 993, secure: true, noteForUser: "Generate an app password at https://login.yahoo.com/account/security." },
  "aol.com":     { host: "imap.aol.com",         port: 993, secure: true, noteForUser: "Generate an app password at https://login.aol.com/account/security." },
};

export function presetForEmail(email: string): ImapPreset | undefined {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return undefined;
  return PRESETS[domain];
}
