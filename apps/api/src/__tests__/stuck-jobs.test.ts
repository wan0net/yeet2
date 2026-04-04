import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveStuckJobTimeoutMs } from "../autonomy-loop.js";
import type { ProjectSummary } from "../projects.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// resolveStuckJobTimeoutMs
// ---------------------------------------------------------------------------

describe("resolveStuckJobTimeoutMs", () => {
  it("defaults to 3600000 when env var is absent", () => {
    vi.stubEnv("YEET2_STUCK_JOB_TIMEOUT_MS", "");
    expect(resolveStuckJobTimeoutMs()).toBe(3_600_000);
  });

  it("returns parsed value from env", () => {
    vi.stubEnv("YEET2_STUCK_JOB_TIMEOUT_MS", "7200000");
    expect(resolveStuckJobTimeoutMs()).toBe(7_200_000);
  });

  it("clamps to minimum 60000 for very small values", () => {
    vi.stubEnv("YEET2_STUCK_JOB_TIMEOUT_MS", "1000");
    expect(resolveStuckJobTimeoutMs()).toBe(60_000);
  });

  it("clamps to minimum 60000 for zero", () => {
    vi.stubEnv("YEET2_STUCK_JOB_TIMEOUT_MS", "0");
    expect(resolveStuckJobTimeoutMs()).toBe(60_000);
  });

  it("falls back to default for non-numeric value", () => {
    vi.stubEnv("YEET2_STUCK_JOB_TIMEOUT_MS", "banana");
    expect(resolveStuckJobTimeoutMs()).toBe(3_600_000);
  });

  it("floors fractional values", () => {
    vi.stubEnv("YEET2_STUCK_JOB_TIMEOUT_MS", "120000.9");
    expect(resolveStuckJobTimeoutMs()).toBe(120_000);
  });

  it("respects exact minimum boundary of 60000", () => {
    vi.stubEnv("YEET2_STUCK_JOB_TIMEOUT_MS", "60000");
    expect(resolveStuckJobTimeoutMs()).toBe(60_000);
  });

  it("returns 60000 for values just below minimum", () => {
    vi.stubEnv("YEET2_STUCK_JOB_TIMEOUT_MS", "59999");
    expect(resolveStuckJobTimeoutMs()).toBe(60_000);
  });
});

// ---------------------------------------------------------------------------
// Stuck job detection logic (pure timestamp math)
// ---------------------------------------------------------------------------

/**
 * Build a minimal ProjectSummary with a single job at a specified started time.
 * The shape must satisfy the fields accessed in recoverStuckJobs.
 */
function makeProjectWithJob(opts: {
  jobStatus: string;
  startedAt: string | null;
  missionId?: string;
  taskId?: string;
  jobId?: string;
}): ProjectSummary {
  return {
    id: "proj-stuck",
    name: "Stuck Project",
    repoUrl: "",
    defaultBranch: "main",
    localPath: "/tmp/stuck",
    autonomyMode: "autonomous",
    pullRequestMode: "auto",
    pullRequestDraftMode: "ready",
    mergeApprovalMode: "no_approval",
    activeMissionCount: 1,
    activeTaskCount: 1,
    nextDispatchableTaskId: null,
    nextDispatchableTaskRole: null,
    roleDefinitions: [],
    missions: [
      {
        id: opts.missionId ?? "mission-1",
        title: "Mission 1",
        status: "active",
        startedAt: new Date().toISOString(),
        tasks: [
          {
            id: opts.taskId ?? "task-1",
            title: "Implement feature",
            agentRole: "implementer",
            status: "running",
            priority: 10,
            attempts: 1,
            dispatchable: true,
            blockerReason: null,
            acceptanceCriteria: [],
            jobs: [
              {
                id: opts.jobId ?? "job-1",
                status: opts.jobStatus,
                startedAt: opts.startedAt,
                completedAt: null,
                branchName: "feature/stuck",
                githubPrNumber: null,
                githubPrUrl: null,
                githubPrTitle: null
              }
            ]
          }
        ]
      }
    ]
  } as unknown as ProjectSummary;
}

describe("stuck job detection timestamp math", () => {
  it("identifies a running job started 2 hours ago as stuck (exceeds 1h timeout)", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    const project = makeProjectWithJob({ jobStatus: "running", startedAt: twoHoursAgo });
    const timeoutMs = 3_600_000; // 1 hour default

    const job = project.missions[0].tasks[0].jobs[0];
    const startedAt = job.startedAt ? Date.parse(job.startedAt) : 0;
    const isStuck = startedAt > 0 && Date.now() - startedAt > timeoutMs;

    expect(isStuck).toBe(true);
  });

  it("does not flag a running job started 30 minutes ago as stuck (below 1h timeout)", () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    const project = makeProjectWithJob({ jobStatus: "running", startedAt: thirtyMinutesAgo });
    const timeoutMs = 3_600_000;

    const job = project.missions[0].tasks[0].jobs[0];
    const startedAt = job.startedAt ? Date.parse(job.startedAt) : 0;
    const isStuck = startedAt > 0 && Date.now() - startedAt > timeoutMs;

    expect(isStuck).toBe(false);
  });

  it("does not flag a job with null startedAt as stuck", () => {
    const project = makeProjectWithJob({ jobStatus: "running", startedAt: null });
    const timeoutMs = 3_600_000;

    const job = project.missions[0].tasks[0].jobs[0];
    const startedAt = job.startedAt ? Date.parse(job.startedAt) : 0;
    const isStuck = startedAt > 0 && Date.now() - startedAt > timeoutMs;

    expect(isStuck).toBe(false);
  });

  it("identifies a queued job started 2 hours ago as stuck", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    const project = makeProjectWithJob({ jobStatus: "queued", startedAt: twoHoursAgo });
    const timeoutMs = 3_600_000;

    const job = project.missions[0].tasks[0].jobs[0];
    const isRunningOrQueued = job.status === "running" || job.status === "queued";
    const startedAt = job.startedAt ? Date.parse(job.startedAt) : 0;
    const isStuck = isRunningOrQueued && startedAt > 0 && Date.now() - startedAt > timeoutMs;

    expect(isStuck).toBe(true);
  });

  it("does not flag a complete job started 2 hours ago as stuck", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    const project = makeProjectWithJob({ jobStatus: "complete", startedAt: twoHoursAgo });
    const timeoutMs = 3_600_000;

    const job = project.missions[0].tasks[0].jobs[0];
    const isRunningOrQueued = job.status === "running" || job.status === "queued";
    const startedAt = job.startedAt ? Date.parse(job.startedAt) : 0;
    const isStuck = isRunningOrQueued && startedAt > 0 && Date.now() - startedAt > timeoutMs;

    expect(isStuck).toBe(false);
  });

  it("uses the configured timeout to determine stuck threshold", () => {
    // With a short 2-minute timeout, a job started 3 minutes ago should be stuck
    const threeMinutesAgo = new Date(Date.now() - 3 * 60_000).toISOString();
    const project = makeProjectWithJob({ jobStatus: "running", startedAt: threeMinutesAgo });
    const timeoutMs = 2 * 60_000; // 2 minutes

    const job = project.missions[0].tasks[0].jobs[0];
    const startedAt = job.startedAt ? Date.parse(job.startedAt) : 0;
    const isStuck = startedAt > 0 && Date.now() - startedAt > timeoutMs;

    expect(isStuck).toBe(true);
  });
});
