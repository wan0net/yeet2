import { describe, it, expect } from "vitest";
import { isOpenBlocker, flattenProjectBlockers } from "$lib/blockers";
import type { ProjectBlockerRecord, ProjectRecord, ProjectMissionRecord, ProjectTaskRecord } from "$lib/projects";

// ─── Minimal fixture helpers ──────────────────────────────────────────────────

function makeBlocker(overrides: Partial<ProjectBlockerRecord> = {}): ProjectBlockerRecord {
  return {
    id: "blocker-1",
    taskId: null,
    title: "A blocker",
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

function makeMission(
  overrides: Partial<ProjectMissionRecord> = {}
): ProjectMissionRecord {
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

// ─── isOpenBlocker ────────────────────────────────────────────────────────────

describe("isOpenBlocker", () => {
  it("returns true for 'open'", () => {
    expect(isOpenBlocker("open")).toBe(true);
  });

  it("returns true for uppercase 'OPEN'", () => {
    expect(isOpenBlocker("OPEN")).toBe(true);
  });

  it("returns true for padded '  open  '", () => {
    expect(isOpenBlocker("  open  ")).toBe(true);
  });

  it("returns false for 'resolved'", () => {
    expect(isOpenBlocker("resolved")).toBe(false);
  });

  it("returns false for 'dismissed'", () => {
    expect(isOpenBlocker("dismissed")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isOpenBlocker("")).toBe(false);
  });
});

// ─── flattenProjectBlockers ───────────────────────────────────────────────────

describe("flattenProjectBlockers", () => {
  it("returns empty array for no projects", () => {
    expect(flattenProjectBlockers([])).toEqual([]);
  });

  it("returns empty array for a project with no blockers", () => {
    const project = makeProject({ blockers: [] });
    expect(flattenProjectBlockers([project])).toEqual([]);
  });

  it("flattens blockers from a single project", () => {
    const blocker = makeBlocker({ id: "b1" });
    const project = makeProject({ blockers: [blocker] });
    const result = flattenProjectBlockers([project]);
    expect(result).toHaveLength(1);
    expect(result[0].blocker.id).toBe("b1");
    expect(result[0].projectId).toBe("project-1");
    expect(result[0].projectName).toBe("Test project");
  });

  it("flattens blockers from multiple projects", () => {
    const p1 = makeProject({ id: "p1", name: "Proj 1", blockers: [makeBlocker({ id: "b1" })] });
    const p2 = makeProject({ id: "p2", name: "Proj 2", blockers: [makeBlocker({ id: "b2" }), makeBlocker({ id: "b3" })] });
    const result = flattenProjectBlockers([p1, p2]);
    expect(result).toHaveLength(3);
  });

  it("sorts open blockers before resolved ones", () => {
    const resolved = makeBlocker({ id: "b-resolved", status: "resolved", createdAt: "2024-06-10T00:00:00Z" });
    const open = makeBlocker({ id: "b-open", status: "open", createdAt: "2024-01-01T00:00:00Z" });
    const project = makeProject({ blockers: [resolved, open] });
    const result = flattenProjectBlockers([project]);
    expect(result[0].blocker.id).toBe("b-open");
    expect(result[1].blocker.id).toBe("b-resolved");
  });

  it("resolves taskTitle for blockers with a linked task", () => {
    const task = makeTask({ id: "t1", title: "My Task" });
    const mission = makeMission({ tasks: [task] });
    const blocker = makeBlocker({ id: "b1", taskId: "t1" });
    const project = makeProject({ missions: [mission], blockers: [blocker] });
    const result = flattenProjectBlockers([project]);
    expect(result[0].taskTitle).toBe("My Task");
  });

  it("sets taskTitle to null when blocker has no taskId", () => {
    const blocker = makeBlocker({ id: "b1", taskId: null });
    const project = makeProject({ blockers: [blocker] });
    const result = flattenProjectBlockers([project]);
    expect(result[0].taskTitle).toBeNull();
  });

  it("sorts open blockers by createdAt descending within open group", () => {
    const older = makeBlocker({ id: "b-old", status: "open", createdAt: "2024-01-01T00:00:00Z" });
    const newer = makeBlocker({ id: "b-new", status: "open", createdAt: "2024-06-01T00:00:00Z" });
    const project = makeProject({ blockers: [older, newer] });
    const result = flattenProjectBlockers([project]);
    expect(result[0].blocker.id).toBe("b-new");
  });
});
