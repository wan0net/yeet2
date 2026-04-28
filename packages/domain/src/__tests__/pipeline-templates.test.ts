import { describe, it, expect } from "vitest";
import { PIPELINE_TEMPLATES, PIPELINE_TEMPLATE_KEYS } from "../pipeline-templates";
import { AGENT_THEMES, AGENT_THEME_NAMES, pickCharacters } from "../agent-themes";

// ---------------------------------------------------------------------------
// PIPELINE_TEMPLATES
// ---------------------------------------------------------------------------

describe("PIPELINE_TEMPLATES", () => {
  it("PIPELINE_TEMPLATE_KEYS matches object keys", () => {
    expect(PIPELINE_TEMPLATE_KEYS.sort()).toEqual(Object.keys(PIPELINE_TEMPLATES).sort());
  });

  it("no duplicate template keys", () => {
    const keys = Object.keys(PIPELINE_TEMPLATES);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("every template has required fields", () => {
    for (const [key, template] of Object.entries(PIPELINE_TEMPLATES)) {
      expect(template.key, `template "${key}" must have key`).toBe(key);
      expect(template.name, `template "${key}" must have name`).toBeTruthy();
      expect(template.description, `template "${key}" must have description`).toBeTruthy();
      expect(Array.isArray(template.stages), `template "${key}" must have stages array`).toBe(true);
      expect(template.stages.length, `template "${key}" must have at least 1 stage`).toBeGreaterThanOrEqual(1);
    }
  });

  it("every stage has required fields", () => {
    for (const [key, template] of Object.entries(PIPELINE_TEMPLATES)) {
      for (const stage of template.stages) {
        expect(stage.roleKey, `stage in "${key}" must have roleKey`).toBeTruthy();
        expect(stage.label, `stage in "${key}" must have label`).toBeTruthy();
        expect(stage.goal, `stage in "${key}" must have goal`).toBeTruthy();
        expect(stage.backstory, `stage in "${key}" must have backstory`).toBeTruthy();
        expect(stage.adapter, `stage in "${key}" must have adapter`).toBeTruthy();
        expect(typeof stage.sortOrder, `stage in "${key}" sortOrder must be number`).toBe("number");
        expect(typeof stage.enabled, `stage in "${key}" enabled must be boolean`).toBe("boolean");
      }
    }
  });

  it("stage adapters are valid values", () => {
    const validAdapters = new Set(["openhands", "codex", "claude", "passthrough", "document", "research", "shell"]);
    for (const [key, template] of Object.entries(PIPELINE_TEMPLATES)) {
      for (const stage of template.stages) {
        expect(validAdapters.has(stage.adapter), `stage "${stage.label}" in "${key}" has invalid adapter "${stage.adapter}"`).toBe(true);
      }
    }
  });

  it("stage sort orders are sequential starting at 1", () => {
    for (const [key, template] of Object.entries(PIPELINE_TEMPLATES)) {
      const orders = template.stages.map((s) => s.sortOrder).sort((a, b) => a - b);
      orders.forEach((order, idx) => {
        expect(order, `stage ${idx} in "${key}" sortOrder should be ${idx + 1}`).toBe(idx + 1);
      });
    }
  });

  it("stage roleKeys are valid ProjectRoleKey values", () => {
    const validRoleKeys = new Set(["planner", "architect", "implementer", "tester", "coder", "qa", "reviewer", "visual"]);
    for (const [key, template] of Object.entries(PIPELINE_TEMPLATES)) {
      for (const stage of template.stages) {
        expect(validRoleKeys.has(stage.roleKey), `stage "${stage.label}" in "${key}" has invalid roleKey "${stage.roleKey}"`).toBe(true);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // software template specifically
  // ---------------------------------------------------------------------------

  describe("software template", () => {
    const sw = PIPELINE_TEMPLATES.software;

    it("exists", () => {
      expect(sw).toBeDefined();
    });

    it("has exactly 6 stages", () => {
      expect(sw.stages).toHaveLength(6);
    });

    it("stages are in the correct order", () => {
      const labels = sw.stages.map((s) => s.label);
      expect(labels).toEqual(["Architect", "Implementer", "Tester", "Coder", "QA", "Reviewer"]);
    });

    it("stages have the correct roleKeys in order", () => {
      const roleKeys = sw.stages.map((s) => s.roleKey);
      expect(roleKeys).toEqual(["architect", "implementer", "tester", "coder", "qa", "reviewer"]);
    });

    it("coder and tester stages use openhands adapter", () => {
      const coder = sw.stages.find((s) => s.roleKey === "coder");
      const tester = sw.stages.find((s) => s.roleKey === "tester");
      expect(coder?.adapter).toBe("openhands");
      expect(tester?.adapter).toBe("openhands");
    });

    it("all stages are enabled", () => {
      for (const stage of sw.stages) {
        expect(stage.enabled).toBe(true);
      }
    });
  });

  it("custom template has exactly 1 stage", () => {
    expect(PIPELINE_TEMPLATES.custom.stages).toHaveLength(1);
    expect(PIPELINE_TEMPLATES.custom.stages[0].roleKey).toBe("implementer");
  });
});

// ---------------------------------------------------------------------------
// AGENT_THEMES
// ---------------------------------------------------------------------------

describe("AGENT_THEMES", () => {
  it("AGENT_THEME_NAMES matches keys", () => {
    expect(AGENT_THEME_NAMES.sort()).toEqual(Object.keys(AGENT_THEMES).sort());
  });

  it("no duplicate theme IDs", () => {
    const keys = Object.keys(AGENT_THEMES);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every theme is a non-empty array", () => {
    for (const [name, characters] of Object.entries(AGENT_THEMES)) {
      expect(Array.isArray(characters), `theme "${name}" should be an array`).toBe(true);
      expect(characters.length, `theme "${name}" should not be empty`).toBeGreaterThan(0);
    }
  });

  it("every character has name, franchise, and description", () => {
    for (const [theme, characters] of Object.entries(AGENT_THEMES)) {
      for (const char of characters) {
        expect(char.name, `character in "${theme}" must have name`).toBeTruthy();
        expect(char.franchise, `character in "${theme}" must have franchise`).toBeTruthy();
        expect(char.description, `character in "${theme}" must have description`).toBeTruthy();
      }
    }
  });

  it("includes expected themes", () => {
    const expected = ["mythology", "norse", "star-wars", "dune", "lotr", "firefly"];
    for (const theme of expected) {
      expect(AGENT_THEMES).toHaveProperty(theme);
    }
  });
});

// ---------------------------------------------------------------------------
// pickCharacters
// ---------------------------------------------------------------------------

describe("pickCharacters", () => {
  it("returns the requested count of characters", () => {
    const result = pickCharacters("mythology", 4, "my-project");
    expect(result).toHaveLength(4);
  });

  it("returns deterministic results for the same seed", () => {
    const a = pickCharacters("mythology", 5, "same-seed");
    const b = pickCharacters("mythology", 5, "same-seed");
    expect(a.map((c) => c.name)).toEqual(b.map((c) => c.name));
  });

  it("returns different results for different seeds", () => {
    const a = pickCharacters("mythology", 5, "seed-one");
    const b = pickCharacters("mythology", 5, "seed-two");
    // It's statistically near-impossible they'd be identical
    expect(a.map((c) => c.name)).not.toEqual(b.map((c) => c.name));
  });

  it("falls back to mythology for unknown theme", () => {
    const result = pickCharacters("nonexistent-theme", 2, "test");
    expect(result).toHaveLength(2);
    // All mythology characters have Greek Mythology franchise
    expect(result[0].franchise).toBe("Greek Mythology");
  });

  it("cycles characters if count exceeds pool size", () => {
    const pool = AGENT_THEMES.mythology;
    const count = pool.length + 3;
    const result = pickCharacters("mythology", count, "test-seed");
    expect(result).toHaveLength(count);
  });

  it("returns valid character objects", () => {
    const result = pickCharacters("lotr", 3, "project-x");
    for (const char of result) {
      expect(char.name).toBeTruthy();
      expect(char.franchise).toBeTruthy();
      expect(char.description).toBeTruthy();
    }
  });
});
