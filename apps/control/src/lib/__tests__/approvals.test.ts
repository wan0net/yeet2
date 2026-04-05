import { describe, it, expect } from "vitest";
import { isHumanReviewApproval, flattenProjectApprovals } from "$lib/approvals";
import type { ProjectBlockerRecord, ProjectMissionRecord, ProjectRecord, ProjectTaskRecord } from "$lib/projects";

// ─── Minimal fixture helpers ──────────────────────────────────────────────────

function makeBlocker(overrides: Partial<ProjectBlockerRecord> = {}): ProjectBlockerRecord {
  return {
    id: "blocker-1",
    taskId: null,
    title: "Human review required: check this PR",
    context: null,
    options: [],
    recommendation: null,
    status: "open",
    githubIssueUrl: null,
    createdAt: null,
    resolvedAt: null,
    ...overrides,
  };
}

function makeTask(overrides: Partial<ProjectTaskRecord> = {}): ProjectTaskRecord {
  return {
    id: "task-1",
    missionId: "mission-1",
    title: "Test task",
    description: "",
    agentRole: "implementer",
    assignedRoleDefinitionId: null,
    assignedRoleDefinitionLabel: null,
    status: "pending",
    priority: 0,
    acceptanceCriteria: [],
    attempts: 0,
    blockerReason: null,
    jobs: [],
    ...overrides,
  };
}

function makeMission(overrides: Partial<ProjectMissionRecord> = {}): ProjectMissionRecord {
  return {
    id: "mission-1",
    projectId: "project-1",
    title: "Test mission",
    objective: "Do things",
    status: "active",
    createdBy: null,
    planningProvenance: "brain",
    startedAt: null,
    completedAt: null,
    tasks: [],
    ...overrides,
  };
}

function makeProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: "project-1",
    name: "Test project",
    repoUrl: "https://github.com/acme/test",
    defaultBranch: "main",
    localPath: "/tmp/project",
    constitutionStatus: "parsed",
    constitution: { status: "parsed" },
    autonomy: {
      mode: "manual",
      pullRequestMode: "manual",
      pullRequestDraftMode: "ready",
      mergeApprovalMode: "human_approval",
      branchCleanupMode: "manual",
      lastRunStatus: null,
      lastRunMessage: null,
      lastRunAt: null,
      nextRunAt: null,
    },
    roleDefinitions: [],
    missions: [],
    decisionLogs: [],
    operatorGuidance: [],
    blockers: [],
    ...overrides,
  };
}

// ─── isHumanReviewApproval ────────────────────────────────────────────────────

describe("isHumanReviewApproval", () => {
  it("returns true for a blocker title starting with 'Human review required'", () => {
    const blocker = makeBlocker({ title: "Human review required: merge PR #42" });
    expect(isHumanReviewApproval(blocker)).toBe(true);
  });

  it("is case-insensitive", () => {
    const blocker = makeBlocker({ title: "HUMAN REVIEW REQUIRED" });
    expect(isHumanReviewApproval(blocker)).toBe(true);
  });

  it("handles leading whitespace in title", () => {
    const blocker = makeBlocker({ title: "  human review required: something" });
    expect(isHumanReviewApproval(blocker)).toBe(true);
  });

  it("returns false for a regular blocker title", () => {
    const blocker = makeBlocker({ title: "Dependency missing" });
    expect(isHumanReviewApproval(blocker)).toBe(false);
  });

  it("returns false for an empty title", () => {
    const blocker = makeBlocker({ title: "" });
    expect(isHumanReviewApproval(blocker)).toBe(false);
  });
});

// ─── flattenProjectApprovals ──────────────────────────────────────────────────

describe("flattenProjectApprovals", () => {
  it("returns empty array for no projects", () => {
    expect(flattenProjectApprovals([])).toEqual([]);
  });

  it("returns empty array when no blockers are human review approvals", () => {
    const blocker = makeBlocker({ title: "Something else" });
    const project = makeProject({ blockers: [blocker] });
    expect(flattenProjectApprovals([project])).toEqual([]);
  });

  it("includes only human review approval blockers", () => {
    const approval = makeBlocker({ id: "b1", title: "Human review required: PR ready" });
    const other = makeBlocker({ id: "b2", title: "Build failed" });
    const project = makeProject({ blockers: [approval, other] });
    const result = flattenProjectApprovals([project]);
    expect(result).toHaveLength(1);
    expect(result[0].blocker.id).toBe("b1");
  });

  it("includes project metadata on each entry", () => {
    const approval = makeBlocker({ title: "Human review required" });
    const project = makeProject({ id: "p1", name: "My Project", repoUrl: "https://github.com/acme/test", blockers: [approval] });
    const result = flattenProjectApprovals([project]);
    expect(result[0].projectId).toBe("p1");
    expect(result[0].projectName).toBe("My Project");
    expect(result[0].projectRepoUrl).toBe("https://github.com/acme/test");
  });

  it("resolves taskTitle when blocker has a linked task", () => {
    const task = makeTask({ id: "t1", title: "Review this" });
    const mission = makeMission({ tasks: [task] });
    const approval = makeBlocker({ title: "Human review required", taskId: "t1" });
    const project = makeProject({ missions: [mission], blockers: [approval] });
    const result = flattenProjectApprovals([project]);
    expect(result[0].taskTitle).toBe("Review this");
  });

  it("sets taskTitle to null when no linked task", () => {
    const approval = makeBlocker({ title: "Human review required", taskId: null });
    const project = makeProject({ blockers: [approval] });
    const result = flattenProjectApprovals([project]);
    expect(result[0].taskTitle).toBeNull();
  });

  it("sorts open approvals before resolved ones", () => {
    const resolved = makeBlocker({ id: "b-resolved", title: "Human review required", status: "resolved", createdAt: "2024-06-10T00:00:00Z" });
    const open = makeBlocker({ id: "b-open", title: "Human review required", status: "open", createdAt: "2024-01-01T00:00:00Z" });
    const project = makeProject({ blockers: [resolved, open] });
    const result = flattenProjectApprovals([project]);
    expect(result[0].blocker.id).toBe("b-open");
    expect(result[1].blocker.id).toBe("b-resolved");
  });

  it("flattens approvals from multiple projects", () => {
    const a1 = makeBlocker({ id: "a1", title: "Human review required" });
    const a2 = makeBlocker({ id: "a2", title: "Human review required" });
    const p1 = makeProject({ id: "p1", blockers: [a1] });
    const p2 = makeProject({ id: "p2", blockers: [a2] });
    const result = flattenProjectApprovals([p1, p2]);
    expect(result).toHaveLength(2);
  });
});
