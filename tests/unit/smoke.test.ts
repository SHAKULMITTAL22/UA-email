import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("foundation smoke", () => {
  it("cn merges tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", undefined, "text-blue-500")).toBe("text-blue-500");
  });

  it("env module loads", async () => {
    const { env } = await import("@/lib/env");
    expect(env.DEFAULT_LLM_PROVIDER).toBe("anthropic");
  });
});
