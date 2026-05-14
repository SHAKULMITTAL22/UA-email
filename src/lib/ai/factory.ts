import type { LLMProvider } from "@/lib/ai/llm-provider";
import { LLMError } from "@/lib/ai/llm-provider";
import { AnthropicProvider } from "@/lib/ai/anthropic/anthropic-provider";
import { OpenAIProvider } from "@/lib/ai/openai/openai-provider";
import { GeminiProvider } from "@/lib/ai/gemini/gemini-provider";
import { env } from "@/lib/env";

export interface LLMSelection {
  provider: "anthropic" | "openai" | "gemini";
  apiKey?: string;
  model?: string;
}

export function makeLLM(sel?: Partial<LLMSelection>): LLMProvider {
  const provider = sel?.provider ?? env.DEFAULT_LLM_PROVIDER;
  const byok = sel?.apiKey;
  const providerNotSentExplicitly = !sel?.provider;

  switch (provider) {
    case "anthropic": {
      const key = byok ?? env.ANTHROPIC_API_KEY;
      if (!key) {
        const hint = providerNotSentExplicitly
          ? " (request did not specify a provider; server defaulted to Anthropic)"
          : "";
        throw new LLMError(
          `No Anthropic API key found${hint}. Either paste an Anthropic key in Settings -> Active LLM = Anthropic, or switch to a provider whose key you have set.`,
          "auth",
          false,
        );
      }
      return new AnthropicProvider({ apiKey: key, ...(sel?.model ? { model: sel.model } : {}) });
    }
    case "openai": {
      const key = byok ?? env.OPENAI_API_KEY;
      if (!key) {
        throw new LLMError(
          "No OpenAI API key found. Paste your key in Settings -> Active LLM = OpenAI.",
          "auth",
          false,
        );
      }
      return new OpenAIProvider({ apiKey: key, ...(sel?.model ? { model: sel.model } : {}) });
    }
    case "gemini": {
      const key = byok ?? env.GOOGLE_AI_API_KEY;
      if (!key) {
        throw new LLMError(
          "No Google AI key found. Paste your key in Settings -> Active LLM = Google Gemini.",
          "auth",
          false,
        );
      }
      return new GeminiProvider({ apiKey: key, ...(sel?.model ? { model: sel.model } : {}) });
    }
  }
}
