import { describe, it, expect } from "vitest";
import {
  parseGitHubRepoUrl,
  recommendedRoleModel,
  decisionLogLabel,
  decisionLogTone,
  planningProvenanceLabel,
  planningProvenanceTone,
  formatConstitutionFiles,
  githubBranchUrl,
  projectGitHubRepoInfo,
  jobGitHubCompareUrl,
  jobGitHubPullRequestLabel,
  jobGitHubPullRequestLifecycle,
  jobGitHubPullRequestLifecycleLabel,
  jobGitHubPullRequestLifecycleTone,
  emptyConstitutionFiles,
  normalizeConstitutionStatus,
  normalizeConstitutionFiles,
  normalizeProjectRecord,
  normalizeProjectList,
  autonomyModeLabel,
  autonomyModeTone,
  pullRequestModeLabel,
  pullRequestModeTone,
  pullRequestDraftModeLabel,
  pullRequestDraftModeTone,
  mergeApprovalModeLabel,
  mergeApprovalModeTone,
  branchCleanupModeLabel,
  branchCleanupModeTone,
  formatUsdAmount,
  projectModelCostSummary,
  projectRoleModelValues,
  missingRegistrationFields,
} from "$lib/projects";
import type { ConstitutionFileSummary, ProjectRecord, ProjectJobRecord } from "$lib/projects";

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

// ─── planningProvenanceTone ───────────────────────────────────────────────────

describe("planningProvenanceTone", () => {
  it("returns cyan classes for crewai", () => {
    expect(planningProvenanceTone("crewai")).toContain("cyan");
  });
  it("returns indigo classes for brain", () => {
    expect(planningProvenanceTone("brain")).toContain("indigo");
  });
  it("returns amber classes for fallback", () => {
    expect(planningProvenanceTone("fallback")).toContain("amber");
  });
  it("returns slate for null", () => {
    expect(planningProvenanceTone(null)).toContain("slate");
  });
});

// ─── githubBranchUrl ─────────────────────────────────────────────────────────

describe("githubBranchUrl", () => {
  it("builds a branch URL from a valid repo URL", () => {
    const url = githubBranchUrl("https://github.com/acme/repo", "main");
    expect(url).toBe("https://github.com/acme/repo/tree/main");
  });
  it("encodes special characters in branch name", () => {
    const url = githubBranchUrl("https://github.com/acme/repo", "feat/my feature");
    expect(url).toContain("/tree/feat%2Fmy%20feature");
  });
  it("returns null for invalid repo URL", () => {
    expect(githubBranchUrl("not-a-url", "main")).toBeNull();
  });
  it("returns null for empty branch name", () => {
    expect(githubBranchUrl("https://github.com/acme/repo", "")).toBeNull();
  });
});

// ─── projectGitHubRepoInfo ────────────────────────────────────────────────────

describe("projectGitHubRepoInfo", () => {
  it("parses from repoUrl when provided", () => {
    const info = projectGitHubRepoInfo({ repoUrl: "https://github.com/acme/repo", githubRepoOwner: undefined, githubRepoName: undefined, githubRepoUrl: undefined });
    expect(info?.owner).toBe("acme");
    expect(info?.repo).toBe("repo");
  });
  it("returns null when no URLs are set", () => {
    expect(projectGitHubRepoInfo({ repoUrl: "", githubRepoOwner: undefined, githubRepoName: undefined, githubRepoUrl: undefined })).toBeNull();
  });
  it("prefers explicit owner/repo fields over parsed values", () => {
    const info = projectGitHubRepoInfo({ repoUrl: "https://github.com/acme/repo", githubRepoOwner: "other", githubRepoName: "other-repo", githubRepoUrl: undefined });
    expect(info?.owner).toBe("other");
    expect(info?.repo).toBe("other-repo");
  });
});

// ─── jobGitHubCompareUrl ──────────────────────────────────────────────────────

describe("jobGitHubCompareUrl", () => {
  it("uses job.githubCompareUrl when present", () => {
    const url = jobGitHubCompareUrl({ githubCompareUrl: "https://github.com/acme/repo/compare/main...feat" }, "https://github.com/acme/repo", "feat");
    expect(url).toBe("https://github.com/acme/repo/compare/main...feat");
  });
  it("falls back to githubBranchUrl when githubCompareUrl is undefined", () => {
    const url = jobGitHubCompareUrl({ githubCompareUrl: undefined }, "https://github.com/acme/repo", "my-branch");
    expect(url).toContain("/tree/my-branch");
  });
});

// ─── jobGitHubPullRequestLabel ────────────────────────────────────────────────

