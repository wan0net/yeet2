import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiJson, readApiError } from "$lib/server/api";
import { deleteJson } from "$lib/server/mutations";

describe("readApiError", () => {
  it("prefers structured API detail fields", async () => {
    const response = new Response(JSON.stringify({ detail: "Token missing", message: "bad request" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });

    await expect(readApiError(response)).resolves.toBe("Token missing");
  });

  it("falls back to plain-text error bodies", async () => {
    const response = new Response("Service unavailable", { status: 503 });

    await expect(readApiError(response)).resolves.toBe("Service unavailable");
  });
});

describe("server API helpers", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("apiJson throws a parsed JSON error instead of the raw payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Settings backend unavailable" }), {
        status: 502,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(apiJson("/settings/github-token")).rejects.toThrow("Settings backend unavailable");
  });

  it("deleteJson rejects when a DELETE request returns a non-ok status", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Unable to remove token" }), {
        status: 500,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(deleteJson("/settings/github-token")).rejects.toThrow("Unable to remove token");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/settings/github-token",
      expect.objectContaining({ method: "DELETE", cache: "no-store" })
    );
  });

  it("deleteJson tolerates empty success responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteJson("/settings/github-token")).resolves.toBeNull();
  });
});
