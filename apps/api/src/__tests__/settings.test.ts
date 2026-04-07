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
import {
  __internal_decryptValue,
  __internal_encryptValue,
  deleteSetting,
  getGitHubToken,
  getSetting,
  setSetting
} from "../settings.js";

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

// ---------------------------------------------------------------------------
// At-rest encryption (sensitive settings)
// ---------------------------------------------------------------------------

describe("sensitive setting encryption", () => {
  beforeEach(() => {
    vi.stubEnv("YEET2_SETTING_ENCRYPTION_KEY", "test-encryption-key-please-rotate");
  });

  it("round-trips a value through encrypt/decrypt", () => {
    const ciphertext = __internal_encryptValue("ghp_secret123");
    expect(ciphertext).toMatch(/^enc:v1:/);
    expect(ciphertext).not.toContain("ghp_secret123");
    expect(__internal_decryptValue(ciphertext)).toBe("ghp_secret123");
  });

  it("produces a different ciphertext on each call (random IV)", () => {
    const a = __internal_encryptValue("same plaintext");
    const b = __internal_encryptValue("same plaintext");
    expect(a).not.toBe(b);
  });

  it("returns plaintext unchanged for legacy values without the prefix", () => {
    expect(__internal_decryptValue("plaintext-legacy")).toBe("plaintext-legacy");
  });

  it("setSetting encrypts github_token before writing", async () => {
    mockUpsert.mockResolvedValue({ key: "github_token", value: "x" } as never);
    await setSetting("github_token", "ghp_supersecret");
    const writtenValue = mockUpsert.mock.calls[0][0].update.value as string;
    expect(writtenValue).toMatch(/^enc:v1:/);
    expect(writtenValue).not.toContain("ghp_supersecret");
  });

  it("setSetting does NOT encrypt non-sensitive keys", async () => {
    mockUpsert.mockResolvedValue({ key: "agent_theme", value: "x" } as never);
    await setSetting("agent_theme", "mythology");
    expect(mockUpsert.mock.calls[0][0].update.value).toBe("mythology");
  });

  it("getSetting decrypts github_token on read", async () => {
    const ct = __internal_encryptValue("ghp_decrypted");
    mockFindUnique.mockResolvedValue({ key: "github_token", value: ct } as never);
    expect(await getSetting("github_token")).toBe("ghp_decrypted");
  });

  it("getSetting tolerates legacy plaintext github_token rows (graceful migration)", async () => {
    mockFindUnique.mockResolvedValue({ key: "github_token", value: "ghp_legacy_plaintext" } as never);
    expect(await getSetting("github_token")).toBe("ghp_legacy_plaintext");
  });

  it("getSetting returns null and logs when decrypt fails (corrupt ciphertext)", async () => {
    mockFindUnique.mockResolvedValue({ key: "github_token", value: "enc:v1:bad:data:tag" } as never);
    expect(await getSetting("github_token")).toBeNull();
  });
});

describe("sensitive setting encryption with no key configured", () => {
  beforeEach(() => {
    vi.stubEnv("YEET2_SETTING_ENCRYPTION_KEY", "");
  });

  it("encryptValue returns plaintext when key is unset (opt-in)", () => {
    expect(__internal_encryptValue("foo")).toBe("foo");
  });

  it("setSetting writes plaintext when key is unset", async () => {
    mockUpsert.mockResolvedValue({ key: "github_token", value: "x" } as never);
    await setSetting("github_token", "ghp_x");
    expect(mockUpsert.mock.calls[0][0].update.value).toBe("ghp_x");
  });
});
