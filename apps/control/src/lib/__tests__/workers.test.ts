import { describe, it, expect } from "vitest";
import { normalizeWorkerRecord, normalizeWorkerList, workerStatusLabel, workerStatusTone } from "$lib/workers";

// ─── normalizeWorkerRecord ────────────────────────────────────────────────────

describe("normalizeWorkerRecord", () => {
  it("returns null for null input", () => {
    expect(normalizeWorkerRecord(null)).toBeNull();
  });

  it("returns null for an empty object with no id, name, or status", () => {
    expect(normalizeWorkerRecord({})).toBeNull();
  });

  it("normalizes a minimal record with id and status", () => {
    const result = normalizeWorkerRecord({ id: "w1", status: "idle" });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("w1");
    expect(result!.status).toBe("idle");
  });

  it("maps snake_case worker_id to id (worker_id takes priority over name for id)", () => {
    const result = normalizeWorkerRecord({ worker_id: "w-snake", name: "Snake" });
    expect(result!.id).toBe("w-snake"); // worker_id is checked before name in the id lookup
    expect(result!.name).toBe("Snake"); // name field is used for the display name
  });

  it("normalizes capabilities from an array of strings", () => {
    const result = normalizeWorkerRecord({ id: "w1", status: "busy", capabilities: ["python", "node"] });
    expect(result!.capabilities).toEqual(["node", "python"]); // sorted alphabetically
  });

  it("normalizes capabilities from an array of objects", () => {
    const result = normalizeWorkerRecord({
      id: "w1",
      status: "idle",
      capabilities: [{ name: "python" }, { label: "node" }],
    });
    expect(result!.capabilities).toContain("python");
    expect(result!.capabilities).toContain("node");
  });

  it("deduplicates capabilities", () => {
    const result = normalizeWorkerRecord({ id: "w1", status: "idle", capabilities: ["python", "python"] });
    expect(result!.capabilities).toHaveLength(1);
  });

  it("sets kind to null when not provided", () => {
    const result = normalizeWorkerRecord({ id: "w1", status: "idle" });
    expect(result!.kind).toBeNull();
  });

  it("picks up kind from the kind field", () => {
    const result = normalizeWorkerRecord({ id: "w1", status: "idle", kind: "docker" });
    expect(result!.kind).toBe("docker");
  });

  it("normalizes lease info when present", () => {
    const result = normalizeWorkerRecord({
      id: "w1",
      status: "busy",
      lease: { projectId: "p1", jobId: "j1", acquiredAt: "2024-01-01T00:00:00Z" },
    });
    expect(result!.lease).not.toBeNull();
    expect(result!.lease!.projectId).toBe("p1");
  });

  it("sets lease to null when lease object has no meaningful values", () => {
    const result = normalizeWorkerRecord({ id: "w1", status: "idle", lease: {} });
    expect(result!.lease).toBeNull();
  });

  it("normalizes snake_case lastHeartbeatAt", () => {
    const result = normalizeWorkerRecord({ id: "w1", status: "idle", last_heartbeat_at: "2024-06-01T00:00:00Z" });
    expect(result!.lastHeartbeatAt).toBe("2024-06-01T00:00:00Z");
  });

  it("picks up currentJobId from lease.jobId as fallback", () => {
    const result = normalizeWorkerRecord({
      id: "w1",
      status: "busy",
      lease: { jobId: "j-lease", acquiredAt: "2024-01-01T00:00:00Z" },
    });
    expect(result!.currentJobId).toBe("j-lease");
  });
});

// ─── normalizeWorkerList ──────────────────────────────────────────────────────

describe("normalizeWorkerList", () => {
  it("returns empty array for null input", () => {
    expect(normalizeWorkerList(null)).toEqual([]);
  });

  it("returns empty array for empty array input", () => {
    expect(normalizeWorkerList([])).toEqual([]);
  });

  it("normalizes an array of raw worker objects", () => {
    const result = normalizeWorkerList([
      { id: "w1", status: "idle" },
      { id: "w2", status: "busy" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("w1");
  });

  it("normalizes from a { workers: [] } envelope", () => {
    const result = normalizeWorkerList({ workers: [{ id: "w1", status: "idle" }] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("w1");
  });

  it("normalizes from a { items: [] } envelope", () => {
    const result = normalizeWorkerList({ items: [{ id: "w1", status: "idle" }] });
    expect(result).toHaveLength(1);
  });

  it("normalizes from a { data: [] } envelope", () => {
    const result = normalizeWorkerList({ data: [{ id: "w1", status: "idle" }] });
    expect(result).toHaveLength(1);
  });

  it("filters out entries that fail normalization", () => {
    const result = normalizeWorkerList([{ id: "w1", status: "idle" }, {}]);
    expect(result).toHaveLength(1);
  });
});

// ─── workerStatusLabel ────────────────────────────────────────────────────────

describe("workerStatusLabel", () => {
  it("returns 'Idle' for idle", () => {
    expect(workerStatusLabel("idle")).toBe("Idle");
  });

  it("returns 'Idle' for available", () => {
    expect(workerStatusLabel("available")).toBe("Idle");
  });

  it("returns 'Busy' for busy", () => {
    expect(workerStatusLabel("busy")).toBe("Busy");
  });

  it("returns 'Busy' for working", () => {
    expect(workerStatusLabel("working")).toBe("Busy");
  });

  it("returns 'Busy' for leased", () => {
    expect(workerStatusLabel("leased")).toBe("Busy");
  });

  it("returns 'Offline' for offline", () => {
    expect(workerStatusLabel("offline")).toBe("Offline");
  });

  it("returns 'Offline' for stopped", () => {
    expect(workerStatusLabel("stopped")).toBe("Offline");
  });

  it("returns 'Error' for error", () => {
    expect(workerStatusLabel("error")).toBe("Error");
  });

  it("returns 'Error' for failed", () => {
    expect(workerStatusLabel("failed")).toBe("Error");
  });

  it("returns 'Unknown' for unrecognized status", () => {
    expect(workerStatusLabel("something-else")).toBe("Unknown");
  });
});

// ─── workerStatusTone ─────────────────────────────────────────────────────────

describe("workerStatusTone", () => {
  it("returns slate for idle", () => {
    expect(workerStatusTone("idle")).toContain("slate");
  });

  it("returns sky for busy", () => {
    expect(workerStatusTone("busy")).toContain("sky");
  });

  it("returns sky for running", () => {
    expect(workerStatusTone("running")).toContain("sky");
  });

  it("returns amber for offline", () => {
    expect(workerStatusTone("offline")).toContain("amber");
  });

  it("returns rose for error", () => {
    expect(workerStatusTone("error")).toContain("rose");
  });

  it("returns slate for unknown status", () => {
    expect(workerStatusTone("whatever")).toContain("slate");
  });
});
