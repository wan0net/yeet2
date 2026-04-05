import { describe, it, expect } from "vitest";
import {
  parseGitHubRepoUrl,
  recommendedRoleModel,
  decisionLogLabel,
  decisionLogTone,
  planningProvenanceLabel,
  formatConstitutionFiles,
} from "$lib/projects";
import type { ConstitutionFileSummary } from "$lib/projects";

// ─── parseGitHubRepoUrl ───────────────────────────────────────────────────────

describe("parseGitHubRepoUrl", () => {
  it("parses a standard HTTPS GitHub URL", () => {
    const result = parseGitHubRepoUrl("https://github.com/acme/my-repo");
    expect(result).not.toBeNull();
    expect(result?.owner).toBe("acme");
    expect(result?.repo).toBe("my-repo");
    expect(result?.webUrl).toBe("https://github.com/acme/my-repo");
  });

  it("strips trailing .git suffix", () => {
    const result = parseGitHubRepoUrl("https://github.com/acme/my-repo.git");
    expect(result?.repo).toBe("my-repo");
  });

  it("parses SSH-style git@ URLs", () => {
    const result = parseGitHubRepoUrl("git@github.com:acme/my-repo.git");
    expect(result?.owner).toBe("acme");
    expect(result?.repo).toBe("my-repo");
  });

  it("returns null for a non-GitHub URL", () => {
    expect(parseGitHubRepoUrl("https://gitlab.com/acme/my-repo")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseGitHubRepoUrl("")).toBeNull();
  });

  it("returns null for a URL with too many path segments", () => {
    expect(parseGitHubRepoUrl("https://github.com/acme/my-repo/tree/main")).toBeNull();
  });

  it("returns null for a URL with query string", () => {
    expect(parseGitHubRepoUrl("https://github.com/acme/my-repo?foo=bar")).toBeNull();
  });
});

// ─── recommendedRoleModel ─────────────────────────────────────────────────────

describe("recommendedRoleModel", () => {
  it("returns a model string for 'implementer'", () => {
    const result = recommendedRoleModel("implementer");
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns a model string for 'planner'", () => {
    const result = recommendedRoleModel("planner");
    expect(result).not.toBeNull();
  });

  it("trims whitespace from the role key", () => {
    const result = recommendedRoleModel("  coder  ");
    expect(result).not.toBeNull();
  });

  it("is case-insensitive", () => {
    const lower = recommendedRoleModel("reviewer");
    const upper = recommendedRoleModel("REVIEWER");
    expect(lower).toBe(upper);
  });

  it("returns null for an unknown role key", () => {
    expect(recommendedRoleModel("nonexistent-role-xyz")).toBeNull();
  });
});

// ─── decisionLogLabel ────────────────────────────────────────────────────────

describe("decisionLogLabel", () => {
  it("returns 'Planning' for 'planning'", () => {
    expect(decisionLogLabel("planning")).toBe("Planning");
  });

  it("returns 'Planning' for 'mission_planning'", () => {
    expect(decisionLogLabel("mission_planning")).toBe("Planning");
  });

  it("returns 'Dispatch' for 'dispatch'", () => {
    expect(decisionLogLabel("dispatch")).toBe("Dispatch");
  });

  it("returns 'PR' for 'pull_request'", () => {
    expect(decisionLogLabel("pull_request")).toBe("PR");
  });

  it("returns 'Merge' for 'merge'", () => {
    expect(decisionLogLabel("merge")).toBe("Merge");
  });

  it("returns 'Blocker' for 'blocker'", () => {
    expect(decisionLogLabel("blocker")).toBe("Blocker");
  });

  it("returns 'Chat' for 'message'", () => {
    expect(decisionLogLabel("message")).toBe("Chat");
  });

  it("returns 'Event' for empty string", () => {
    expect(decisionLogLabel("")).toBe("Event");
  });

  it("returns the raw value for an unrecognized type", () => {
    expect(decisionLogLabel("custom-event")).toBe("custom-event");
  });
});

// ─── decisionLogTone ─────────────────────────────────────────────────────────

describe("decisionLogTone", () => {
  it("returns cyan classes for 'planning'", () => {
    expect(decisionLogTone("planning")).toContain("cyan");
  });

  it("returns sky classes for 'dispatch'", () => {
    expect(decisionLogTone("dispatch")).toContain("sky");
  });

  it("returns indigo classes for 'pr'", () => {
    expect(decisionLogTone("pr")).toContain("indigo");
  });

  it("returns emerald classes for 'merge'", () => {
    expect(decisionLogTone("merge")).toContain("emerald");
  });

  it("returns amber classes for 'autonomy'", () => {
    expect(decisionLogTone("autonomy")).toContain("amber");
  });

  it("returns rose classes for 'review'", () => {
    expect(decisionLogTone("review")).toContain("rose");
  });

  it("returns orange classes for 'blocker'", () => {
    expect(decisionLogTone("blocker")).toContain("orange");
  });

  it("returns slate for unknown types", () => {
    expect(decisionLogTone("unknown-type")).toContain("slate");
  });
});

// ─── planningProvenanceLabel ──────────────────────────────────────────────────

describe("planningProvenanceLabel", () => {
  it("returns 'CrewAI-backed' for crewai", () => {
    expect(planningProvenanceLabel("crewai")).toBe("CrewAI-backed");
  });

  it("returns 'Brain-generated' for brain", () => {
    expect(planningProvenanceLabel("brain")).toBe("Brain-generated");
  });

  it("returns 'Fallback-generated' for fallback", () => {
    expect(planningProvenanceLabel("fallback")).toBe("Fallback-generated");
  });

  it("returns 'Unknown provenance' for null", () => {
    expect(planningProvenanceLabel(null)).toBe("Unknown provenance");
  });

  it("returns 'Unknown provenance' for undefined", () => {
    expect(planningProvenanceLabel(undefined)).toBe("Unknown provenance");
  });

  it("recognises crewai even with surrounding text", () => {
    // The normalizer checks .includes("crewai")
    expect(planningProvenanceLabel("crewai-v2")).toBe("CrewAI-backed");
  });
});

// ─── formatConstitutionFiles ──────────────────────────────────────────────────

describe("formatConstitutionFiles", () => {
  it("returns '0/6 files present' when files is undefined", () => {
    expect(formatConstitutionFiles(undefined)).toBe("0/6 files present");
  });

  it("returns '0/6 files present' when all files are false", () => {
    const files: ConstitutionFileSummary = {
      vision: false,
      spec: false,
      roadmap: false,
      architecture: false,
      decisions: false,
      qualityBar: false,
    };
    expect(formatConstitutionFiles(files)).toBe("0/6 files present");
  });

  it("returns '6/6 files present' when all files are true", () => {
    const files: ConstitutionFileSummary = {
      vision: true,
      spec: true,
      roadmap: true,
      architecture: true,
      decisions: true,
      qualityBar: true,
    };
    expect(formatConstitutionFiles(files)).toBe("6/6 files present");
  });

  it("returns correct count for a partial set", () => {
    const files: ConstitutionFileSummary = {
      vision: true,
      spec: true,
      roadmap: false,
      architecture: false,
      decisions: false,
      qualityBar: false,
    };
    expect(formatConstitutionFiles(files)).toBe("2/6 files present");
  });
});
