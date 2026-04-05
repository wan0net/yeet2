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
