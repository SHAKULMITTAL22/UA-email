import { z } from "zod";

export const Bucket = z.enum(["needs_reply", "fyi", "newsletter", "noise"]);
export type Bucket = z.infer<typeof Bucket>;

export const Address = z.object({
  name: z.string().optional(),
  email: z.string().email(),
});
export type Address = z.infer<typeof Address>;

export const Message = z.object({
  id: z.string(),                 // provider-native id, prefixed by accountId
  accountId: z.string(),
  threadId: z.string(),
  from: Address,
  to: z.array(Address),
  cc: z.array(Address).default([]),
  bcc: z.array(Address).default([]),
  subject: z.string(),
  snippet: z.string(),
  body: z.string(),               // text/plain rendering; HTML stored separately if available
  bodyHtml: z.string().optional(),
  receivedAt: z.number().int(),   // unix ms
  labels: z.array(z.string()).default([]),
  flags: z.object({
    unread: z.boolean().default(true),
    starred: z.boolean().default(false),
    archived: z.boolean().default(false),
    trashed: z.boolean().default(false),
  }),
});
export type Message = z.infer<typeof Message>;