describe("jobGitHubPullRequestLabel", () => {
  it("returns PR #N when number is set", () => {
    expect(jobGitHubPullRequestLabel({ githubPrNumber: 42, githubPrTitle: null })).toBe("PR #42");
  });
  it("returns title when number is null but title is set", () => {
    expect(jobGitHubPullRequestLabel({ githubPrNumber: null, githubPrTitle: "Add feature" })).toBe("Add feature");
  });
  it("returns default when both are null", () => {
    expect(jobGitHubPullRequestLabel({ githubPrNumber: null, githubPrTitle: null })).toBe("Pull request");
  });
});

// ─── jobGitHubPullRequestLifecycle ───────────────────────────────────────────

describe("jobGitHubPullRequestLifecycle", () => {
  it("returns merged when mergedAt is set", () => {
    expect(jobGitHubPullRequestLifecycle({ githubPrState: "closed", githubPrDraft: false, githubPrMergedAt: "2024-01-01T00:00:00Z" })).toBe("merged");
  });
  it("returns draft when draft is true", () => {
    expect(jobGitHubPullRequestLifecycle({ githubPrState: "open", githubPrDraft: true, githubPrMergedAt: null })).toBe("draft");
  });
  it("returns open when state is open and not draft", () => {
    expect(jobGitHubPullRequestLifecycle({ githubPrState: "open", githubPrDraft: false, githubPrMergedAt: null })).toBe("open");
  });
  it("returns closed when state is closed and not merged", () => {
    expect(jobGitHubPullRequestLifecycle({ githubPrState: "closed", githubPrDraft: false, githubPrMergedAt: null })).toBe("closed");
  });
  it("returns unknown when no state set", () => {
    expect(jobGitHubPullRequestLifecycle({ githubPrState: null, githubPrDraft: null, githubPrMergedAt: null })).toBe("unknown");
  });
});

// ─── jobGitHubPullRequestLifecycleLabel / Tone ───────────────────────────────

describe("jobGitHubPullRequestLifecycleLabel", () => {
  it("returns 'Draft PR' for draft", () => {
    expect(jobGitHubPullRequestLifecycleLabel({ githubPrState: "open", githubPrDraft: true, githubPrMergedAt: null })).toBe("Draft PR");
  });
  it("returns 'Merged' for merged", () => {
    expect(jobGitHubPullRequestLifecycleLabel({ githubPrState: "closed", githubPrDraft: false, githubPrMergedAt: "2024-01-01T00:00:00Z" })).toBe("Merged");
  });
});

describe("jobGitHubPullRequestLifecycleTone", () => {
  it("returns amber for draft", () => {
    expect(jobGitHubPullRequestLifecycleTone({ githubPrState: "open", githubPrDraft: true, githubPrMergedAt: null })).toContain("amber");
  });
  it("returns emerald for merged", () => {
    expect(jobGitHubPullRequestLifecycleTone({ githubPrState: "closed", githubPrDraft: false, githubPrMergedAt: "2024-01-01T00:00:00Z" })).toContain("emerald");
  });
});

// ─── emptyConstitutionFiles ───────────────────────────────────────────────────

describe("emptyConstitutionFiles", () => {
  it("returns an object with all fields false", () => {
    const files = emptyConstitutionFiles();
    expect(files.vision).toBe(false);
    expect(files.spec).toBe(false);
    expect(files.qualityBar).toBe(false);
  });
});

// ─── normalizeConstitutionStatus ─────────────────────────────────────────────

describe("normalizeConstitutionStatus", () => {
  it("returns 'parsed' for 'parsed'", () => { expect(normalizeConstitutionStatus("parsed")).toBe("parsed"); });
  it("maps 'complete' to 'parsed'", () => { expect(normalizeConstitutionStatus("complete")).toBe("parsed"); });
  it("maps 'ready' to 'pending'", () => { expect(normalizeConstitutionStatus("ready")).toBe("pending"); });
  it("returns 'unknown' for empty string", () => { expect(normalizeConstitutionStatus("")).toBe("unknown"); });
  it("returns 'unknown' for unrecognised value", () => { expect(normalizeConstitutionStatus("bogus")).toBe("unknown"); });
  it("returns 'failed' for 'failed'", () => { expect(normalizeConstitutionStatus("FAILED")).toBe("failed"); });
});

// ─── normalizeConstitutionFiles ───────────────────────────────────────────────

