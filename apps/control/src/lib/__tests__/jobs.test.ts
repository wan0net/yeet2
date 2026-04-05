import { describe, it, expect } from "vitest";
import { flattenProjectJobs } from "$lib/jobs";
import type { ProjectJobRecord, ProjectMissionRecord, ProjectRecord, ProjectTaskRecord } from "$lib/projects";

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

// ─── flattenProjectJobs ───────────────────────────────────────────────────────

describe("flattenProjectJobs", () => {
  it("returns empty array for no projects", () => {
    expect(flattenProjectJobs([])).toEqual([]);
  });

  it("returns empty array when projects have no jobs", () => {
    const project = makeProject({ missions: [makeMission({ tasks: [makeTask({ jobs: [] })] })] });
    expect(flattenProjectJobs([project])).toEqual([]);
  });

  it("flattens jobs from a single project", () => {
    const job = makeJob({ id: "j1" });
    const task = makeTask({ jobs: [job] });
    const mission = makeMission({ tasks: [task] });
    const project = makeProject({ missions: [mission] });
    const result = flattenProjectJobs([project]);
    expect(result).toHaveLength(1);
    expect(result[0].job.id).toBe("j1");
  });

  it("includes project, mission, and task fields on each entry", () => {
    const job = makeJob({ id: "j1" });
    const task = makeTask({ id: "t1", title: "My task", jobs: [job] });
    const mission = makeMission({ id: "m1", title: "My mission", tasks: [task] });
    const project = makeProject({ id: "p1", name: "My project", missions: [mission] });
    const result = flattenProjectJobs([project]);
    expect(result[0].project.id).toBe("p1");
    expect(result[0].project.name).toBe("My project");
    expect(result[0].mission?.id).toBe("m1");
    expect(result[0].task?.id).toBe("t1");
  });

  it("flattens jobs from multiple projects", () => {
    const j1 = makeJob({ id: "j1" });
    const j2 = makeJob({ id: "j2" });
    const p1 = makeProject({ id: "p1", missions: [makeMission({ tasks: [makeTask({ jobs: [j1] })] })] });
    const p2 = makeProject({ id: "p2", missions: [makeMission({ tasks: [makeTask({ jobs: [j2] })] })] });
    const result = flattenProjectJobs([p1, p2]);
    expect(result).toHaveLength(2);
  });

  it("sorts by completedAt descending (most recent first)", () => {
    const j1 = makeJob({ id: "j1", completedAt: "2024-01-01T10:00:00Z", startedAt: null });
    const j2 = makeJob({ id: "j2", completedAt: "2024-06-01T10:00:00Z", startedAt: null });
    const task = makeTask({ jobs: [j1, j2] });
    const mission = makeMission({ tasks: [task] });
    const project = makeProject({ missions: [mission] });
    const result = flattenProjectJobs([project]);
    expect(result[0].job.id).toBe("j2");
    expect(result[1].job.id).toBe("j1");
  });

  it("prefers completedAt over startedAt for sort timestamp", () => {
    const j1 = makeJob({ id: "j1", completedAt: "2024-06-01T10:00:00Z", startedAt: "2024-01-01T00:00:00Z" });
    const j2 = makeJob({ id: "j2", completedAt: null, startedAt: "2024-05-01T00:00:00Z" });
    const task = makeTask({ jobs: [j1, j2] });
    const project = makeProject({ missions: [makeMission({ tasks: [task] })] });
    const result = flattenProjectJobs([project]);
    // j1.completedAt = Jun > j2.startedAt = May
    expect(result[0].job.id).toBe("j1");
  });

  it("assigns sortTimestamp of 0 for jobs with no timestamps", () => {
    const job = makeJob({ id: "j1", completedAt: null, startedAt: null });
    const task = makeTask({ jobs: [job] });
    const project = makeProject({ missions: [makeMission({ tasks: [task] })] });
    const result = flattenProjectJobs([project]);
    expect(result[0].sortTimestamp).toBe(0);
  });
});
