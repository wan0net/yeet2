import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const constitutionPaths = {
  vision: "docs/VISION.md",
  spec: "docs/SPEC.md",
  roadmap: "docs/ROADMAP.md",
  architecture: "docs/ARCHITECTURE.md",
  decisions: "docs/DECISIONS.md",
  qualityBar: "docs/QUALITY_BAR.md"
} as const;

export type ConstitutionPathKey = keyof typeof constitutionPaths;

export type ConstitutionParseStatus = "pending" | "parsed" | "stale" | "failed";

export interface ConstitutionFileState {
  key: ConstitutionPathKey;
  path: string;
  absolutePath: string;
  exists: boolean;
  readable: boolean;
  indexed: boolean;
  bytes: number;
  wordCount: number;
  headingCount: number;
}

export interface ConstitutionSnapshot {
  vision: ConstitutionFileState;
  spec: ConstitutionFileState;
  roadmap: ConstitutionFileState;
  architecture: ConstitutionFileState;
  decisions: ConstitutionFileState;
  qualityBar: ConstitutionFileState;
}

export interface ConstitutionInspection {
  repoRoot: string;
  status: ConstitutionParseStatus;
  inspectedAt: string;
  files: ConstitutionSnapshot;
}

export function defaultConstitutionSnapshot(repoRoot = "."): ConstitutionSnapshot {
  const absoluteRoot = resolve(repoRoot);
  return {
    vision: fileState("vision", absoluteRoot),
    spec: fileState("spec", absoluteRoot),
    roadmap: fileState("roadmap", absoluteRoot),
    architecture: fileState("architecture", absoluteRoot),
    decisions: fileState("decisions", absoluteRoot),
    qualityBar: fileState("qualityBar", absoluteRoot)
  };
}

export function determineConstitutionStatus(snapshot: ConstitutionSnapshot): ConstitutionParseStatus {
  const coreFilesPresent = snapshot.vision.exists && snapshot.spec.exists && snapshot.roadmap.exists;

  if (!coreFilesPresent) {
    return "pending";
  }

  const indexedRequiredFiles = [snapshot.vision, snapshot.spec, snapshot.roadmap];
  if (indexedRequiredFiles.some((file) => !file.readable || !file.indexed)) {
    return "failed";
  }

  const optionalFilesMissing =
    !snapshot.architecture.exists || !snapshot.decisions.exists || !snapshot.qualityBar.exists;

  return optionalFilesMissing ? "stale" : "parsed";
}

export async function inspectConstitution(repoRoot: string): Promise<ConstitutionInspection> {
  const files = defaultConstitutionSnapshot(repoRoot);
  await Promise.all(
    Object.values(files).map(async (file) => {
      file.exists = await exists(file.absolutePath);
      if (!file.exists) {
        return;
      }

      const parsed = await inspectFileContents(file.absolutePath);
      file.readable = parsed.readable;
      file.indexed = parsed.indexed;
      file.bytes = parsed.bytes;
      file.wordCount = parsed.wordCount;
      file.headingCount = parsed.headingCount;
    }),
  );

  return {
    repoRoot: resolve(repoRoot),
    status: determineConstitutionStatus(files),
    inspectedAt: new Date().toISOString(),
    files
  };
}

function fileState(key: ConstitutionPathKey, repoRoot: string): ConstitutionFileState {
  const path = constitutionPaths[key];
  return {
    key,
    path,
    absolutePath: join(repoRoot, path),
    exists: false,
    readable: false,
    indexed: false,
    bytes: 0,
    wordCount: 0,
    headingCount: 0,
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function inspectFileContents(path: string): Promise<{
  readable: boolean;
  indexed: boolean;
  bytes: number;
  wordCount: number;
  headingCount: number;
}> {
  try {
    const text = await readFile(path, "utf8");
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const headings = trimmed ? text.split(/\r?\n/).filter((line) => /^\s*#+\s+/.test(line)).length : 0;

    return {
      readable: true,
      indexed: words.length > 0,
      bytes: Buffer.byteLength(text, "utf8"),
      wordCount: words.length,
      headingCount: headings,
    };
  } catch {
    return {
      readable: false,
      indexed: false,
      bytes: 0,
      wordCount: 0,
      headingCount: 0,
    };
  }
}
