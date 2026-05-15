import { z } from "zod";
import { Bucket } from "@/lib/types/message";

export const TriageItem = z.object({
  messageId: z.string(),
  bucket: Bucket,
  summary: z.string().max(140),
  detailedSummary: z.string().max(600).optional(),
  suggestedReply: z.string().max(500).nullable(),
});

export const TriageList = z.object({
  results: z.array(TriageItem),
});

export type TriageItem = z.infer<typeof TriageItem>;
