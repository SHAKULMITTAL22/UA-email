import nodemailer, { type Transporter } from "nodemailer";

/**
 * Derive an SMTP host + port from the IMAP host. Most providers run SMTP on
 * a sibling subdomain with the same credentials (Gmail app password works
 * for both IMAP and SMTP, same for Yahoo/AOL/Outlook).
 *
 * SMTPS on 465 is preferred over STARTTLS on 587 because Vercel free tier
 * may block 587 (some networks do); 465 is implicit TLS and tends to work
 * more reliably from serverless functions.
 */
export function deriveSmtp(imapHost: string): { host: string; port: number; secure: boolean } {
  const h = imapHost.toLowerCase();
  if (h.includes("gmail")) return { host: "smtp.gmail.com", port: 465, secure: true };
  if (h.includes("yahoo")) return { host: "smtp.mail.yahoo.com", port: 465, secure: true };
  if (h.includes("aol")) return { host: "smtp.aol.com", port: 465, secure: true };
  if (h.includes("office365") || h.includes("outlook")) {
    // Outlook/Office365 SMTP only listens on 587 with STARTTLS — no 465.
    return { host: "smtp-mail.outlook.com", port: 587, secure: false };
  }
  // Best-effort fallback: replace "imap." with "smtp." and use SMTPS port.
  return { host: h.replace(/^imap\./, "smtp."), port: 465, secure: true };
}

export interface SmtpCreds {
  imapHost: string;
  user: string;
  pass: string;
}

export async function sendViaSmtp(
  creds: SmtpCreds,
  rfc822: string,
  fromAddress: string,
  toAddresses: string[],
): Promise<{ messageId: string }> {
  const smtp = deriveSmtp(creds.imapHost);

  const transporter: Transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: creds.user, pass: creds.pass },
    connectionTimeout: 20_000,
    socketTimeout: 30_000,
  });

  const info = await transporter.sendMail({
    envelope: { from: fromAddress, to: toAddresses },
    raw: rfc822,
  });

  return { messageId: info.messageId ?? `smtp-${Date.now()}` };
}