describe("normalizeConstitutionFiles", () => {
  it("detects files from snapshot object", () => {
    const result = normalizeConstitutionFiles({ constitution: { snapshot: { vision: "path/to/vision.md", spec: null } } });
    expect(result.vision).toBe(true);
    expect(result.spec).toBe(false);
  });
  it("returns all-false for empty input", () => {
    const result = normalizeConstitutionFiles({});
    expect(Object.values(result).every((v) => v === false)).toBe(true);
  });
});

// ─── normalizeProjectRecord ───────────────────────────────────────────────────

describe("normalizeProjectRecord", () => {
  it("returns null for null input", () => {
    expect(normalizeProjectRecord(null)).toBeNull();
  });
  it("normalizes a minimal raw project object", () => {
    const result = normalizeProjectRecord({ id: "proj-1", name: "Test", localPath: "/tmp/test" });
    expect(result).not.toBeNull();
    expect(result?.id).toBe("proj-1");
    expect(result?.name).toBe("Test");
  });
  it("handles missing id with fallbackIndex", () => {
    const result = normalizeProjectRecord({ name: "No ID" }, 3);
    expect(result?.id).toMatch(/3/);
  });
  it("normalizes delegated GitHub ticket relationship fields", () => {
    const result = normalizeProjectRecord({
      id: "proj-1",
      name: "Test",
      localPath: "/tmp/test",
      missions: [
        {
          id: "mission-1",
          title: "Mission",
          objective: "Do it",
          tasks: [
            {
              id: "task-1",
              title: "Child",
              description: "Delegated work",
              agentRole: "implementer",
              github_issue_number: 44,
              github_parent_issue_number: 41,
              delegated_from_task_id: "parent-task"
            }
          ]
        }
      ]
    });

    expect(result?.missions[0]?.tasks[0]?.githubIssueNumber).toBe(44);
    expect(result?.missions[0]?.tasks[0]?.githubParentIssueNumber).toBe(41);
    expect(result?.missions[0]?.tasks[0]?.delegatedFromTaskId).toBe("parent-task");
  });
});

// ─── normalizeProjectList ─────────────────────────────────────────────────────

