/**
 * Integration boundary tests for API → Brain HTTP handoff.
 *
 * These tests verify that decideWorkflowAction and createTaskStageBrief build
 * the correct HTTP payloads and parse responses correctly, without calling any
 * real Brain service.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTaskStageBrief, decideWorkflowAction } from "../planning.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDecideInput() {
  return {
    projectId: "proj-abc",
    projectName: "TestProject",
    autonomyMode: "supervised",
    hasInFlightJobs: false,
    needsInitialPlanning: false,
    needsBacklogPlanning: false,
    dispatchableTasks: [
      {
        id: "task-1",
        title: "Build the API",
        agentRole: "implementer",
        priority: 1,
        attempts: 0,
        missionId: "mission-1",
        missionTitle: "Mission One",
      },
    ],
    nextDispatchableTaskId: "task-1",
    nextDispatchableTaskRole: "implementer",
    pullRequestMode: "auto",
    pullRequestDraftMode: "off",
    mergeApprovalMode: "manual",
    latestCompletedJobId: null,
    latestCompletedTaskId: null,
    latestCompletedTaskTitle: null,
    latestCompletedJobHasPullRequest: false,
    latestCompletedReviewerComplete: false,
    latestCompletedDispatchableTasksComplete: false,
  };
}

function makeStageBriefInput() {
  return {
    projectId: "proj-abc",
    projectName: "TestProject",
    missionId: "mission-1",
    missionTitle: "Mission One",
    missionObjective: "Ship the first slice.",
    taskId: "task-1",
    taskTitle: "Build the API",
    taskDescription: "Implement the REST endpoints.",
    taskAgentRole: "implementer",
    taskPriority: 1,
    taskAttempts: 0,
    acceptanceCriteria: ["Endpoint returns 200", "Latency under 200ms"],
    assignedRoleLabel: "Senior Engineer",
    assignedRoleGoal: "Deliver robust APIs",
    assignedRoleBackstory: "Experienced in distributed systems",
    operatorGuidance: [],
  };
}

function makeOkFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

// ---------------------------------------------------------------------------
// brainBaseUrl defaults
// ---------------------------------------------------------------------------

describe("brainBaseUrl defaults", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses http://127.0.0.1:8011 when no env vars are set", async () => {
    const prev1 = process.env.YEET2_BRAIN_BASE_URL;
    const prev2 = process.env.BRAIN_BASE_URL;
    delete process.env.YEET2_BRAIN_BASE_URL;
    delete process.env.BRAIN_BASE_URL;

    try {
      const mockFetch = makeOkFetch({
        projectId: "proj-abc",
        action: "idle",
        reason: "no work",
        source: "brain",
      });
      vi.stubGlobal("fetch", mockFetch);

      await decideWorkflowAction(makeDecideInput());

      const url = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:8011\//);
    } finally {
      if (prev1 !== undefined) process.env.YEET2_BRAIN_BASE_URL = prev1;
      if (prev2 !== undefined) process.env.BRAIN_BASE_URL = prev2;
    }
  });

  it("uses YEET2_BRAIN_BASE_URL when set", async () => {
    vi.stubEnv("YEET2_BRAIN_BASE_URL", "http://brain:3002");

    const mockFetch = makeOkFetch({
      projectId: "proj-abc",
      action: "idle",
      reason: "no work",
      source: "brain",
    });
    vi.stubGlobal("fetch", mockFetch);

    await decideWorkflowAction(makeDecideInput());

    const url = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toMatch(/^http:\/\/brain:3002\//);
  });
});

// ---------------------------------------------------------------------------
// decideWorkflowAction URL and payload
// ---------------------------------------------------------------------------

describe("decideWorkflowAction", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls /orchestration/decide", async () => {
    vi.stubEnv("YEET2_BRAIN_BASE_URL", "http://brain-test:9999");

    const mockFetch = makeOkFetch({
      projectId: "proj-abc",
      action: "advance",
      reason: "tasks ready",
      source: "brain",
      targetTaskId: "task-1",
      targetTaskRole: "implementer",
    });
    vi.stubGlobal("fetch", mockFetch);

    await decideWorkflowAction(makeDecideInput());

    const url = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe("http://brain-test:9999/orchestration/decide");
  });

  it("sends POST with Content-Type application/json", async () => {
    vi.stubEnv("YEET2_BRAIN_BASE_URL", "http://brain-test:9999");

    const mockFetch = makeOkFetch({
      projectId: "proj-abc",
      action: "idle",
      reason: "x",
      source: "brain",
    });
    vi.stubGlobal("fetch", mockFetch);

    await decideWorkflowAction(makeDecideInput());

    const [, init] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("sends snake_case payload fields", async () => {
    vi.stubEnv("YEET2_BRAIN_BASE_URL", "http://brain-test:9999");

    const mockFetch = makeOkFetch({
      projectId: "proj-abc",
      action: "idle",
      reason: "x",
      source: "brain",
    });
    vi.stubGlobal("fetch", mockFetch);

    await decideWorkflowAction(makeDecideInput());

    const [, init] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body).toMatchObject({
      project_id: "proj-abc",
      project_name: "TestProject",
      autonomy_mode: "supervised",
      has_in_flight_jobs: false,
      needs_initial_planning: false,
      needs_backlog_planning: false,
      next_dispatchable_task_id: "task-1",
      next_dispatchable_task_role: "implementer",
      pull_request_mode: "auto",
      merge_approval_mode: "manual",
    });

    expect(Array.isArray(body.dispatchable_tasks)).toBe(true);
    const tasks = body.dispatchable_tasks as Array<Record<string, unknown>>;
    expect(tasks[0]).toMatchObject({
      id: "task-1",
      agent_role: "implementer",
      mission_id: "mission-1",
      mission_title: "Mission One",
    });
  });

  it("parses and returns a valid decision response", async () => {
    vi.stubEnv("YEET2_BRAIN_BASE_URL", "http://brain-test:9999");

    const mockFetch = makeOkFetch({
      projectId: "proj-abc",
      action: "advance",
      reason: "task ready",
      source: "brain",
      targetTaskId: "task-1",
      targetTaskRole: "implementer",
      targetJobId: null,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await decideWorkflowAction(makeDecideInput());

    expect(result.action).toBe("advance");
    expect(result.reason).toBe("task ready");
    expect(result.source).toBe("brain");
    expect(result.targetTaskId).toBe("task-1");
  });

  it("throws when Brain returns HTTP 500", async () => {
    vi.stubEnv("YEET2_BRAIN_BASE_URL", "http://brain-test:9999");

    const mockFetch = makeOkFetch({ error: "internal error" }, 500);
    vi.stubGlobal("fetch", mockFetch);

    await expect(decideWorkflowAction(makeDecideInput())).rejects.toThrow();
  });

  it("throws when fetch times out (AbortError)", async () => {
    vi.stubEnv("YEET2_BRAIN_BASE_URL", "http://brain-test:9999");
    vi.stubEnv("YEET2_BRAIN_PLAN_TIMEOUT_MS", "1");

    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const mockFetch = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", mockFetch);

    await expect(decideWorkflowAction(makeDecideInput())).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createTaskStageBrief URL and payload
// ---------------------------------------------------------------------------

describe("createTaskStageBrief", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls /orchestration/brief", async () => {
    vi.stubEnv("YEET2_BRAIN_BASE_URL", "http://brain-test:9999");

    const mockFetch = makeOkFetch({
      projectId: "proj-abc",
      instructions: "Do the work",
      workingSummary: "In progress",
      handoffTargetRole: null,
      successSignals: ["Done"],
      source: "brain",
    });
    vi.stubGlobal("fetch", mockFetch);

    await createTaskStageBrief(makeStageBriefInput());

    const url = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe("http://brain-test:9999/orchestration/brief");
  });

  it("sends snake_case brief payload fields", async () => {
    vi.stubEnv("YEET2_BRAIN_BASE_URL", "http://brain-test:9999");

    const mockFetch = makeOkFetch({
      projectId: "proj-abc",
      instructions: "Do the work",
      workingSummary: "In progress",
      handoffTargetRole: null,
      successSignals: ["Done"],
      source: "brain",
    });
    vi.stubGlobal("fetch", mockFetch);

    await createTaskStageBrief(makeStageBriefInput());

    const [, init] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body).toMatchObject({
      project_id: "proj-abc",
      project_name: "TestProject",
      mission_id: "mission-1",
      mission_title: "Mission One",
      mission_objective: "Ship the first slice.",
      task_id: "task-1",
      task_title: "Build the API",
      task_description: "Implement the REST endpoints.",
      task_agent_role: "implementer",
      task_priority: 1,
      task_attempts: 0,
      acceptance_criteria: ["Endpoint returns 200", "Latency under 200ms"],
      assigned_role_label: "Senior Engineer",
      assigned_role_goal: "Deliver robust APIs",
      assigned_role_backstory: "Experienced in distributed systems",
    });
  });

  it("parses and returns a valid brief response", async () => {
    vi.stubEnv("YEET2_BRAIN_BASE_URL", "http://brain-test:9999");

    const mockFetch = makeOkFetch({
      projectId: "proj-abc",
      instructions: "Build the REST endpoint following the spec.",
      workingSummary: "First task in mission.",
      handoffTargetRole: "qa",
      successSignals: ["Endpoint returns 200", "Latency under 200ms"],
      source: "brain",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await createTaskStageBrief(makeStageBriefInput());

    expect(result.instructions).toBe("Build the REST endpoint following the spec.");
    expect(result.handoffTargetRole).toBe("qa");
    expect(result.successSignals).toEqual(["Endpoint returns 200", "Latency under 200ms"]);
  });

  it("throws when Brain returns HTTP 500", async () => {
    vi.stubEnv("YEET2_BRAIN_BASE_URL", "http://brain-test:9999");

    const mockFetch = makeOkFetch({ error: "server error" }, 500);
    vi.stubGlobal("fetch", mockFetch);

    await expect(createTaskStageBrief(makeStageBriefInput())).rejects.toThrow();
  });
});
