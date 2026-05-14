import { z } from "zod";

const envSchema = z.object({
  // LLM
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GOOGLE_AI_API_KEY: z.string().min(1).optional(),
  DEFAULT_LLM_PROVIDER: z.enum(["anthropic", "openai", "gemini"]).default("anthropic"),

  // Auth
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  AUTH_MICROSOFT_ID: z.string().min(1).optional(),
  AUTH_MICROSOFT_SECRET: z.string().min(1).optional(),
  AUTH_MICROSOFT_TENANT_ID: z.string().default("common"),

  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
