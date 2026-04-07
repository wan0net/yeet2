import { describe, expect, it } from "vitest";

import { ProjectJobRefreshError, validateExecutorJobRecord } from "../projects.js";

// These tests lock down validateExecutorJobRecord so that future refactors
// can't silently re-introduce the `as ExecutorJobRecord` cast that used to
// let malformed executor responses propagate undefined fields into
// downstream dispatch / refresh code.

function base() {
  return {
    id: "job-1",
    task_id: "task-1",
    executor_type: "openhands",
    status: "running",
    workspace_path: "/tmp/ws",
    branch_name: "feat/x"
  };
}

describe("validateExecutorJobRecord", () => {
  it("accepts a complete valid record", () => {
    const record = validateExecutorJobRecord(
      {
        ...base(),
        worker_id: "w-1",
        log_path: "/tmp/log.txt",
        artifact_summary: "all good",
        started_at: "2026-04-07T00:00:00Z",
        completed_at: null,
        payload: { foo: "bar" }
      },
      "job-1"
    );
    expect(record.id).toBe("job-1");
    expect(record.worker_id).toBe("w-1");
    expect(record.log_path).toBe("/tmp/log.txt");
    expect(record.payload).toEqual({ foo: "bar" });
    expect(record.completed_at).toBeNull();
  });

  it("accepts a minimal valid record with optional fields absent", () => {
    const record = validateExecutorJobRecord(base(), "job-1");
    expect(record.id).toBe("job-1");
    expect(record.worker_id).toBeNull();
    expect(record.log_path).toBeNull();
    expect(record.payload).toBeNull();
  });

  it("rejects null input", () => {
    expect(() => validateExecutorJobRecord(null, "job-1")).toThrow(ProjectJobRefreshError);
  });

  it("rejects a non-object input", () => {
    expect(() => validateExecutorJobRecord("string", "job-1")).toThrow(ProjectJobRefreshError);
  });

  it("rejects when id is missing", () => {
    const { id: _id, ...rest } = base();
    expect(() => validateExecutorJobRecord(rest, "job-1")).toThrow(/missing required field 'id'/);
  });

  it("rejects when id is the wrong type", () => {
    expect(() => validateExecutorJobRecord({ ...base(), id: 123 }, "job-1")).toThrow(
      /missing required field 'id'/
    );
  });

  it("rejects when task_id is empty string", () => {
    expect(() => validateExecutorJobRecord({ ...base(), task_id: "   " }, "job-1")).toThrow(
      /missing required field 'task_id'/
    );
  });

  it("rejects when status is missing", () => {
    const { status: _status, ...rest } = base();
    expect(() => validateExecutorJobRecord(rest, "job-1")).toThrow(/missing required field 'status'/);
  });

  it("rejects when optional string field has wrong type", () => {
    expect(() => validateExecutorJobRecord({ ...base(), log_path: 123 }, "job-1")).toThrow(
      /wrong type for 'log_path'/
    );
  });

  it("rejects when payload is not an object", () => {
    expect(() => validateExecutorJobRecord({ ...base(), payload: "not an object" }, "job-1")).toThrow(
      /wrong type for 'payload'/
    );
  });

  it("accepts explicit null for optional fields", () => {
    const record = validateExecutorJobRecord(
      {
        ...base(),
        worker_id: null,
        log_path: null,
        artifact_summary: null,
        started_at: null,
        completed_at: null,
        payload: null
      },
      "job-1"
    );
    expect(record.worker_id).toBeNull();
    expect(record.log_path).toBeNull();
    expect(record.payload).toBeNull();
  });

  it("thrown errors use executor_invalid_response code and 502 status", () => {
    try {
      validateExecutorJobRecord({}, "job-1");
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectJobRefreshError);
      const err = error as ProjectJobRefreshError;
      expect(err.code).toBe("executor_invalid_response");
      expect(err.statusCode).toBe(502);
    }
  });
});
