import { afterEach, describe, expect, it, vi } from "vitest";

import {
  hasRemainingDispatchableTasks,
  resolveAutonomyLoopEnabled,
  resolveAutonomyLoopIntervalMs
} from "../autonomy-loop.js";
import type { ProjectSummary } from "../projects.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// resolveAutonomyLoopEnabled
// ---------------------------------------------------------------------------

describe("resolveAutonomyLoopEnabled", () => {
  it("defaults to true when env var is absent", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_ENABLED", "");
    expect(resolveAutonomyLoopEnabled()).toBe(true);
  });

  it("returns false when env var is 'false'", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_ENABLED", "false");
    expect(resolveAutonomyLoopEnabled()).toBe(false);
  });

  it("returns false when env var is '0'", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_ENABLED", "0");
    expect(resolveAutonomyLoopEnabled()).toBe(false);
  });

  it("returns false when env var is 'no'", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_ENABLED", "no");
    expect(resolveAutonomyLoopEnabled()).toBe(false);
  });

  it("returns false when env var is 'off'", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_ENABLED", "off");
    expect(resolveAutonomyLoopEnabled()).toBe(false);
  });

  it("returns true when env var is '1'", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_ENABLED", "1");
    expect(resolveAutonomyLoopEnabled()).toBe(true);
  });

  it("returns true when env var is 'true'", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_ENABLED", "true");
    expect(resolveAutonomyLoopEnabled()).toBe(true);
  });

  it("returns true when env var is 'yes'", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_ENABLED", "yes");
    expect(resolveAutonomyLoopEnabled()).toBe(true);
  });

  it("returns true when env var is 'on'", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_ENABLED", "on");
    expect(resolveAutonomyLoopEnabled()).toBe(true);
  });

  it("returns true (default) for unrecognised value", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_ENABLED", "maybe");
    expect(resolveAutonomyLoopEnabled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveAutonomyLoopIntervalMs
// ---------------------------------------------------------------------------

describe("resolveAutonomyLoopIntervalMs", () => {
  it("defaults to 60000 when env var is absent", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_INTERVAL_MS", "");
    expect(resolveAutonomyLoopIntervalMs()).toBe(60_000);
  });

  it("returns the parsed value when env var is set", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_INTERVAL_MS", "30000");
    expect(resolveAutonomyLoopIntervalMs()).toBe(30_000);
  });

  it("clamps to minimum of 5000 for very small values", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_INTERVAL_MS", "1000");
    expect(resolveAutonomyLoopIntervalMs()).toBe(5_000);
  });

  it("clamps to minimum of 5000 for zero", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_INTERVAL_MS", "0");
    expect(resolveAutonomyLoopIntervalMs()).toBe(5_000);
  });

  it("falls back to 60000 for non-numeric value", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_INTERVAL_MS", "banana");
    expect(resolveAutonomyLoopIntervalMs()).toBe(60_000);
  });

  it("floors fractional values", () => {
    vi.stubEnv("YEET2_AUTONOMY_LOOP_INTERVAL_MS", "10500.9");
    expect(resolveAutonomyLoopIntervalMs()).toBe(10_500);
  });
});

// ---------------------------------------------------------------------------
// hasRemainingDispatchableTasks
// ---------------------------------------------------------------------------

function makeProject(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: "proj-1",
    name: "Test Project",
    repoUrl: "",
    defaultBranch: "main",
    localPath: "/tmp/proj",
    autonomyMode: "autonomous",
    pullRequestMode: "auto",
    pullRequestDraftMode: "ready",
    mergeApprovalMode: "no_approval",
    activeMissionCount: 0,
    activeTaskCount: 0,
    nextDispatchableTaskId: null,
    nextDispatchableTaskRole: null,
    roleDefinitions: [],
    missions: [],
    ...overrides
  } as unknown as ProjectSummary;
}

function makeTask(role: string, status: string) {
  return {
    id: `task-${role}-${status}`,
    title: `${role} task`,
    agentRole: role,
    status,
    priority: 1,
    attempts: 0,
    dispatchable: true,
    jobs: [],
    blockerReason: null,
    acceptanceCriteria: []
  };
}

describe("hasRemainingDispatchableTasks", () => {
  it("returns false for a project with no missions", () => {
    const project = makeProject({ missions: [] });
    expect(hasRemainingDispatchableTasks(project)).toBe(false);
  });

  it("returns false when all dispatchable tasks are complete", () => {
    const project = makeProject({
      missions: [
        {
          id: "m1",
          title: "Mission 1",
          status: "active",
          startedAt: new Date().toISOString(),
          tasks: [
            makeTask("implementer", "complete"),
            makeTask("qa", "complete")
          ]
        }
      ]
    } as unknown as Partial<ProjectSummary>);
    expect(hasRemainingDispatchableTasks(project)).toBe(false);
  });

  it("returns true when an implementer task is ready", () => {
    const project = makeProject({
      missions: [
        {
          id: "m1",
          title: "Mission 1",
          status: "active",
          startedAt: new Date().toISOString(),
          tasks: [makeTask("implementer", "ready")]
        }
      ]
    } as unknown as Partial<ProjectSummary>);
    expect(hasRemainingDispatchableTasks(project)).toBe(true);
  });

  it("returns true when a qa task is pending", () => {
    const project = makeProject({
      missions: [
        {
          id: "m1",
          title: "Mission 1",
          status: "active",
          startedAt: new Date().toISOString(),
          tasks: [makeTask("qa", "pending")]
        }
      ]
    } as unknown as Partial<ProjectSummary>);
    expect(hasRemainingDispatchableTasks(project)).toBe(true);
  });

  it("returns true when a reviewer task is ready", () => {
    const project = makeProject({
      missions: [
        {
          id: "m1",
          title: "Mission 1",
          status: "active",
          startedAt: new Date().toISOString(),
          tasks: [makeTask("reviewer", "ready")]
        }
      ]
    } as unknown as Partial<ProjectSummary>);
    expect(hasRemainingDispatchableTasks(project)).toBe(true);
  });

  it("returns true when an architect task is ready", () => {
    const project = makeProject({
      missions: [
        {
          id: "m1",
          title: "Mission 1",
          status: "active",
          startedAt: new Date().toISOString(),
          tasks: [makeTask("architect", "ready")]
        }
      ]
    } as unknown as Partial<ProjectSummary>);
    expect(hasRemainingDispatchableTasks(project)).toBe(true);
  });

  it("returns true when a tester task is pending", () => {
    const project = makeProject({
      missions: [
        {
          id: "m1",
          title: "Mission 1",
          status: "active",
          startedAt: new Date().toISOString(),
          tasks: [makeTask("tester", "pending")]
        }
      ]
    } as unknown as Partial<ProjectSummary>);
    expect(hasRemainingDispatchableTasks(project)).toBe(true);
  });

  it("returns true when a planner task is ready", () => {
    const project = makeProject({
      missions: [
        {
          id: "m1",
          title: "Mission 1",
          status: "active",
          startedAt: new Date().toISOString(),
          tasks: [makeTask("planner", "ready")]
        }
      ]
    } as unknown as Partial<ProjectSummary>);
    expect(hasRemainingDispatchableTasks(project)).toBe(true);
  });
});
