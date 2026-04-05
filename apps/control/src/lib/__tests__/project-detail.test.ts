import { describe, it, expect } from "vitest";
import {
  formatTimestamp,
  statusLabel,
  statusTone,
  jobStatusTone,
  activeMission,
  sortBlockers,
  recentJobs,
  groupTasksByState,
  latestJob,
  stageLabel,
  taskCanDispatch,
  taskDispatchBlockedReason,
  projectNextDispatchableTask,
  blockerStatusLabel,
  blockerStatusTone,
  blockerLinkedTask,
  agentPresenceOverview,
  missionRecentJobs,
  missionResultSummaries,
} from "$lib/project-detail";
import type {
  ProjectRecord,
  ProjectMissionRecord,
  ProjectTaskRecord,
  ProjectJobRecord,
  ProjectBlockerRecord,
} from "$lib/projects";

// ─── Minimal fixture helpers ──────────────────────────────────────────────────

function makeJob(overrides: Partial<ProjectJobRecord> = {}): ProjectJobRecord {
  return {
    id: "job-1",
    taskId: "task-1",
    workerId: null,
    executorType: "claude",
    assignedRoleDefinitionId: null,
    assignedRoleDefinitionLabel: null,
    assignedRoleDefinitionModel: null,
    workspacePath: "/tmp/workspace",
    branchName: "main",
    status: "complete",
    logPath: null,
    artifactSummary: null,
    artifactData: null,
    startedAt: null,
    completedAt: null,
    githubPrNumber: null,
    githubPrUrl: null,
    githubPrTitle: null,
    githubPrState: null,
    githubPrDraft: null,
    githubPrMergedAt: null,
    githubBranchCleanupState: null,
    githubBranchCleanupDeletedAt: null,
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

// ─── formatTimestamp ──────────────────────────────────────────────────────────

describe("formatTimestamp", () => {
  it("returns null for null input", () => {
    expect(formatTimestamp(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(formatTimestamp("")).toBeNull();
  });

  it("returns the raw string for an invalid date", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });

  it("returns a formatted string for a valid ISO timestamp", () => {
    const result = formatTimestamp("2024-06-15T10:30:00.000Z");
    expect(typeof result).toBe("string");
    expect(result).not.toBeNull();
    // Should contain month abbreviation and numeric day
    expect(result!.length).toBeGreaterThan(0);
  });

  it("accepts an explicit locale without throwing", () => {
    const result = formatTimestamp("2024-01-01T12:00:00.000Z", "en-US");
    expect(typeof result).toBe("string");
  });
});

// ─── statusLabel ─────────────────────────────────────────────────────────────

describe("statusLabel", () => {
  it("returns 'parsed' for parsed", () => {
    expect(statusLabel("parsed")).toBe("parsed");
  });

  it("returns 'pending' for pending", () => {
    expect(statusLabel("pending")).toBe("pending");
  });

  it("returns 'missing' for missing", () => {
    expect(statusLabel("missing")).toBe("missing");
  });

  it("returns 'stale' for stale", () => {
    expect(statusLabel("stale")).toBe("stale");
  });

  it("returns 'failed' for failed", () => {
    expect(statusLabel("failed")).toBe("failed");
  });

  it("returns 'error' for error", () => {
    expect(statusLabel("error")).toBe("error");
  });

  it("returns 'unknown' for an unrecognized status", () => {
    expect(statusLabel("unknown" as any)).toBe("unknown");
  });
});

// ─── statusTone ──────────────────────────────────────────────────────────────

describe("statusTone", () => {
  it("returns emerald classes for parsed", () => {
    expect(statusTone("parsed")).toContain("emerald");
  });

  it("returns amber classes for pending", () => {
    expect(statusTone("pending")).toContain("amber");
  });

  it("returns slate classes for missing", () => {
    expect(statusTone("missing")).toContain("slate");
  });

  it("returns rose classes for failed", () => {
    expect(statusTone("failed")).toContain("rose");
  });

  it("returns rose classes for error", () => {
    expect(statusTone("error")).toContain("rose");
  });

  it("returns a fallback slate class for unknown status", () => {
    expect(statusTone("unknown" as any)).toContain("slate");
  });
});

// ─── jobStatusTone ───────────────────────────────────────────────────────────

describe("jobStatusTone", () => {
  it("returns emerald for complete", () => {
    expect(jobStatusTone("complete")).toContain("emerald");
  });

  it("returns emerald for completed", () => {
    expect(jobStatusTone("completed")).toContain("emerald");
  });

  it("returns sky for running", () => {
    expect(jobStatusTone("running")).toContain("sky");
  });

  it("returns amber for queued", () => {
    expect(jobStatusTone("queued")).toContain("amber");
  });

  it("returns rose for failed", () => {
    expect(jobStatusTone("failed")).toContain("rose");
  });

  it("returns slate for an unknown status", () => {
    expect(jobStatusTone("something-else")).toContain("slate");
  });
});

// ─── activeMission ───────────────────────────────────────────────────────────

describe("activeMission", () => {
  it("returns null when there are no missions", () => {
    const project = makeProject({ missions: [] });
    expect(activeMission(project)).toBeNull();
  });

  it("returns the first active mission", () => {
    const m1 = makeMission({ id: "m1", status: "completed" });
    const m2 = makeMission({ id: "m2", status: "active" });
    const project = makeProject({ missions: [m1, m2] });
    expect(activeMission(project)?.id).toBe("m2");
  });

  it("returns a planned mission if no active one exists", () => {
    const m1 = makeMission({ id: "m1", status: "completed" });
    const m2 = makeMission({ id: "m2", status: "planned" });
    const project = makeProject({ missions: [m1, m2] });
    expect(activeMission(project)?.id).toBe("m2");
  });

  it("falls back to first mission when none is active or planned", () => {
    const m1 = makeMission({ id: "m1", status: "completed" });
    const m2 = makeMission({ id: "m2", status: "completed" });
    const project = makeProject({ missions: [m1, m2] });
    expect(activeMission(project)?.id).toBe("m1");
  });

  it("returns the single mission regardless of status", () => {
    const m = makeMission({ id: "only", status: "completed" });
    const project = makeProject({ missions: [m] });
    expect(activeMission(project)?.id).toBe("only");
  });
});

// ─── sortBlockers ────────────────────────────────────────────────────────────

describe("sortBlockers", () => {
  it("returns empty array for empty input", () => {
    expect(sortBlockers([])).toEqual([]);
  });

  it("places open blockers before resolved ones", () => {
    const resolved = makeBlocker({ id: "b1", status: "resolved", createdAt: "2024-06-10T00:00:00Z" });
    const open = makeBlocker({ id: "b2", status: "open", createdAt: "2024-06-01T00:00:00Z" });
    const result = sortBlockers([resolved, open]);
    expect(result[0].id).toBe("b2");
    expect(result[1].id).toBe("b1");
  });

  it("sorts open blockers by createdAt descending (newest first)", () => {
    const older = makeBlocker({ id: "b1", status: "open", createdAt: "2024-01-01T00:00:00Z" });
    const newer = makeBlocker({ id: "b2", status: "open", createdAt: "2024-06-01T00:00:00Z" });
    const result = sortBlockers([older, newer]);
    expect(result[0].id).toBe("b2");
  });

  it("does not mutate the original array", () => {
    const b1 = makeBlocker({ id: "b1", status: "resolved" });
    const b2 = makeBlocker({ id: "b2", status: "open" });
    const original = [b1, b2];
    sortBlockers(original);
    expect(original[0].id).toBe("b1");
  });

  it("handles blockers with null createdAt", () => {
    const b1 = makeBlocker({ id: "b1", status: "open", createdAt: null });
    const b2 = makeBlocker({ id: "b2", status: "open", createdAt: "2024-06-01T00:00:00Z" });
    const result = sortBlockers([b1, b2]);
    // b2 has a real date so it sorts first (descending)
    expect(result[0].id).toBe("b2");
  });
});

// ─── recentJobs ──────────────────────────────────────────────────────────────

describe("recentJobs", () => {
  it("returns empty array for a project with no missions", () => {
    const project = makeProject({ missions: [] });
    expect(recentJobs(project)).toEqual([]);
  });

  it("returns empty array when tasks have no jobs", () => {
    const project = makeProject({
      missions: [makeMission({ tasks: [makeTask({ jobs: [] })] })],
    });
    expect(recentJobs(project)).toEqual([]);
  });

  it("returns one entry per job across all missions and tasks", () => {
    const job1 = makeJob({ id: "j1", startedAt: "2024-06-01T10:00:00Z" });
    const job2 = makeJob({ id: "j2", startedAt: "2024-06-02T10:00:00Z" });
    const task1 = makeTask({ id: "t1", jobs: [job1] });
    const task2 = makeTask({ id: "t2", jobs: [job2] });
    const mission = makeMission({ tasks: [task1, task2] });
    const project = makeProject({ missions: [mission] });
    const result = recentJobs(project);
    expect(result).toHaveLength(2);
  });

  it("sorts by startedAt descending (most recent first)", () => {
    const olderJob = makeJob({ id: "j1", startedAt: "2024-01-01T10:00:00Z" });
    const newerJob = makeJob({ id: "j2", startedAt: "2024-06-01T10:00:00Z" });
    const task = makeTask({ jobs: [olderJob, newerJob] });
    const project = makeProject({ missions: [makeMission({ tasks: [task] })] });
    const result = recentJobs(project);
    expect(result[0].job.id).toBe("j2");
    expect(result[1].job.id).toBe("j1");
  });

  it("falls back to completedAt when startedAt is missing", () => {
    const jobWithCompleted = makeJob({ id: "j1", startedAt: null, completedAt: "2024-06-05T00:00:00Z" });
    const jobWithStarted = makeJob({ id: "j2", startedAt: "2024-01-01T00:00:00Z", completedAt: null });
    const task = makeTask({ jobs: [jobWithStarted, jobWithCompleted] });
    const project = makeProject({ missions: [makeMission({ tasks: [task] })] });
    const result = recentJobs(project);
    // jobWithCompleted has a later timestamp
    expect(result[0].job.id).toBe("j1");
  });
});

// ─── groupTasksByState ────────────────────────────────────────────────────────

describe("groupTasksByState", () => {
  it("returns empty array for a project with no missions", () => {
    const project = makeProject({ missions: [] });
    expect(groupTasksByState(project)).toEqual([]);
  });

  it("groups tasks by their status", () => {
    const t1 = makeTask({ id: "t1", status: "pending" });
    const t2 = makeTask({ id: "t2", status: "pending" });
    const t3 = makeTask({ id: "t3", status: "completed" });
    const mission = makeMission({ tasks: [t1, t2, t3] });
    const project = makeProject({ missions: [mission] });
    const result = groupTasksByState(project);
    const pendingGroup = result.find((g) => g.state === "pending");
    const completedGroup = result.find((g) => g.state === "completed");
    expect(pendingGroup?.tasks).toHaveLength(2);
    expect(completedGroup?.tasks).toHaveLength(1);
  });

  it("sorts groups by size descending", () => {
    const t1 = makeTask({ id: "t1", status: "running" });
    const t2 = makeTask({ id: "t2", status: "pending" });
    const t3 = makeTask({ id: "t3", status: "pending" });
    const mission = makeMission({ tasks: [t1, t2, t3] });
    const project = makeProject({ missions: [mission] });
    const result = groupTasksByState(project);
    // pending has 2 tasks, running has 1 — pending should come first
    expect(result[0].state).toBe("pending");
  });

  it("includes tasks from multiple missions", () => {
    const m1 = makeMission({ id: "m1", tasks: [makeTask({ id: "t1", status: "running" })] });
    const m2 = makeMission({ id: "m2", tasks: [makeTask({ id: "t2", status: "running" })] });
    const project = makeProject({ missions: [m1, m2] });
    const result = groupTasksByState(project);
    const runningGroup = result.find((g) => g.state === "running");
    expect(runningGroup?.tasks).toHaveLength(2);
  });

  it("uses 'unknown' for tasks with no status", () => {
    // We set status to empty string directly on the object to bypass type safety
    const task = makeTask({ id: "t1", status: "" as any });
    const project = makeProject({ missions: [makeMission({ tasks: [task] })] });
    const result = groupTasksByState(project);
    // empty string status falls into state "" which groupTasksByState stores as-is,
    // but the function uses `task.status || "unknown"` so it should map to "unknown"
    const unknownGroup = result.find((g) => g.state === "unknown");
    expect(unknownGroup?.tasks).toHaveLength(1);
  });
});

// ─── latestJob ───────────────────────────────────────────────────────────────

describe("latestJob", () => {
  it("returns null when there are no jobs", () => {
    const task = makeTask({ jobs: [] });
    expect(latestJob(task)).toBeNull();
  });

  it("returns the first job in the array (jobs[0])", () => {
    const j1 = makeJob({ id: "j1" });
    const j2 = makeJob({ id: "j2" });
    const task = makeTask({ jobs: [j1, j2] });
    expect(latestJob(task)?.id).toBe("j1");
  });

  it("returns the only job when there is exactly one", () => {
    const j = makeJob({ id: "solo" });
    const task = makeTask({ jobs: [j] });
    expect(latestJob(task)?.id).toBe("solo");
  });
});

// ─── stageLabel ──────────────────────────────────────────────────────────────

describe("stageLabel", () => {
  it("returns 'implementation' for implementer", () => {
    expect(stageLabel("implementer")).toBe("implementation");
  });

  it("returns 'QA' for qa", () => {
    expect(stageLabel("qa")).toBe("QA");
  });

  it("returns 'review' for reviewer", () => {
    expect(stageLabel("reviewer")).toBe("review");
  });

  it("is case-insensitive", () => {
    expect(stageLabel("Implementer")).toBe("implementation");
    expect(stageLabel("QA")).toBe("QA");
  });

  it("returns the key unchanged for unknown roles", () => {
    expect(stageLabel("planner")).toBe("planner");
  });
});

// ─── taskCanDispatch ─────────────────────────────────────────────────────────

describe("taskCanDispatch", () => {
  it("uses task.dispatchable when it is a boolean true", () => {
    const project = makeProject();
    const task = makeTask({ dispatchable: true, status: "completed" });
    expect(taskCanDispatch(project, task)).toBe(true);
  });

  it("uses task.dispatchable when it is a boolean false", () => {
    const project = makeProject();
    const task = makeTask({ dispatchable: false, status: "pending", agentRole: "implementer" });
    expect(taskCanDispatch(project, task)).toBe(false);
  });

  it("returns true via fallback for pending implementer task with no constraints", () => {
    const project = makeProject();
    const task = makeTask({ agentRole: "implementer", status: "pending" });
    expect(taskCanDispatch(project, task)).toBe(true);
  });

  it("returns false when role is not dispatchable", () => {
    const project = makeProject();
    const task = makeTask({ agentRole: "planner", status: "pending" });
    expect(taskCanDispatch(project, task)).toBe(false);
  });

  it("returns false when status is not pending/ready/failed", () => {
    const project = makeProject();
    const task = makeTask({ agentRole: "implementer", status: "completed" });
    expect(taskCanDispatch(project, task)).toBe(false);
  });

  it("respects nextDispatchableTaskId constraint", () => {
    const task1 = makeTask({ id: "t1", agentRole: "implementer", status: "pending" });
    const task2 = makeTask({ id: "t2", agentRole: "implementer", status: "pending" });
    const project = makeProject({ nextDispatchableTaskId: "t1" });
    expect(taskCanDispatch(project, task1)).toBe(true);
    expect(taskCanDispatch(project, task2)).toBe(false);
  });

  it("respects dispatchableRoles constraint", () => {
    const project = makeProject({ dispatchableRoles: ["reviewer"] });
    const implementerTask = makeTask({ agentRole: "implementer", status: "pending" });
    const reviewerTask = makeTask({ agentRole: "reviewer", status: "pending" });
    expect(taskCanDispatch(project, implementerTask)).toBe(false);
    expect(taskCanDispatch(project, reviewerTask)).toBe(true);
  });
});

// ─── taskDispatchBlockedReason ────────────────────────────────────────────────

describe("taskDispatchBlockedReason", () => {
  it("returns null when the task can dispatch", () => {
    const project = makeProject();
    const task = makeTask({ agentRole: "implementer", status: "pending" });
    expect(taskDispatchBlockedReason(project, task)).toBeNull();
  });

  it("returns task.dispatchBlockedReason when task cannot dispatch", () => {
    const project = makeProject();
    const task = makeTask({
      agentRole: "planner",
      status: "pending",
      dispatchBlockedReason: "Role not supported",
    });
    expect(taskDispatchBlockedReason(project, task)).toBe("Role not supported");
  });

  it("returns null when blocked but no reason provided", () => {
    const project = makeProject();
    const task = makeTask({ agentRole: "planner", status: "pending" });
    expect(taskDispatchBlockedReason(project, task)).toBeNull();
  });
});

// ─── projectNextDispatchableTask ──────────────────────────────────────────────

describe("projectNextDispatchableTask", () => {
  it("returns null when nextDispatchableTaskId is not set", () => {
    const project = makeProject({ missions: [] });
    expect(projectNextDispatchableTask(project)).toBeNull();
  });

  it("finds the task matching nextDispatchableTaskId", () => {
    const task = makeTask({ id: "t-next" });
    const mission = makeMission({ tasks: [task] });
    const project = makeProject({ missions: [mission], nextDispatchableTaskId: "t-next" });
    expect(projectNextDispatchableTask(project)?.id).toBe("t-next");
  });

  it("returns null when the id does not match any task", () => {
    const task = makeTask({ id: "t1" });
    const mission = makeMission({ tasks: [task] });
    const project = makeProject({ missions: [mission], nextDispatchableTaskId: "t-nonexistent" });
    expect(projectNextDispatchableTask(project)).toBeNull();
  });
});

// ─── blockerStatusLabel ───────────────────────────────────────────────────────

describe("blockerStatusLabel", () => {
  it("returns 'resolved' for resolved", () => {
    expect(blockerStatusLabel("resolved")).toBe("resolved");
  });

  it("returns 'dismissed' for dismissed", () => {
    expect(blockerStatusLabel("dismissed")).toBe("dismissed");
  });

  it("returns 'open' for open", () => {
    expect(blockerStatusLabel("open")).toBe("open");
  });

  it("is case-insensitive", () => {
    expect(blockerStatusLabel("OPEN")).toBe("open");
  });

  it("returns 'unknown' for empty string", () => {
    expect(blockerStatusLabel("")).toBe("unknown");
  });

  it("returns the original value for unrecognized non-empty status", () => {
    expect(blockerStatusLabel("custom")).toBe("custom");
  });
});

// ─── blockerStatusTone ────────────────────────────────────────────────────────

describe("blockerStatusTone", () => {
  it("returns emerald for resolved", () => {
    expect(blockerStatusTone("resolved")).toContain("emerald");
  });

  it("returns slate for dismissed", () => {
    expect(blockerStatusTone("dismissed")).toContain("slate");
  });

  it("returns amber for open", () => {
    expect(blockerStatusTone("open")).toContain("amber");
  });

  it("returns slate for unknown status", () => {
    expect(blockerStatusTone("whatever")).toContain("slate");
  });
});

// ─── blockerLinkedTask ────────────────────────────────────────────────────────

describe("blockerLinkedTask", () => {
  it("returns null when blocker has no taskId", () => {
    const project = makeProject();
    const blocker = makeBlocker({ taskId: null });
    expect(blockerLinkedTask(project, blocker)).toBeNull();
  });

  it("returns the matching task", () => {
    const task = makeTask({ id: "t-linked" });
    const mission = makeMission({ tasks: [task] });
    const project = makeProject({ missions: [mission] });
    const blocker = makeBlocker({ taskId: "t-linked" });
    expect(blockerLinkedTask(project, blocker)?.id).toBe("t-linked");
  });

  it("returns null when the taskId does not match any task", () => {
    const task = makeTask({ id: "t1" });
    const mission = makeMission({ tasks: [task] });
    const project = makeProject({ missions: [mission] });
    const blocker = makeBlocker({ taskId: "nonexistent" });
    expect(blockerLinkedTask(project, blocker)).toBeNull();
  });
});

// ─── agentPresenceOverview ────────────────────────────────────────────────────

describe("agentPresenceOverview", () => {
  it("returns an overview with a roles array", () => {
    const project = makeProject();
    const result = agentPresenceOverview(project);
    expect(Array.isArray(result.roles)).toBe(true);
  });

  it("includes missionProgress with correct shape", () => {
    const project = makeProject();
    const result = agentPresenceOverview(project);
    expect(result.missionProgress).toMatchObject({ completed: 0, total: 0, percent: 0 });
  });

  it("counts open blockers correctly", () => {
    const b1 = makeBlocker({ id: "b1", status: "open" });
    const b2 = makeBlocker({ id: "b2", status: "resolved" });
    const project = makeProject({ blockers: [b1, b2] });
    const result = agentPresenceOverview(project);
    expect(result.openBlockerCount).toBe(1);
  });

  it("builds one role snapshot per roleDefinition", () => {
    const role1: import("$lib/projects").ProjectRoleDefinition = {
      id: "r1",
      roleKey: "implementer",
      sortOrder: 1,
      visualName: "Implementer",
      label: "Implementer",
      enabled: true,
      model: null,
      recommendedModel: null,
      effectiveModel: null,
      goal: "",
      backstory: "",
    };
    const role2: import("$lib/projects").ProjectRoleDefinition = {
      id: "r2",
      roleKey: "reviewer",
      sortOrder: 2,
      visualName: "Reviewer",
      label: "Reviewer",
      enabled: true,
      model: null,
      recommendedModel: null,
      effectiveModel: null,
      goal: "",
      backstory: "",
    };
    const project = makeProject({ roleDefinitions: [role1, role2] });
    const result = agentPresenceOverview(project);
    expect(result.roles).toHaveLength(2);
  });

  it("computes percent progress correctly", () => {
    const t1 = makeTask({ id: "t1", status: "completed" });
    const t2 = makeTask({ id: "t2", status: "pending" });
    const mission = makeMission({ tasks: [t1, t2] });
    const project = makeProject({ missions: [mission] });
    const result = agentPresenceOverview(project);
    expect(result.missionProgress.completed).toBe(1);
    expect(result.missionProgress.total).toBe(2);
    expect(result.missionProgress.percent).toBe(50);
  });
});

// ─── missionRecentJobs ────────────────────────────────────────────────────────

describe("missionRecentJobs", () => {
  it("returns empty array for a mission with no tasks", () => {
    const mission = makeMission({ tasks: [] });
    expect(missionRecentJobs(mission)).toEqual([]);
  });

  it("returns a flat list of { job, task } entries", () => {
    const job = makeJob({ id: "j1" });
    const task = makeTask({ jobs: [job] });
    const mission = makeMission({ tasks: [task] });
    const result = missionRecentJobs(mission);
    expect(result).toHaveLength(1);
    expect(result[0].job.id).toBe("j1");
    expect(result[0].task.id).toBe("task-1");
  });

  it("sorts by startedAt descending", () => {
    const j1 = makeJob({ id: "j1", startedAt: "2024-01-01T00:00:00Z" });
    const j2 = makeJob({ id: "j2", startedAt: "2024-06-01T00:00:00Z" });
    const task = makeTask({ jobs: [j1, j2] });
    const mission = makeMission({ tasks: [task] });
    const result = missionRecentJobs(mission);
    expect(result[0].job.id).toBe("j2");
  });
});

// ─── missionResultSummaries ───────────────────────────────────────────────────

describe("missionResultSummaries", () => {
  it("returns empty array when no jobs have artifactSummary", () => {
    const job = makeJob({ artifactSummary: null });
    const task = makeTask({ jobs: [job] });
    const mission = makeMission({ tasks: [task] });
    expect(missionResultSummaries(mission)).toEqual([]);
  });

  it("includes only jobs with an artifactSummary", () => {
    const j1 = makeJob({ id: "j1", artifactSummary: "All tests passed" });
    const j2 = makeJob({ id: "j2", artifactSummary: null });
    const task = makeTask({ jobs: [j1, j2] });
    const mission = makeMission({ tasks: [task] });
    const result = missionResultSummaries(mission);
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe("All tests passed");
    expect(result[0].job.id).toBe("j1");
  });

  it("includes task reference alongside job and summary", () => {
    const job = makeJob({ id: "j1", artifactSummary: "Done" });
    const task = makeTask({ id: "t-special", jobs: [job] });
    const mission = makeMission({ tasks: [task] });
    const result = missionResultSummaries(mission);
    expect(result[0].task.id).toBe("t-special");
  });
});