describe("normalizeProjectList", () => {
  it("normalizes an array of raw projects", () => {
    const result = normalizeProjectList([{ id: "p1", name: "A", localPath: "/a" }, { id: "p2", name: "B", localPath: "/b" }]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("p1");
  });
  it("returns empty array for empty input", () => {
    expect(normalizeProjectList([])).toEqual([]);
  });
  it("skips non-array input gracefully", () => {
    const result = normalizeProjectList({ id: "p1", name: "A", localPath: "/a" });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── autonomyModeLabel / Tone ─────────────────────────────────────────────────

describe("autonomyModeLabel", () => {
  it("returns 'Manual' for manual", () => { expect(autonomyModeLabel("manual")).toBe("Manual"); });
  it("returns 'Supervised' for supervised", () => { expect(autonomyModeLabel("supervised")).toBe("Supervised"); });
  it("returns 'Autonomous' for autonomous", () => { expect(autonomyModeLabel("autonomous")).toBe("Autonomous"); });
  it("returns 'Unknown' for null", () => { expect(autonomyModeLabel(null)).toBe("Unknown"); });
});

describe("autonomyModeTone", () => {
  it("returns slate for manual", () => { expect(autonomyModeTone("manual")).toContain("slate"); });
  it("returns emerald for autonomous", () => { expect(autonomyModeTone("autonomous")).toContain("emerald"); });
});

// ─── pullRequestModeLabel / Tone ──────────────────────────────────────────────

describe("pullRequestModeLabel", () => {
  it("returns 'Manual' for manual", () => { expect(pullRequestModeLabel("manual")).toBe("Manual"); });
  it("returns 'After implementer' for after_implementer", () => { expect(pullRequestModeLabel("after_implementer")).toBe("After implementer"); });
  it("returns 'After reviewer' for after_reviewer", () => { expect(pullRequestModeLabel("after_reviewer")).toBe("After reviewer"); });
});

describe("pullRequestModeTone", () => {
  it("returns sky for after_implementer", () => { expect(pullRequestModeTone("after_implementer")).toContain("sky"); });
  it("returns amber for after_reviewer", () => { expect(pullRequestModeTone("after_reviewer")).toContain("amber"); });
});

// ─── pullRequestDraftModeLabel / Tone ────────────────────────────────────────

describe("pullRequestDraftModeLabel", () => {
  it("returns 'Draft' for draft", () => { expect(pullRequestDraftModeLabel("draft")).toBe("Draft"); });
  it("returns 'Ready' for ready", () => { expect(pullRequestDraftModeLabel("ready")).toBe("Ready"); });
});

describe("pullRequestDraftModeTone", () => {
  it("returns emerald for ready", () => { expect(pullRequestDraftModeTone("ready")).toContain("emerald"); });
});

// ─── mergeApprovalModeLabel / Tone ────────────────────────────────────────────

describe("mergeApprovalModeLabel", () => {
  it("returns 'Human approval' for human_approval", () => { expect(mergeApprovalModeLabel("human_approval")).toBe("Human approval"); });
  it("returns 'Agent signoff' for agent_signoff", () => { expect(mergeApprovalModeLabel("agent_signoff")).toBe("Agent signoff"); });
  it("returns 'No approval' for no_approval", () => { expect(mergeApprovalModeLabel("no_approval")).toBe("No approval"); });
});

describe("mergeApprovalModeTone", () => {
  it("returns amber for human_approval", () => { expect(mergeApprovalModeTone("human_approval")).toContain("amber"); });
  it("returns emerald for no_approval", () => { expect(mergeApprovalModeTone("no_approval")).toContain("emerald"); });
});

// ─── branchCleanupModeLabel / Tone ───────────────────────────────────────────

describe("branchCleanupModeLabel", () => {
  it("returns 'Manual' for manual", () => { expect(branchCleanupModeLabel("manual")).toBe("Manual"); });
  it("returns 'After merge' for after_merge", () => { expect(branchCleanupModeLabel("after_merge")).toBe("After merge"); });
});

describe("branchCleanupModeTone", () => {
  it("returns emerald for after_merge", () => { expect(branchCleanupModeTone("after_merge")).toContain("emerald"); });
});

// ─── formatUsdAmount ──────────────────────────────────────────────────────────

describe("formatUsdAmount", () => {
  it("returns null for null input", () => { expect(formatUsdAmount(null)).toBeNull(); });
  it("returns null for undefined", () => { expect(formatUsdAmount(undefined)).toBeNull(); });
  it("returns '$0' for zero", () => { expect(formatUsdAmount(0)).toBe("$0"); });
  it("formats values >= 1 to 2 decimal places", () => { expect(formatUsdAmount(3.14159)).toBe("$3.14"); });
  it("formats values >= 0.01 to 4 decimal places", () => { expect(formatUsdAmount(0.0512)).toBe("$0.0512"); });
  it("formats tiny values with toPrecision(2)", () => { expect(formatUsdAmount(0.000123)).toBe("$0.00012"); });
});

// ─── projectModelCostSummary ──────────────────────────────────────────────────

describe("projectModelCostSummary", () => {
  it("returns null for null model", () => {
    expect(projectModelCostSummary(null)).toBeNull();
  });
  it("returns null when all costs are null", () => {
    expect(projectModelCostSummary({ promptCostPerMillionUsd: null, completionCostPerMillionUsd: null, requestCostUsd: null })).toBeNull();
  });
  it("includes prompt cost when set", () => {
    const summary = projectModelCostSummary({ promptCostPerMillionUsd: 1.0, completionCostPerMillionUsd: null, requestCostUsd: null });
    expect(summary).toContain("in $1.00/1M");
  });
  it("includes all parts when all costs are set", () => {
    const summary = projectModelCostSummary({ promptCostPerMillionUsd: 1.0, completionCostPerMillionUsd: 2.0, requestCostUsd: 0.001 });
    expect(summary).toContain("in");
    expect(summary).toContain("out");
    expect(summary).toContain("req");
    expect(summary).toContain("·");
  });
});

// ─── projectRoleModelValues ───────────────────────────────────────────────────

describe("projectRoleModelValues", () => {
  it("returns unique sorted model values", () => {
    const project = { roleDefinitions: [
      { model: "gpt-4" } as any,
      { model: "claude-3" } as any,
      { model: "gpt-4" } as any,
    ]};
    expect(projectRoleModelValues(project)).toEqual(["claude-3", "gpt-4"]);
  });
  it("excludes roles without a model", () => {
    const project = { roleDefinitions: [{ model: null } as any, { model: "" } as any] };
    expect(projectRoleModelValues(project)).toEqual([]);
  });
});

// ─── missingRegistrationFields ────────────────────────────────────────────────

describe("missingRegistrationFields", () => {
  it("returns all fields for null input", () => {
    expect(missingRegistrationFields(null)).toEqual(["name", "repo_url", "default_branch"]);
  });
  it("returns empty array for complete input", () => {
    expect(missingRegistrationFields({ name: "proj", repo_url: "https://github.com/a/b", default_branch: "main" } as any)).toEqual([]);
  });
  it("returns missing field names", () => {
    expect(missingRegistrationFields({ name: "proj", repo_url: "", default_branch: "main" } as any)).toContain("repo_url");
  });
});
