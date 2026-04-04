import { describe, expect, it } from "vitest";

import { normalizeAgentRole, normalizePlanningProvenance } from "../planning.js";

// ---------------------------------------------------------------------------
// normalizeAgentRole
// ---------------------------------------------------------------------------

describe("normalizeAgentRole", () => {
  it("maps 'implementer' to 'implementer'", () => {
    expect(normalizeAgentRole("implementer")).toBe("implementer");
  });

  it("maps 'planner' to 'planner'", () => {
    expect(normalizeAgentRole("planner")).toBe("planner");
  });

  it("maps 'architect' to 'architect'", () => {
    expect(normalizeAgentRole("architect")).toBe("architect");
  });

  it("maps 'qa' to 'qa'", () => {
    expect(normalizeAgentRole("qa")).toBe("qa");
  });

  it("maps 'reviewer' to 'reviewer'", () => {
    expect(normalizeAgentRole("reviewer")).toBe("reviewer");
  });

  it("maps 'visual' to 'visual'", () => {
    expect(normalizeAgentRole("visual")).toBe("visual");
  });

  it("normalises uppercase 'QA' to 'qa'", () => {
    expect(normalizeAgentRole("QA")).toBe("qa");
  });

  it("normalises mixed-case 'Implementer' to 'implementer'", () => {
    expect(normalizeAgentRole("Implementer")).toBe("implementer");
  });

  it("normalises a role with surrounding whitespace", () => {
    expect(normalizeAgentRole("  reviewer  ")).toBe("reviewer");
  });

  it("returns null for an unknown role string", () => {
    expect(normalizeAgentRole("fake")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(normalizeAgentRole("")).toBeNull();
  });

  it("returns null for a number", () => {
    expect(normalizeAgentRole(42)).toBeNull();
  });

  it("returns null for null", () => {
    expect(normalizeAgentRole(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeAgentRole(undefined)).toBeNull();
  });

  it("returns null for an object", () => {
    expect(normalizeAgentRole({ role: "implementer" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizePlanningProvenance
// ---------------------------------------------------------------------------

describe("normalizePlanningProvenance", () => {
  it("maps 'crewai' to 'crewai'", () => {
    expect(normalizePlanningProvenance("crewai", "brain")).toBe("crewai");
  });

  it("maps 'brain' to 'brain'", () => {
    expect(normalizePlanningProvenance("brain", "crewai")).toBe("brain");
  });

  it("maps 'fallback' to 'fallback'", () => {
    expect(normalizePlanningProvenance("fallback", "brain")).toBe("fallback");
  });

  it("normalises uppercase 'CREWAI' to 'crewai'", () => {
    expect(normalizePlanningProvenance("CREWAI", "brain")).toBe("crewai");
  });

  it("returns the fallback for an unknown string", () => {
    expect(normalizePlanningProvenance("unknown", "brain")).toBe("brain");
  });

  it("returns the fallback for 'unknown_vendor'", () => {
    expect(normalizePlanningProvenance("unknown_vendor", "crewai")).toBe("crewai");
  });

  it("returns the fallback for a number", () => {
    expect(normalizePlanningProvenance(42, "brain")).toBe("brain");
  });

  it("returns the fallback for null", () => {
    expect(normalizePlanningProvenance(null, "fallback")).toBe("fallback");
  });

  it("returns the fallback for undefined", () => {
    expect(normalizePlanningProvenance(undefined, "brain")).toBe("brain");
  });

  it("returns the fallback for an empty string", () => {
    expect(normalizePlanningProvenance("", "crewai")).toBe("crewai");
  });

  it("maps 'system' to the non-fallback version of the fallback param", () => {
    // When fallback is not 'fallback', 'system' normalises to that fallback.
    expect(normalizePlanningProvenance("system", "brain")).toBe("brain");
  });
});
