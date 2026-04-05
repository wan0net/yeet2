import { afterEach, describe, expect, it, vi } from "vitest";

// Mock prisma before importing the module under test
vi.mock("../db.js", () => ({
  prisma: {
    decisionLog: {
      findMany: vi.fn(),
      create: vi.fn()
    }
  }
}));

import { prisma } from "../db.js";
import {
  listGlobalDecisionLogs,
  listProjectDecisionLogs,
  loadRecentDecisionLogs,
  loadRecentOperatorGuidance
} from "../decision-logs.js";

const mockFindMany = vi.mocked(prisma.decisionLog.findMany);

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbLog(overrides: Partial<{
  id: string;
  projectId: string;
  missionId: string | null;
  taskId: string | null;
  jobId: string | null;
  blockerId: string | null;
  kind: string;
  actor: string;
  summary: string;
  detail: unknown;
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "log-1",
    projectId: overrides.projectId ?? "proj-1",
    missionId: overrides.missionId ?? null,
    taskId: overrides.taskId ?? null,
    jobId: overrides.jobId ?? null,
    blockerId: overrides.blockerId ?? null,
    kind: overrides.kind ?? "planning",
    actor: overrides.actor ?? "planner",
    summary: overrides.summary ?? "A decision was made",
    detail: overrides.detail ?? null,
    createdAt: overrides.createdAt ?? new Date("2024-01-01T00:00:00Z")
  };
}

// ---------------------------------------------------------------------------
// loadRecentDecisionLogs
// ---------------------------------------------------------------------------

