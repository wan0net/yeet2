// Set DATABASE_URL before any module is imported so Prisma picks it up
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://localhost/yeet2_test";
process.env.DATABASE_URL = TEST_DB_URL;

// Use a fixed test API key so auth middleware passes
const TEST_API_KEY = process.env.YEET2_API_BEARER_TOKEN ?? "test-api-key";
process.env.YEET2_API_BEARER_TOKEN = TEST_API_KEY;

// Webhook secret used to compute signatures for the webhook tests below.
const TEST_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? "test-webhook-secret";
process.env.GITHUB_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

function signWebhookBody(body: string): string {
  return `sha256=${createHmac("sha256", TEST_WEBHOOK_SECRET).update(body).digest("hex")}`;
}

import { createApp } from "../../server";
import { setupTestDatabase, truncateAllTables } from "./setup";

// Auth header used in all mutating requests
const AUTH_HEADER = `Bearer ${TEST_API_KEY}`;

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

// ---------------------------------------------------------------------------
// Helper: register a project through the API
// ---------------------------------------------------------------------------
async function registerTestProject(overrides: Record<string, unknown> = {}) {
  const body = {
    name: "Test Project",
    localPath: "/tmp/yeet2-test-repo",
    defaultBranch: "main",
    ...overrides
  };

  return app.inject({
    method: "POST",
    url: "/projects",
    headers: {
      "content-type": "application/json",
      authorization: AUTH_HEADER
    },
    payload: JSON.stringify(body)
  });
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok" });
  });
});

// ---------------------------------------------------------------------------
// Projects – registration
// ---------------------------------------------------------------------------
describe("POST /projects", () => {
  it("returns 201 with project id when body is valid", async () => {
    const res = await registerTestProject();

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty("project");
    expect(body.project).toHaveProperty("id");
    expect(body.project.name).toBe("Test Project");
  });

  it("returns 400 when name is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/projects",
      headers: {
        "content-type": "application/json",
        authorization: AUTH_HEADER
      },
      payload: JSON.stringify({ localPath: "/tmp/repo", defaultBranch: "main" })
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error");
  });

  it("returns 400 when both localPath and repoUrl are missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/projects",
      headers: {
        "content-type": "application/json",
        authorization: AUTH_HEADER
      },
      payload: JSON.stringify({ name: "No path project", defaultBranch: "main" })
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error");
  });

  it("returns 400 when defaultBranch is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/projects",
      headers: {
        "content-type": "application/json",
        authorization: AUTH_HEADER
      },
      payload: JSON.stringify({ name: "No branch", localPath: "/tmp/repo" })
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// Projects – list
// ---------------------------------------------------------------------------
describe("GET /projects", () => {
  it("returns 200 with an array", async () => {
    const res = await app.inject({ method: "GET", url: "/projects" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("projects");
    expect(Array.isArray(body.projects)).toBe(true);
  });

  it("returns the registered project in the list", async () => {
    await registerTestProject({ name: "Listed Project" });

    const res = await app.inject({ method: "GET", url: "/projects" });

    expect(res.statusCode).toBe(200);
    const { projects } = res.json();
    const match = projects.find((p: { name: string }) => p.name === "Listed Project");
    expect(match).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Projects – get by id
// ---------------------------------------------------------------------------
describe("GET /projects/:id", () => {
  it("returns 200 with the project after registering", async () => {
    const createRes = await registerTestProject({ name: "Fetched Project" });
    expect(createRes.statusCode).toBe(201);
    const { project } = createRes.json();

    const res = await app.inject({ method: "GET", url: `/projects/${project.id}` });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("project");
    expect(body.project.id).toBe(project.id);
    expect(body.project.name).toBe("Fetched Project");
  });

  it("returns 404 for an unknown id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/projects/00000000-0000-0000-0000-000000000000"
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------
describe("POST /webhooks/github", () => {
  it("returns 200 { ok: true } for a push event with valid signature", async () => {
    const body = JSON.stringify({
      ref: "refs/heads/main",
      repository: { full_name: "org/repo" }
    });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        authorization: AUTH_HEADER,
        "x-github-event": "push",
        "x-hub-signature-256": signWebhookBody(body),
        "x-github-delivery": "test-delivery-1"
      },
      payload: body
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it("returns 200 { ok: true } for a pull_request event with valid signature", async () => {
    const body = JSON.stringify({
      action: "opened",
      pull_request: { number: 1, html_url: "https://github.com/org/repo/pull/1" },
      repository: { full_name: "org/repo" }
    });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        authorization: AUTH_HEADER,
        "x-github-event": "pull_request",
        "x-hub-signature-256": signWebhookBody(body),
        "x-github-delivery": "test-delivery-2"
      },
      payload: body
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it("returns 401 when the signature is missing", async () => {
    const body = JSON.stringify({ ref: "refs/heads/main" });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        authorization: AUTH_HEADER,
        "x-github-event": "push"
      },
      payload: body
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when the signature is wrong", async () => {
    const body = JSON.stringify({ ref: "refs/heads/main" });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        authorization: AUTH_HEADER,
        "x-github-event": "push",
        "x-hub-signature-256": "sha256=" + "a".repeat(64)
      },
      payload: body
    });
    expect(res.statusCode).toBe(401);
  });

  it("dedupes a repeated X-GitHub-Delivery within the dedup window", async () => {
    const body = JSON.stringify({
      ref: "refs/heads/main",
      repository: { full_name: "org/repo" }
    });
    const headers = {
      "content-type": "application/json",
      authorization: AUTH_HEADER,
      "x-github-event": "push",
      "x-hub-signature-256": signWebhookBody(body),
      "x-github-delivery": "test-delivery-dedup"
    };
    const first = await app.inject({ method: "POST", url: "/webhooks/github", headers, payload: body });
    const second = await app.inject({ method: "POST", url: "/webhooks/github", headers, payload: body });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ ok: true });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ ok: true, deduped: true });
  });
});

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------
describe("GET /workers", () => {
  it("returns 200 with an array", async () => {
    const res = await app.inject({ method: "GET", url: "/workers" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("workers");
    expect(Array.isArray(body.workers)).toBe(true);
  });
});
