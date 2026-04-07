import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { requireApiAuth } from "../auth";

type FakeReply = {
  statusCode: number | null;
  body: unknown;
  code: (status: number) => FakeReply;
  send: (body: unknown) => Promise<void>;
};

function makeReply(): FakeReply {
  const reply: FakeReply = {
    statusCode: null,
    body: null,
    code(status) {
      this.statusCode = status;
      return this;
    },
    async send(body) {
      this.body = body;
    }
  };
  return reply;
}

function makeRequest(method: string, url: string, authorization: string | undefined) {
  return {
    method,
    url,
    headers: authorization !== undefined ? { authorization } : {},
    routeOptions: { url }
  } as unknown as Parameters<typeof requireApiAuth>[0];
}

describe("requireApiAuth", () => {
  const originalToken = process.env.YEET2_API_BEARER_TOKEN;
  const originalReads = process.env.YEET2_API_REQUIRE_AUTH_FOR_READS;

  beforeEach(() => {
    delete process.env.YEET2_API_BEARER_TOKEN;
    delete process.env.YEET2_API_TOKEN;
    delete process.env.YEET2_API_REQUIRE_AUTH_FOR_READS;
  });

  afterEach(() => {
    if (originalToken !== undefined) process.env.YEET2_API_BEARER_TOKEN = originalToken;
    if (originalReads !== undefined) process.env.YEET2_API_REQUIRE_AUTH_FOR_READS = originalReads;
  });

  it("passes through when no token is configured (open mode)", async () => {
    const reply = makeReply();
    await requireApiAuth(
      makeRequest("POST", "/projects", undefined),
      reply as unknown as Parameters<typeof requireApiAuth>[1]
    );
    expect(reply.statusCode).toBeNull();
  });

  it("rejects mutating requests with no authorization header", async () => {
    process.env.YEET2_API_BEARER_TOKEN = "a".repeat(48);
    const reply = makeReply();
    await requireApiAuth(
      makeRequest("POST", "/projects", undefined),
      reply as unknown as Parameters<typeof requireApiAuth>[1]
    );
    expect(reply.statusCode).toBe(401);
  });

  it("accepts mutating requests with the correct bearer token", async () => {
    process.env.YEET2_API_BEARER_TOKEN = "b".repeat(48);
    const reply = makeReply();
    await requireApiAuth(
      makeRequest("POST", "/projects", `Bearer ${"b".repeat(48)}`),
      reply as unknown as Parameters<typeof requireApiAuth>[1]
    );
    expect(reply.statusCode).toBeNull();
  });

  it("rejects mutating requests with a token of the wrong length", async () => {
    // This test exercises the length-mismatch early return of safeCompareStrings.
    process.env.YEET2_API_BEARER_TOKEN = "c".repeat(48);
    const reply = makeReply();
    await requireApiAuth(
      makeRequest("POST", "/projects", "Bearer short"),
      reply as unknown as Parameters<typeof requireApiAuth>[1]
    );
    expect(reply.statusCode).toBe(401);
  });

  it("rejects mutating requests with an equal-length but different token", async () => {
    // Same-length branch exercises the timingSafeEqual path.
    process.env.YEET2_API_BEARER_TOKEN = "d".repeat(48);
    const reply = makeReply();
    await requireApiAuth(
      makeRequest("POST", "/projects", `Bearer ${"e".repeat(48)}`),
      reply as unknown as Parameters<typeof requireApiAuth>[1]
    );
    expect(reply.statusCode).toBe(401);
  });

  it("leaves GET /health unauthenticated even when auth is enabled", async () => {
    process.env.YEET2_API_BEARER_TOKEN = "f".repeat(48);
    const reply = makeReply();
    await requireApiAuth(
      makeRequest("GET", "/health", undefined),
      reply as unknown as Parameters<typeof requireApiAuth>[1]
    );
    expect(reply.statusCode).toBeNull();
  });

  it("leaves GET reads open by default when write_protected", async () => {
    process.env.YEET2_API_BEARER_TOKEN = "g".repeat(48);
    const reply = makeReply();
    await requireApiAuth(
      makeRequest("GET", "/projects", undefined),
      reply as unknown as Parameters<typeof requireApiAuth>[1]
    );
    expect(reply.statusCode).toBeNull();
  });

  it("requires auth on GET reads when require_auth_for_reads is enabled", async () => {
    process.env.YEET2_API_BEARER_TOKEN = "h".repeat(48);
    process.env.YEET2_API_REQUIRE_AUTH_FOR_READS = "1";
    const reply = makeReply();
    await requireApiAuth(
      makeRequest("GET", "/projects", undefined),
      reply as unknown as Parameters<typeof requireApiAuth>[1]
    );
    expect(reply.statusCode).toBe(401);
  });
});