describe("loadRecentDecisionLogs", () => {
  it("calls findMany with correct projectId and default take", async () => {
    mockFindMany.mockResolvedValue([]);
    await loadRecentDecisionLogs("proj-abc");
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { projectId: "proj-abc" },
      orderBy: { createdAt: "desc" },
      take: 5
    });
  });

  it("respects custom take parameter", async () => {
    mockFindMany.mockResolvedValue([]);
    await loadRecentDecisionLogs("proj-abc", 12);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 12 })
    );
  });

  it("returns mapped summaries", async () => {
    const dbLog = makeDbLog({ id: "log-x", summary: "test summary", projectId: "proj-1" });
    mockFindMany.mockResolvedValue([dbLog] as never);
    const result = await loadRecentDecisionLogs("proj-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("log-x");
    expect(result[0].summary).toBe("test summary");
    expect(result[0].projectId).toBe("proj-1");
    expect(typeof result[0].createdAt).toBe("string");
  });

  it("returns empty array when no logs", async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await loadRecentDecisionLogs("proj-empty");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// listGlobalDecisionLogs
// ---------------------------------------------------------------------------

describe("listGlobalDecisionLogs", () => {
  it("calls findMany with no filters by default", async () => {
    mockFindMany.mockResolvedValue([]);
    await listGlobalDecisionLogs();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { createdAt: "desc" }
      })
    );
  });

  it("applies projectId filter when provided", async () => {
    mockFindMany.mockResolvedValue([]);
    await listGlobalDecisionLogs({ projectId: "proj-42" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: "proj-42" } })
    );
  });

  it("applies kind filter when provided", async () => {
    mockFindMany.mockResolvedValue([]);
    await listGlobalDecisionLogs({ kind: "dispatch" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kind: "dispatch" } })
    );
  });

  it("applies actor filter when provided", async () => {
    mockFindMany.mockResolvedValue([]);
    await listGlobalDecisionLogs({ actor: "planner" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actor: "planner" } })
    );
  });

  it("ignores null/empty filters", async () => {
    mockFindMany.mockResolvedValue([]);
    await listGlobalDecisionLogs({ projectId: null, kind: "  ", actor: null });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it("filters results by search term in summary", async () => {
    const logs = [
      makeDbLog({ id: "a", summary: "deployment decision" }),
      makeDbLog({ id: "b", summary: "unrelated record" })
    ];
    mockFindMany.mockResolvedValue(logs as never);
    const result = await listGlobalDecisionLogs({ search: "deployment" });
    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("filters results by search term in actor", async () => {
    const logs = [
      makeDbLog({ id: "a", actor: "architect", summary: "some plan" }),
      makeDbLog({ id: "b", actor: "planner", summary: "other" })
    ];
    mockFindMany.mockResolvedValue(logs as never);
    const result = await listGlobalDecisionLogs({ search: "architect" });
    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("search is case-insensitive", async () => {
    const logs = [
      makeDbLog({ id: "a", summary: "Deployment Decision" })
    ];
    mockFindMany.mockResolvedValue(logs as never);
    const result = await listGlobalDecisionLogs({ search: "deployment" });
    expect(result).toHaveLength(1);
  });

  it("returns all results when search is empty string", async () => {
    const logs = [makeDbLog({ id: "a" }), makeDbLog({ id: "b" })];
    mockFindMany.mockResolvedValue(logs as never);
    const result = await listGlobalDecisionLogs({ search: "" });
    expect(result).toHaveLength(2);
  });

  it("respects take limit and clamps to 1-200 range", async () => {
    mockFindMany.mockResolvedValue([]);
    await listGlobalDecisionLogs({ take: 0 });
    // take is clamped to min 1, so findMany should be called with take = 1*4
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 4 })
    );
  });

  it("clamps take at maximum 200", async () => {
    mockFindMany.mockResolvedValue([]);
    await listGlobalDecisionLogs({ take: 9999 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 800 }) // 200 * 4
    );
  });

  it("maps DB logs to summaries with ISO createdAt", async () => {
    const dbLog = makeDbLog({ id: "mapped-1", createdAt: new Date("2024-06-15T12:00:00Z") });
    mockFindMany.mockResolvedValue([dbLog] as never);
    const result = await listGlobalDecisionLogs();
    expect(result[0].createdAt).toBe("2024-06-15T12:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// listProjectDecisionLogs
// ---------------------------------------------------------------------------

describe("listProjectDecisionLogs", () => {
  it("calls findMany with projectId filter", async () => {
    mockFindMany.mockResolvedValue([]);
    await listProjectDecisionLogs("proj-99");
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ projectId: "proj-99" }) })
    );
  });

  it("applies kind filter to where clause", async () => {
    mockFindMany.mockResolvedValue([]);
    await listProjectDecisionLogs("proj-1", { kind: "approval" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ kind: "approval" }) })
    );
  });

  it("filters by mention in detail", async () => {
    const logs = [
      makeDbLog({ id: "a", detail: { mentions: ["architect", "coder"] } }),
      makeDbLog({ id: "b", detail: { mentions: ["planner"] } }),
      makeDbLog({ id: "c", detail: null })
    ];
    mockFindMany.mockResolvedValue(logs as never);
    const result = await listProjectDecisionLogs("proj-1", { mention: "architect" });
    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("filters by replyToId in detail", async () => {
    const logs = [
      makeDbLog({ id: "a", detail: { replyToId: "parent-log-1" } }),
      makeDbLog({ id: "b", detail: { replyToId: "other-id" } }),
      makeDbLog({ id: "c", detail: null })
    ];
    mockFindMany.mockResolvedValue(logs as never);
    const result = await listProjectDecisionLogs("proj-1", { replyToId: "parent-log-1" });
    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("returns empty array when no logs", async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await listProjectDecisionLogs("proj-x");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// loadRecentOperatorGuidance
// ---------------------------------------------------------------------------

describe("loadRecentOperatorGuidance", () => {
  it("queries for operator messages only", async () => {
    mockFindMany.mockResolvedValue([]);
    await loadRecentOperatorGuidance("proj-1");
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "proj-1", kind: "message", actor: "operator" }
      })
    );
  });

  it("filters out logs where actor is not operator", async () => {
    // Even if DB returned a non-operator log (shouldn't happen due to DB where), the mapper filters it
    const logs = [
      makeDbLog({ id: "a", kind: "message", actor: "planner", summary: "hey" })
    ];
    mockFindMany.mockResolvedValue(logs as never);
    const result = await loadRecentOperatorGuidance("proj-1");
    expect(result).toHaveLength(0);
  });

  it("maps valid operator messages to OperatorGuidanceSummary", async () => {
    const logs = [
      makeDbLog({
        id: "guid-1",
        kind: "message",
        actor: "operator",
        summary: "Please focus on tests",
        detail: { mentions: ["tester"], replyToId: null }
      })
    ];
    mockFindMany.mockResolvedValue(logs as never);
    const result = await loadRecentOperatorGuidance("proj-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("guid-1");
    expect(result[0].content).toBe("Please focus on tests");
    expect(result[0].mentions).toEqual(["tester"]);
    expect(result[0].replyToId).toBeNull();
  });

  it("excludes logs with non-operator source in detail", async () => {
    const logs = [
      makeDbLog({ id: "a", kind: "message", actor: "operator", summary: "hi", detail: { source: "agent" } })
    ];
    mockFindMany.mockResolvedValue(logs as never);
    const result = await loadRecentOperatorGuidance("proj-1");
    // source is "agent" not "operator", should be excluded
    expect(result).toHaveLength(0);
  });

  it("includes logs with source set to operator", async () => {
    const logs = [
      makeDbLog({ id: "b", kind: "message", actor: "operator", summary: "steer now", detail: { source: "operator" } })
    ];
    mockFindMany.mockResolvedValue(logs as never);
    const result = await loadRecentOperatorGuidance("proj-1");
    expect(result).toHaveLength(1);
  });
});
