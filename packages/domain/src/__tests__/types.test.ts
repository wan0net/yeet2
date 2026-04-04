import { describe, it, expect } from "vitest";
import { RECOMMENDED_ROLE_MODELS } from "../index";
import type { ProjectRoleKey } from "../index";

const ALL_ROLE_KEYS: ProjectRoleKey[] = [
  "planner",
  "architect",
  "implementer",
  "tester",
  "coder",
  "qa",
  "reviewer",
  "visual",
];

describe("RECOMMENDED_ROLE_MODELS", () => {
  it("has entry for every ProjectRoleKey", () => {
    for (const key of ALL_ROLE_KEYS) {
      expect(RECOMMENDED_ROLE_MODELS).toHaveProperty(key);
    }
    expect(Object.keys(RECOMMENDED_ROLE_MODELS)).toHaveLength(ALL_ROLE_KEYS.length);
  });

  it("all model values match openrouter pattern", () => {
    for (const [key, value] of Object.entries(RECOMMENDED_ROLE_MODELS)) {
      expect(value, `model for role "${key}" should start with openrouter/`).toMatch(
        /^openrouter\//,
      );
    }
  });

  it("no model value is empty", () => {
    for (const [key, value] of Object.entries(RECOMMENDED_ROLE_MODELS)) {
      expect(value.length, `model for role "${key}" should not be empty`).toBeGreaterThan(0);
    }
  });

  it("is a plain object (not null, not array)", () => {
    expect(RECOMMENDED_ROLE_MODELS).not.toBeNull();
    expect(Array.isArray(RECOMMENDED_ROLE_MODELS)).toBe(false);
    expect(typeof RECOMMENDED_ROLE_MODELS).toBe("object");
  });

  it("covers exactly the 8 expected keys", () => {
    const keys = Object.keys(RECOMMENDED_ROLE_MODELS).sort();
    expect(keys).toEqual([...ALL_ROLE_KEYS].sort());
  });
});
