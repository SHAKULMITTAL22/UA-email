import { z } from "zod";
import { Bucket } from "./message";

export const AiResult = z.object({
  messageId: z.string(),
  bucket: Bucket,
  /** Short one-liner for inbox cards (max 140 chars). */
  summary: z.string().max(140),
  /** Detailed 2-4 sentence summary shown in the thread view as a TL;DR card. */
  detailedSummary: z.string().max(600).optional(),
  suggestedReply: z.string().max(500).nullable(),
  model: z.string(),
  processedAt: z.number().int(),
  promptCacheHit: z.boolean().default(false),
  version: z.number().int().default(1), // prompt schema version
});
export type AiResult = z.infer<typeof AiResult>;
