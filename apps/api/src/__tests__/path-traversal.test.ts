import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We can't directly import the internal resolvePathInRoot (it's not exported)
// so we test the public readConstitutionFile / writeConstitutionFile
// behaviour via mocks on the db and settings modules.

vi.mock("../db", () => {
  const project = { id: "p1", name: "Test", localPath: "" as string };
  return {
    prisma: {
      project: {
        findUnique: vi.fn(async () => project),
        update: vi.fn(async () => project)
      }
    },
    __setLocalPath(path: string) {
      project.localPath = path;
    }
  };
});

vi.mock("../settings", () => ({
  getSetting: vi.fn(async () => null),
  getGitHubToken: vi.fn(async () => null)
}));

import * as dbModule from "../db";
import {
  ProjectConstitutionError,
  readConstitutionFile,
  writeConstitutionFile
} from "../projects";

describe("constitution file path traversal protection", () => {
  let tempRoot: string;
  let projectDir: string;
  let outsideDir: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "yeet2-path-test-"));
    projectDir = join(tempRoot, "project");
    outsideDir = join(tempRoot, "outside");
    await mkdir(projectDir, { recursive: true });
    await mkdir(outsideDir, { recursive: true });
    await mkdir(join(projectDir, "docs"), { recursive: true });

    (dbModule as unknown as { __setLocalPath(p: string): void }).__setLocalPath(projectDir);
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("reads a normal constitution file inside the project directory", async () => {
    await writeFile(join(projectDir, "docs", "VISION.md"), "# Vision", "utf8");
    const result = await readConstitutionFile("p1", "vision");
    expect(result.exists).toBe(true);
    expect(result.content).toContain("# Vision");
  });

  it("returns empty content (not an error) for a file that doesn't exist yet", async () => {
    const result = await readConstitutionFile("p1", "vision");
    expect(result.exists).toBe(false);
    expect(result.content).toBe("");
  });

  it("refuses to read a file reachable only via a docs symlink escape", async () => {
    // Attacker has replaced docs/ with a symlink pointing outside the project.
    await writeFile(join(outsideDir, "VISION.md"), "secrets", "utf8");
    await rm(join(projectDir, "docs"), { recursive: true, force: true });
    await symlink(outsideDir, join(projectDir, "docs"));

    await expect(readConstitutionFile("p1", "vision")).rejects.toThrow(
      ProjectConstitutionError
    );
    await expect(readConstitutionFile("p1", "vision")).rejects.toMatchObject({
      code: "path_traversal"
    });
  });

  it("refuses to read a file reachable only via a direct file symlink escape", async () => {
    await writeFile(join(outsideDir, "pwn.md"), "secrets", "utf8");
    await symlink(join(outsideDir, "pwn.md"), join(projectDir, "docs", "VISION.md"));

    await expect(readConstitutionFile("p1", "vision")).rejects.toMatchObject({
      code: "path_traversal"
    });
  });

  it("refuses to write to a path escaping via a docs symlink", async () => {
    await rm(join(projectDir, "docs"), { recursive: true, force: true });
    await symlink(outsideDir, join(projectDir, "docs"));

    await expect(writeConstitutionFile("p1", "vision", "content")).rejects.toMatchObject({
      code: "path_traversal"
    });
  });

  it("rejects an unknown file key", async () => {
    await expect(readConstitutionFile("p1", "notakey")).rejects.toMatchObject({
      code: "invalid_file_key"
    });
  });
});
