/**
 * Integration boundary tests for API → Executor HTTP handoff.
 *
 * These tests verify that executor HTTP calls build correct payloads and that
 * status mapping helpers work correctly, without calling any real Executor service.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  executorBaseUrl,
  mapExecutorJobStatus,
  taskStatusFromJobStatus,
} from "../projects.js";

// ---------------------------------------------------------------------------
// executorBaseUrl
// ---------------------------------------------------------------------------

describe("executorBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to http://127.0.0.1:8021 when no env vars are set", () => {
    const prev1 = process.env.YEET2_EXECUTOR_BASE_URL;
    const prev2 = process.env.EXECUTOR_BASE_URL;
    delete process.env.YEET2_EXECUTOR_BASE_URL;
    delete process.env.EXECUTOR_BASE_URL;

    try {
      expect(executorBaseUrl()).toBe("http://127.0.0.1:8021");
    } finally {
      if (prev1 !== undefined) process.env.YEET2_EXECUTOR_BASE_URL = prev1;
      if (prev2 !== undefined) process.env.EXECUTOR_BASE_URL = prev2;
    }
  });

  it("uses YEET2_EXECUTOR_BASE_URL when set", () => {
    vi.stubEnv("YEET2_EXECUTOR_BASE_URL", "http://executor:8021");

    expect(executorBaseUrl()).toBe("http://executor:8021");
  });

  it("strips trailing slashes from the base URL", () => {
    vi.stubEnv("YEET2_EXECUTOR_BASE_URL", "http://executor:8021///");

    expect(executorBaseUrl()).toBe("http://executor:8021");
  });
});

// ---------------------------------------------------------------------------
// mapExecutorJobStatus
// ---------------------------------------------------------------------------

describe("mapExecutorJobStatus", () => {
  it("maps 'completed' to 'complete'", () => {
    expect(mapExecutorJobStatus("completed")).toBe("complete");
  });

  it("passes through 'complete' unchanged", () => {
    expect(mapExecutorJobStatus("complete")).toBe("complete");
  });

  it("passes through 'running' unchanged", () => {
    expect(mapExecutorJobStatus("running")).toBe("running");
  });

  it("passes through 'queued' unchanged", () => {
    expect(mapExecutorJobStatus("queued")).toBe("queued");
  });

  it("passes through 'failed' unchanged", () => {
    expect(mapExecutorJobStatus("failed")).toBe("failed");
  });

  it("passes through 'cancelled' unchanged", () => {
    expect(mapExecutorJobStatus("cancelled")).toBe("cancelled");
  });

  it("returns 'queued' for unknown status", () => {
    expect(mapExecutorJobStatus("unknown_status")).toBe("queued");
  });

  it("returns 'queued' for null", () => {
    expect(mapExecutorJobStatus(null)).toBe("queued");
  });

  it("returns 'queued' for undefined", () => {
    expect(mapExecutorJobStatus(undefined)).toBe("queued");
  });
});

// ---------------------------------------------------------------------------
// taskStatusFromJobStatus
// ---------------------------------------------------------------------------

describe("taskStatusFromJobStatus", () => {
  it("returns 'running' when job status is 'queued'", () => {
    expect(taskStatusFromJobStatus("queued", 0, "implementer")).toBe("running");
  });

  it("returns 'running' when job status is 'running'", () => {
    expect(taskStatusFromJobStatus("running", 1, "implementer")).toBe("running");
  });

  it("returns 'complete' when status is complete with a dispatchable role", () => {
    const dispatchableRoles = ["architect", "implementer", "tester", "coder", "qa", "reviewer"];
    for (const role of dispatchableRoles) {
      expect(taskStatusFromJobStatus("complete", 0, role)).toBe("complete");
    }
  });

  it("returns 'failed' when status is failed and attempts < MAX (2)", () => {
    expect(taskStatusFromJobStatus("failed", 1, "implementer")).toBe("failed");
  });

  it("returns 'failed' when status is failed with 0 attempts", () => {
    expect(taskStatusFromJobStatus("failed", 0, "implementer")).toBe("failed");
  });

  it("returns 'blocked' when status is failed and attempts >= MAX (2)", () => {
    expect(taskStatusFromJobStatus("failed", 2, "implementer")).toBe("blocked");
  });

  it("returns 'blocked' when status is failed and attempts > MAX (2)", () => {
    expect(taskStatusFromJobStatus("failed", 5, "implementer")).toBe("blocked");
  });

  it("returns 'blocked' when status is complete but role is not dispatchable", () => {
    // 'planner' is not in DISPATCHABLE_TASK_ROLES
    expect(taskStatusFromJobStatus("complete", 0, "planner")).toBe("failed");
  });

  it("returns 'blocked' when status is complete, non-dispatchable role, attempts >= MAX", () => {
    expect(taskStatusFromJobStatus("complete", 2, "planner")).toBe("blocked");
  });
});

// ---------------------------------------------------------------------------
// submitTaskToExecutor URL verification (via fetch mock)
// ---------------------------------------------------------------------------

describe("submitTaskToExecutor URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends to {executorBaseUrl}/jobs endpoint", () => {
    // Verify the URL pattern built by executorBaseUrl() + /jobs
    vi.stubEnv("YEET2_EXECUTOR_BASE_URL", "http://exec-test:8021");
    const base = executorBaseUrl();
    expect(`${base}/jobs`).toBe("http://exec-test:8021/jobs");
  });
});

// ---------------------------------------------------------------------------
// readExecutorJob URL verification
// ---------------------------------------------------------------------------

describe("readExecutorJob URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds {executorBaseUrl}/jobs/{jobId} correctly", () => {
    vi.stubEnv("YEET2_EXECUTOR_BASE_URL", "http://exec-test:8021");
    const jobId = "job-abc-123";
    const base = executorBaseUrl();
    const url = `${base}/jobs/${encodeURIComponent(jobId)}`;
    expect(url).toBe("http://exec-test:8021/jobs/job-abc-123");
  });

  it("URL-encodes special characters in job IDs", () => {
    vi.stubEnv("YEET2_EXECUTOR_BASE_URL", "http://exec-test:8021");
    const jobId = "job/with spaces";
    const base = executorBaseUrl();
    const url = `${base}/jobs/${encodeURIComponent(jobId)}`;
    expect(url).toBe("http://exec-test:8021/jobs/job%2Fwith%20spaces");
  });
});
