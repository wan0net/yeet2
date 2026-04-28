const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://localhost/yeet2_test";
process.env.DATABASE_URL = TEST_DB_URL;

const TEST_API_KEY = process.env.YEET2_API_BEARER_TOKEN ?? "test-api-key";
process.env.YEET2_API_BEARER_TOKEN = TEST_API_KEY;

const TEST_HERMES_KEY = process.env.YEET2_HERMES_BEARER_TOKEN ?? "test-hermes-key";
process.env.YEET2_HERMES_BEARER_TOKEN = TEST_HERMES_KEY;

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../server";
import { setupTestDatabase, truncateAllTables } from "./setup";

const API_AUTH_HEADER = `Bearer ${TEST_API_KEY}`;
const HERMES_AUTH_HEADER = `Bearer ${TEST_HERMES_KEY}`;

let app: FastifyInstance;

setupTestDatabase();

beforeAll(async () => {
  app = await createApp({ startLoop: false });
  await app.ready();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

const prisma = truncateAllTables();

async function registerTestProject(overrides: Record<string, unknown> = {}) {
  const body = {
    name: "Hermes Project",
    localPath: "/tmp/yeet2-test-repo",
    defaultBranch: "main",
    ...overrides
  };

  return app.inject({
    method: "POST",
    url: "/projects",
    headers: {
      "content-type": "application/json",
      authorization: API_AUTH_HEADER
    },
    payload: JSON.stringify(body)
  });
}

describe("GET /integrations/hermes/stats", () => {
  it("requires a bearer token when Hermes auth is configured", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/integrations/hermes/stats"
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "unauthorized" });
  });

  it("returns overview data with the Hermes bearer token", async () => {
    await registerTestProject({ name: "Stats Project" });

    const res = await app.inject({
      method: "GET",
      url: "/integrations/hermes/stats",
      headers: {
        authorization: HERMES_AUTH_HEADER
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      auth: {
        hermes: {
          enabled: true
        }
      },
      overview: {
        totals: {
          projects: 1
        }
      },
      projects: {
        total: 1,
        byAutonomyMode: {
          manual: 1
        }
      }
    });
  });
});

describe("GET /integrations/hermes/projects", () => {
  it("returns compact project summaries", async () => {
    const createRes = await registerTestProject({ name: "Summary Project" });
    const { project } = createRes.json();

    const res = await app.inject({
      method: "GET",
      url: "/integrations/hermes/projects",
      headers: {
        authorization: API_AUTH_HEADER
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      projects: [
        expect.objectContaining({
          id: project.id,
          name: "Summary Project",
          autonomyMode: "manual"
        })
      ]
    });
  });
});

describe("POST /integrations/hermes/projects/:projectId/trigger", () => {
  it("accepts a Hermes note and records a project message before triggering", async () => {
    const createRes = await registerTestProject({ name: "Triggered Project" });
    const { project } = createRes.json();

    const res = await app.inject({
      method: "POST",
      url: `/integrations/hermes/projects/${project.id}/trigger`,
      headers: {
        "content-type": "application/json",
        authorization: HERMES_AUTH_HEADER
      },
      payload: JSON.stringify({
        content: "Please pick up the next planned task.",
        actor: "hermes-agent"
      })
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      project: {
        id: project.id
      },
      telemetry: {
        projectId: project.id,
        lastOutcome: "skipped"
      },
      message: {
        id: expect.any(String)
      }
    });

    expect(await prisma.decisionLog.count()).toBe(1);
  });
});
