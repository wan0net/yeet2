import { describe, expect, it, vi } from "vitest";

import { HermesClientError, createHermesClient } from "../hermes";

describe("createHermesClient", () => {
  it("adds the bearer token and parses JSON responses", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:3001/integrations/hermes/stats");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer hermes-secret");

      return new Response(
        JSON.stringify({
          generatedAt: "2026-04-24T00:00:00.000Z",
          auth: {
            api: { enabled: true, requireAuthForReads: false, mode: "write_protected" },
            hermes: { enabled: true }
          },
          overview: {
            generatedAt: "2026-04-24T00:00:00.000Z",
            auth: { enabled: true, requireAuthForReads: false, mode: "write_protected" },
            totals: {
              projects: 1,
              activeMissions: 0,
              activeTasks: 0,
              openBlockers: 0,
              openApprovals: 0,
              runningJobs: 0,
              queuedJobs: 0,
              failedJobs: 0
            },
            workers: {
              generatedAt: "2026-04-24T00:00:00.000Z",
              totalWorkers: 0,
              healthyWorkers: 0,
              staleWorkers: 0,
              offlineWorkers: 0,
              activeLeases: 0,
              idleWorkers: 0,
              busyWorkers: 0,
              workers: []
            }
          },
          projects: {
            total: 1,
            byAutonomyMode: { manual: 1 },
            byConstitutionStatus: { pending: 1 }
          }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    });

    const client = createHermesClient({
      baseUrl: "http://127.0.0.1:3001/",
      bearerToken: "hermes-secret",
      fetch: fetchMock as typeof fetch
    });

    const stats = await client.getStats();
    expect(stats.projects.total).toBe(1);
  });

  it("posts trigger payloads to the trigger endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
      expect(init?.body).toBe(JSON.stringify({ content: "Ship it", actor: "hermes-agent" }));

      return new Response(
        JSON.stringify({
          project: {
            project: {
              id: "project-1",
              name: "Example",
              defaultBranch: "main",
              localPath: "/tmp/repo",
              constitutionStatus: "pending",
              status: "active",
              createdAt: "2026-04-24T00:00:00.000Z",
              updatedAt: "2026-04-24T00:00:00.000Z"
            },
            constitution: {
              status: "pending",
              files: {
                vision: { key: "vision", path: "VISION.md", exists: false },
                spec: { key: "spec", path: "SPEC.md", exists: false },
                roadmap: { key: "roadmap", path: "ROADMAP.md", exists: false },
                architecture: { key: "architecture", path: "ARCHITECTURE.md", exists: false },
                decisions: { key: "decisions", path: "DECISIONS.md", exists: false },
                qualityBar: { key: "qualityBar", path: "QUALITY_BAR.md", exists: false }
              },
              inspectedAt: "2026-04-24T00:00:00.000Z"
            },
            decisionLogs: [],
            activeMissionCount: 0,
            activeTaskCount: 0,
            blockerCount: 0
          },
          telemetry: {
            projectId: "project-1",
            mode: "manual",
            lastRunAt: "2026-04-24T00:00:00.000Z",
            lastAction: "skip",
            lastOutcome: "skipped",
            lastMissionId: null,
            lastTaskId: null,
            nextDispatchableTaskId: null,
            nextDispatchableTaskRole: null,
            activeMissionCount: 0,
            activeTaskCount: 0,
            message: "Autonomy mode is manual"
          }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    });

    const client = createHermesClient({
      baseUrl: "http://127.0.0.1:3001",
      fetch: fetchMock as typeof fetch
    });

    const result = await client.triggerProject("project-1", { content: "Ship it", actor: "hermes-agent" });
    expect(result.telemetry.projectId).toBe("project-1");
  });

  it("throws HermesClientError with server details on non-2xx responses", async () => {
    const client = createHermesClient({
      baseUrl: "http://127.0.0.1:3001",
      fetch: (async () =>
        new Response(JSON.stringify({ error: "unauthorized", message: "Nope" }), {
          status: 401,
          headers: { "content-type": "application/json" }
        })) as typeof fetch
    });

    await expect(client.getStats()).rejects.toMatchObject({
      name: "HermesClientError",
      status: 401,
      code: "unauthorized",
      message: "Nope"
    });
  });
});
