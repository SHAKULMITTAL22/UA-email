import { z } from "zod";
import { Address } from "./message";

export const Thread = z.object({
  id: z.string(),
  accountId: z.string(),
  subject: z.string(),
  participants: z.array(Address),
  messageIds: z.array(z.string()),
  updatedAt: z.number().int(),
});
export type Thread = z.infer<typeof Thread>;
