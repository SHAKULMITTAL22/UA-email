import { z } from "zod";

export const ProviderId = z.enum(["gmail", "outlook", "imap"]);
export type ProviderId = z.infer<typeof ProviderId>;

export const OAuthTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().int(), // unix seconds
  scope: z.string(),
});
export type OAuthTokens = z.infer<typeof OAuthTokens>;

export const ImapCreds = z.object({
  host: z.string(),
  port: z.number().int(),
  secure: z.boolean(),
  user: z.string(),
  pass: z.string(), // app password
});
export type ImapCreds = z.infer<typeof ImapCreds>;

export const Account = z.object({
  id: z.string(), // uuid
  provider: ProviderId,
  email: z.string().email(),
  label: z.string(),
  oauthTokens: OAuthTokens.optional(),
  imapCreds: ImapCreds.optional(),
  lastSyncAt: z.number().int().nullable(),
});
export type Account = z.infer<typeof Account>;
