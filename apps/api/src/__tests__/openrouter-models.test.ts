import { describe, expect, it } from "vitest";

import {
  OpenRouterModelCatalogError,
  buildFallbackModelCatalog,
  normalizeAuthorization,
  toModelItem,
  toUsdPerMillionTokens,
  type OpenRouterModelRecord
} from "../openrouter-models.js";

// ---------------------------------------------------------------------------
// toModelItem
// ---------------------------------------------------------------------------

describe("toModelItem", () => {
  it("extracts id and name from a valid record", () => {
    const record: OpenRouterModelRecord = { id: "openai/gpt-4", name: "GPT-4" };
    const item = toModelItem(record);
    expect(item.id).toBe("openai/gpt-4");
    expect(item.name).toBe("GPT-4");
  });

  it("sets provider from the id prefix", () => {
    const record: OpenRouterModelRecord = { id: "anthropic/claude-3", name: "Claude 3" };
    const item = toModelItem(record);
    expect(item.provider).toBe("anthropic");
  });

  it("sets provider to null when id has no slash", () => {
    const record: OpenRouterModelRecord = { id: "gpt4", name: "GPT-4" };
    const item = toModelItem(record);
    expect(item.provider).toBeNull();
  });

  it("extracts context length", () => {
    const record: OpenRouterModelRecord = { id: "a/b", name: "B", context_length: 128_000 };
    const item = toModelItem(record);
    expect(item.contextLength).toBe(128_000);
  });

  it("throws OpenRouterModelCatalogError on missing id", () => {
    const record: OpenRouterModelRecord = { name: "No ID" };
    expect(() => toModelItem(record)).toThrow(OpenRouterModelCatalogError);
  });

  it("throws OpenRouterModelCatalogError on missing name", () => {
    const record: OpenRouterModelRecord = { id: "some/model" };
    expect(() => toModelItem(record)).toThrow(OpenRouterModelCatalogError);
  });

  it("throws OpenRouterModelCatalogError on empty id string", () => {
    const record: OpenRouterModelRecord = { id: "  ", name: "Something" };
    expect(() => toModelItem(record)).toThrow(OpenRouterModelCatalogError);
  });

  it("maps prompt pricing to promptCostPerMillionUsd", () => {
    const record: OpenRouterModelRecord = {
      id: "a/b",
      name: "B",
      pricing: { prompt: "0.000002" }
    };
    const item = toModelItem(record);
    expect(item.promptCostPerMillionUsd).toBeCloseTo(2);
  });

  it("sets null pricing fields for missing pricing data", () => {
    const record: OpenRouterModelRecord = { id: "a/b", name: "B" };
    const item = toModelItem(record);
    expect(item.promptCostPerMillionUsd).toBeNull();
    expect(item.completionCostPerMillionUsd).toBeNull();
    expect(item.requestCostUsd).toBeNull();
  });

  it("collects input and output modalities from architecture", () => {
    const record: OpenRouterModelRecord = {
      id: "a/b",
      name: "B",
      architecture: {
        input_modalities: ["text", "image"],
        output_modalities: ["text"]
      }
    };
    const item = toModelItem(record);
    expect(item.inputModalities).toEqual(["text", "image"]);
    expect(item.outputModalities).toEqual(["text"]);
  });
});

// ---------------------------------------------------------------------------
// toUsdPerMillionTokens
// ---------------------------------------------------------------------------

describe("toUsdPerMillionTokens", () => {
  it("converts a numeric string correctly", () => {
    expect(toUsdPerMillionTokens("0.003")).toBeCloseTo(3000);
  });

  it("converts a raw number correctly", () => {
    expect(toUsdPerMillionTokens(0.000002)).toBeCloseTo(2);
  });

  it("returns null for a negative number", () => {
    expect(toUsdPerMillionTokens(-1)).toBeNull();
  });

  it("returns null for a negative string", () => {
    expect(toUsdPerMillionTokens("-0.001")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(toUsdPerMillionTokens("free")).toBeNull();
  });

  it("returns null for null", () => {
    expect(toUsdPerMillionTokens(null)).toBeNull();
  });

  it("converts zero correctly (free model)", () => {
    expect(toUsdPerMillionTokens(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeAuthorization
// ---------------------------------------------------------------------------

describe("normalizeAuthorization", () => {
  it("adds 'Bearer ' prefix to a bare token", () => {
    expect(normalizeAuthorization("sk-test")).toBe("Bearer sk-test");
  });

  it("keeps an existing 'Bearer ' prefix unchanged", () => {
    expect(normalizeAuthorization("Bearer sk-test")).toBe("Bearer sk-test");
  });

  it("keeps an existing 'bearer ' prefix (case-insensitive) unchanged", () => {
    expect(normalizeAuthorization("bearer sk-test")).toBe("bearer sk-test");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeAuthorization("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeAuthorization("   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// buildFallbackModelCatalog
// ---------------------------------------------------------------------------

const STATIC_IDS = [
  "openrouter/openai/gpt-4.1-mini",
  "openrouter/openai/gpt-5.1-codex-mini",
  "openrouter/anthropic/claude-sonnet-4.6",
  "openrouter/anthropic/claude-opus-4.6",
  "openrouter/google/gemini-2.5-pro-preview"
];

describe("buildFallbackModelCatalog", () => {
  it("includes all static fallback model IDs when called with empty array", () => {
    const catalog = buildFallbackModelCatalog([]);
    const ids = catalog.map((item) => item.id);
    for (const staticId of STATIC_IDS) {
      expect(ids).toContain(staticId);
    }
  });

  it("includes custom model IDs passed in", () => {
    const catalog = buildFallbackModelCatalog(["custom/my-model"]);
    const ids = catalog.map((item) => item.id);
    expect(ids).toContain("custom/my-model");
  });

  it("deduplicates repeated model IDs", () => {
    const catalog = buildFallbackModelCatalog([STATIC_IDS[0]!, STATIC_IDS[0]!, "extra/model"]);
    const ids = catalog.map((item) => item.id);
    const occurrences = ids.filter((id) => id === STATIC_IDS[0]).length;
    expect(occurrences).toBe(1);
  });

  it("deduplicates custom IDs passed multiple times", () => {
    const catalog = buildFallbackModelCatalog(["extra/model", "extra/model"]);
    const ids = catalog.map((item) => item.id);
    const occurrences = ids.filter((id) => id === "extra/model").length;
    expect(occurrences).toBe(1);
  });

  it("sorts entries alphabetically by name", () => {
    const catalog = buildFallbackModelCatalog(["zzz/zz-model", "aaa/aa-model"]);
    const names = catalog.map((item) => item.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    expect(names).toEqual(sorted);
  });

  it("trims whitespace from custom model IDs", () => {
    const catalog = buildFallbackModelCatalog(["  custom/trimmed  "]);
    const ids = catalog.map((item) => item.id);
    expect(ids).toContain("custom/trimmed");
  });

  it("filters out blank custom model IDs", () => {
    const sizeBefore = buildFallbackModelCatalog([]).length;
    const sizeAfter = buildFallbackModelCatalog(["", "   "]).length;
    expect(sizeAfter).toBe(sizeBefore);
  });
});
