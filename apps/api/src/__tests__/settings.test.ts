import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the prisma client before importing settings
vi.mock("../db.js", () => ({
  prisma: {
    setting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

import { prisma } from "../db.js";
import { deleteSetting, getGitHubToken, getSetting, setSetting } from "../settings.js";

const mockFindUnique = vi.mocked(prisma.setting.findUnique);
const mockUpsert = vi.mocked(prisma.setting.upsert);
const mockDeleteMany = vi.mocked(prisma.setting.deleteMany);

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// getGitHubToken
// ---------------------------------------------------------------------------

describe("getGitHubToken", () => {
  it("returns env var when no DB setting", async () => {
    mockFindUnique.mockResolvedValue(null);
    vi.stubEnv("GITHUB_TOKEN", "env-token-abc");
    const result = await getGitHubToken();
    expect(result).toBe("env-token-abc");
  });

  it("returns DB value over env var", async () => {
    mockFindUnique.mockResolvedValue({ key: "github_token", value: "db-token-xyz" } as never);
    vi.stubEnv("GITHUB_TOKEN", "env-token-abc");
    const result = await getGitHubToken();
    expect(result).toBe("db-token-xyz");
  });

  it("returns null when neither DB nor env var is set", async () => {
    mockFindUnique.mockResolvedValue(null);
    vi.stubEnv("GITHUB_TOKEN", "");
    const result = await getGitHubToken();
    expect(result).toBeNull();
  });

  it("returns null when env var is whitespace only", async () => {
    mockFindUnique.mockResolvedValue(null);
    vi.stubEnv("GITHUB_TOKEN", "   ");
    const result = await getGitHubToken();
    expect(result).toBeNull();
  });

  it("trims whitespace from env var", async () => {
    mockFindUnique.mockResolvedValue(null);
    vi.stubEnv("GITHUB_TOKEN", "  trimmed-token  ");
    const result = await getGitHubToken();
    expect(result).toBe("trimmed-token");
  });
});

// ---------------------------------------------------------------------------
// getSetting
// ---------------------------------------------------------------------------

describe("getSetting", () => {
  it("returns null for a missing key", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getSetting("nonexistent_key");
    expect(result).toBeNull();
  });

  it("calls findUnique with the correct key", async () => {
    mockFindUnique.mockResolvedValue(null);
    await getSetting("some_key");
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { key: "some_key" } });
  });

  it("returns the value from the DB record", async () => {
    mockFindUnique.mockResolvedValue({ key: "some_key", value: "some_value" } as never);
    const result = await getSetting("some_key");
    expect(result).toBe("some_value");
  });
});

// ---------------------------------------------------------------------------
// setSetting
// ---------------------------------------------------------------------------

describe("setSetting", () => {
  it("calls upsert with correct args", async () => {
    mockUpsert.mockResolvedValue({ key: "my_key", value: "my_value" } as never);
    await setSetting("my_key", "my_value");
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { key: "my_key" },
      update: { value: "my_value" },
      create: { key: "my_key", value: "my_value" }
    });
  });

  it("does not throw on success", async () => {
    mockUpsert.mockResolvedValue({ key: "k", value: "v" } as never);
    await expect(setSetting("k", "v")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deleteSetting
// ---------------------------------------------------------------------------

describe("deleteSetting", () => {
  it("calls deleteMany with the correct key", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 } as never);
    await deleteSetting("target_key");
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { key: "target_key" } });
  });

  it("does not throw when key does not exist", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 } as never);
    await expect(deleteSetting("missing_key")).resolves.toBeUndefined();
  });
});
