import { z } from "zod";
import { Bucket } from "./message";

export const AiResult = z.object({
  messageId: z.string(),
  bucket: Bucket,
  summary: z.string().max(140),
  suggestedReply: z.string().max(500).nullable(),
  model: z.string(),
  processedAt: z.number().int(),
  promptCacheHit: z.boolean().default(false),
  version: z.number().int().default(1), // prompt schema version
});
export type AiResult = z.infer<typeof AiResult>;
