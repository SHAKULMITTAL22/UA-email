import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDKs *before* importing the providers (vi.mock is hoisted).
// Vitest 4 requires `function` or `class` syntax for mock impls used as constructors.
vi.mock("@anthropic-ai/sdk", () => {
  const create = vi.fn();
  function Anthropic() {
    return { messages: { create } };
  }
  return {
    default: Anthropic,
    __mockCreate: create,
  };
});
vi.mock("openai", () => {
  const create = vi.fn();
  function OpenAI() {
    return { chat: { completions: { create } } };
  }
  return {
    default: OpenAI,
    __mockCreate: create,
  };
});
vi.mock("@google/generative-ai", () => {
  const generateContent = vi.fn();
  function GoogleGenerativeAI() {
    return { getGenerativeModel: () => ({ generateContent }) };
  }
  return {
    GoogleGenerativeAI,
    __mockGenerate: generateContent,
  };
});

import { AnthropicProvider } from "@/lib/ai/anthropic/anthropic-provider";
import { OpenAIProvider } from "@/lib/ai/openai/openai-provider";
import { GeminiProvider } from "@/lib/ai/gemini/gemini-provider";
import { LLMError } from "@/lib/ai/llm-provider";

const INPUTS = [
  {
    messageId: "m1",
    from: "alice@example.com",
    subject: "hello",
    bodyExcerpt: "test",
    receivedAt: 1_700_000_000_000,
  },
];

const GOOD_JSON =
  '{"results":[{"messageId":"m1","bucket":"needs_reply","summary":"Alice says hi.","suggestedReply":"Hi back."}]}';

describe("AnthropicProvider", () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    const mod = (await import("@anthropic-ai/sdk")) as unknown as {
      __mockCreate: ReturnType<typeof vi.fn>;
    };
    mockCreate = mod.__mockCreate;
    mockCreate.mockReset();
  });

  it("triageBatch parses JSON + reports cache hit", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: GOOD_JSON }],
      usage: { cache_read_input_tokens: 100, cache_creation_input_tokens: 0, input_tokens: 100 },
    });
    const provider = new AnthropicProvider({ apiKey: "test" });
    const out = await provider.triageBatch(INPUTS);
    expect(out).toHaveLength(1);
    expect(out[0]?.bucket).toBe("needs_reply");
    expect(out[0]?.promptCacheHit).toBe(true);
  });

  it("triageBatch throws LLMError schema on malformed JSON", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "not json at all" }],
      usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 0, input_tokens: 0 },
    });
    const provider = new AnthropicProvider({ apiKey: "test" });
    await expect(provider.triageBatch(INPUTS)).rejects.toBeInstanceOf(LLMError);
  });

  it("triageBatch maps 429 to LLMError rate_limit retryable", async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error("Too Many"), { status: 429 }));
    const provider = new AnthropicProvider({ apiKey: "test" });
    await expect(provider.triageBatch(INPUTS)).rejects.toMatchObject({
      cause: "rate_limit",
      retryable: true,
    });
  });
});

describe("OpenAIProvider", () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    const mod = (await import("openai")) as unknown as {
      __mockCreate: ReturnType<typeof vi.fn>;
    };
    mockCreate = mod.__mockCreate;
    mockCreate.mockReset();
  });

  it("triageBatch parses JSON-mode response", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: GOOD_JSON } }] });
    const provider = new OpenAIProvider({ apiKey: "test" });
    const out = await provider.triageBatch(INPUTS);
    expect(out[0]?.bucket).toBe("needs_reply");
    expect(out[0]?.promptCacheHit).toBe(false);
  });

  it("triageBatch maps 401 to auth", async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const provider = new OpenAIProvider({ apiKey: "bad" });
    await expect(provider.triageBatch(INPUTS)).rejects.toMatchObject({ cause: "auth" });
  });
});

describe("GeminiProvider", () => {
  let mockGenerate: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    const mod = (await import("@google/generative-ai")) as unknown as {
      __mockGenerate: ReturnType<typeof vi.fn>;
    };
    mockGenerate = mod.__mockGenerate;
    mockGenerate.mockReset();
  });

  it("triageBatch parses JSON-mime response", async () => {
    mockGenerate.mockResolvedValue({ response: { text: () => GOOD_JSON } });
    const provider = new GeminiProvider({ apiKey: "test" });
    const out = await provider.triageBatch(INPUTS);
    expect(out[0]?.summary).toContain("Alice");
  });

  it("triageBatch maps 'API key' error to auth", async () => {
    mockGenerate.mockRejectedValue(new Error("Invalid API key"));
    const provider = new GeminiProvider({ apiKey: "bad" });
    await expect(provider.triageBatch(INPUTS)).rejects.toMatchObject({ cause: "auth" });
  });
});
