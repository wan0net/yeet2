import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workerRecord = {
  id: "worker-1",
  name: "Worker One",
  executorType: "local",
  status: "busy" as const,
  capabilities: ["local"],
  lastHeartbeatAt: new Date("2026-04-10T00:00:00Z"),
  leaseExpiresAt: null as Date | null,
  currentJobId: "job-1" as string | null,
  host: "host-1",
  endpoint: null as string | null,
  createdAt: new Date("2026-04-10T00:00:00Z"),
  updatedAt: new Date("2026-04-10T00:00:00Z")
};

vi.mock("../db", () => ({
  prisma: {
    worker: {
      findUnique: vi.fn(async () => ({ ...workerRecord })),
      upsert: vi.fn(async ({ update }: { update: Record<string, unknown> }) => ({
        ...workerRecord,
        ...update,
        updatedAt: new Date("2026-04-10T00:01:00Z")
      }))
    },
    job: {
      findUnique: vi.fn(async () => null)
    }
  }
}));

import { prisma } from "../db";
import { heartbeatWorker } from "../workers";

describe("heartbeatWorker", () => {
  beforeEach(() => {
    workerRecord.currentJobId = "job-1";
    workerRecord.status = "busy";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("clears currentJobId when the heartbeat explicitly sends null", async () => {
    const result = await heartbeatWorker("worker-1", {
      currentJobId: null,
      status: "online"
    });

    expect(prisma.worker.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          currentJobId: null,
          status: "online"
        })
      })
    );
    expect(result.currentJobId).toBeNull();
    expect(result.available).toBe(true);
  });

  it("preserves currentJobId when the heartbeat omits the field", async () => {
    const result = await heartbeatWorker("worker-1", {
      status: "busy"
    });

    expect(prisma.worker.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          currentJobId: "job-1",
          status: "busy"
        })
      })
    );
    expect(result.currentJobId).toBe("job-1");
  });
});
