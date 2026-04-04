import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  constitutionPaths,
  defaultConstitutionSnapshot,
  determineConstitutionStatus,
  inspectConstitution,
} from "../index";
import type { ConstitutionPathKey, ConstitutionSnapshot } from "../index";

const ALL_KEYS: ConstitutionPathKey[] = [
  "vision",
  "spec",
  "roadmap",
  "architecture",
  "decisions",
  "qualityBar",
];

describe("constitutionPaths", () => {
  it("returns all 6 keys", () => {
    expect(Object.keys(constitutionPaths).sort()).toEqual([...ALL_KEYS].sort());
  });

  it("all paths are non-empty strings", () => {
    for (const [key, path] of Object.entries(constitutionPaths)) {
      expect(typeof path, `path for "${key}"`).toBe("string");
      expect(path.length, `path for "${key}"`).toBeGreaterThan(0);
    }
  });
});

describe("defaultConstitutionSnapshot", () => {
  it("includes a state entry for every key", () => {
    const snapshot = defaultConstitutionSnapshot("/tmp/fake");
    for (const key of ALL_KEYS) {
      expect(snapshot).toHaveProperty(key);
    }
  });

  it("all entries default to exists: false", () => {
    const snapshot = defaultConstitutionSnapshot("/tmp/fake");
    for (const key of ALL_KEYS) {
      expect(snapshot[key].exists, `${key}.exists`).toBe(false);
    }
  });

  it("absolutePath is constructed from the provided repoRoot", () => {
    const snapshot = defaultConstitutionSnapshot("/some/root");
    expect(snapshot.vision.absolutePath).toContain("/some/root");
  });
});

describe("inspectConstitution", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "yeet2-constitution-test-"));
    await mkdir(join(tmpDir, "docs"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns all files as exists: false for an empty directory", async () => {
    const result = await inspectConstitution(tmpDir);
    for (const key of ALL_KEYS) {
      expect(result.files[key].exists, `${key}.exists should be false`).toBe(false);
    }
  });

  it("returns the correct repoRoot", async () => {
    const result = await inspectConstitution(tmpDir);
    expect(result.repoRoot).toBe(tmpDir);
  });

  it("returns an inspectedAt ISO string", async () => {
    const result = await inspectConstitution(tmpDir);
    expect(() => new Date(result.inspectedAt)).not.toThrow();
    expect(new Date(result.inspectedAt).toISOString()).toBe(result.inspectedAt);
  });

  it("returns all files as exists: true when all constitution files are present", async () => {
    const fileMap: Record<ConstitutionPathKey, string> = {
      vision: "docs/VISION.md",
      spec: "docs/SPEC.md",
      roadmap: "docs/ROADMAP.md",
      architecture: "docs/ARCHITECTURE.md",
      decisions: "docs/DECISIONS.md",
      qualityBar: "docs/QUALITY_BAR.md",
    };

    for (const [, relativePath] of Object.entries(fileMap)) {
      await writeFile(join(tmpDir, relativePath), `# Heading\n\nSome content here.\n`);
    }

    const result = await inspectConstitution(tmpDir);
    for (const key of ALL_KEYS) {
      expect(result.files[key].exists, `${key}.exists should be true`).toBe(true);
    }
  });

  it("correctly reports partial file presence", async () => {
    await writeFile(join(tmpDir, "docs/VISION.md"), "# Vision\n\nContent.\n");
    await writeFile(join(tmpDir, "docs/SPEC.md"), "# Spec\n\nContent.\n");

    const result = await inspectConstitution(tmpDir);
    expect(result.files.vision.exists).toBe(true);
    expect(result.files.spec.exists).toBe(true);
    expect(result.files.roadmap.exists).toBe(false);
    expect(result.files.architecture.exists).toBe(false);
    expect(result.files.decisions.exists).toBe(false);
    expect(result.files.qualityBar.exists).toBe(false);
  });

  it("file inspection includes word count for a file with known content", async () => {
    const content = "# Vision\n\nThis is a test file with exactly ten words here.\n";
    await writeFile(join(tmpDir, "docs/VISION.md"), content);

    const result = await inspectConstitution(tmpDir);
    expect(result.files.vision.wordCount).toBeGreaterThan(0);
  });

  it("file inspection includes heading count for a markdown file with headings", async () => {
    const content = "# Main Heading\n\nSome text.\n\n## Sub Heading\n\nMore text.\n";
    await writeFile(join(tmpDir, "docs/VISION.md"), content);

    const result = await inspectConstitution(tmpDir);
    expect(result.files.vision.headingCount).toBeGreaterThanOrEqual(1);
  });

  it("non-existent files have zero wordCount and headingCount", async () => {
    const result = await inspectConstitution(tmpDir);
    expect(result.files.vision.wordCount).toBe(0);
    expect(result.files.vision.headingCount).toBe(0);
  });
});

describe("determineConstitutionStatus", () => {
  function makeSnapshot(overrides: Partial<Record<ConstitutionPathKey, Partial<ConstitutionSnapshot[ConstitutionPathKey]>>>): ConstitutionSnapshot {
    const base = defaultConstitutionSnapshot("/fake");
    for (const [key, partial] of Object.entries(overrides)) {
      Object.assign(base[key as ConstitutionPathKey], partial);
    }
    return base;
  }

  it("returns 'pending' when core files are missing", () => {
    const snapshot = makeSnapshot({});
    expect(determineConstitutionStatus(snapshot)).toBe("pending");
  });

  it("returns 'pending' when only vision is present", () => {
    const snapshot = makeSnapshot({ vision: { exists: true, readable: true, indexed: true } });
    expect(determineConstitutionStatus(snapshot)).toBe("pending");
  });

  it("returns 'pending' when vision and spec are present but roadmap is missing", () => {
    const snapshot = makeSnapshot({
      vision: { exists: true, readable: true, indexed: true },
      spec: { exists: true, readable: true, indexed: true },
    });
    expect(determineConstitutionStatus(snapshot)).toBe("pending");
  });

  it("returns 'stale' when core files are present but optional files are missing", () => {
    const snapshot = makeSnapshot({
      vision: { exists: true, readable: true, indexed: true },
      spec: { exists: true, readable: true, indexed: true },
      roadmap: { exists: true, readable: true, indexed: true },
    });
    expect(determineConstitutionStatus(snapshot)).toBe("stale");
  });

  it("returns 'parsed' when all files are present, readable, and indexed", () => {
    const snapshot = makeSnapshot({
      vision: { exists: true, readable: true, indexed: true },
      spec: { exists: true, readable: true, indexed: true },
      roadmap: { exists: true, readable: true, indexed: true },
      architecture: { exists: true, readable: true, indexed: true },
      decisions: { exists: true, readable: true, indexed: true },
      qualityBar: { exists: true, readable: true, indexed: true },
    });
    expect(determineConstitutionStatus(snapshot)).toBe("parsed");
  });

  it("returns 'failed' when a core file exists but is not readable", () => {
    const snapshot = makeSnapshot({
      vision: { exists: true, readable: false, indexed: false },
      spec: { exists: true, readable: true, indexed: true },
      roadmap: { exists: true, readable: true, indexed: true },
    });
    expect(determineConstitutionStatus(snapshot)).toBe("failed");
  });

  it("returns 'failed' when a core file exists and is readable but not indexed", () => {
    const snapshot = makeSnapshot({
      vision: { exists: true, readable: true, indexed: false },
      spec: { exists: true, readable: true, indexed: true },
      roadmap: { exists: true, readable: true, indexed: true },
    });
    expect(determineConstitutionStatus(snapshot)).toBe("failed");
  });
});
