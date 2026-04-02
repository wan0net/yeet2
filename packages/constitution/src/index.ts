import { access } from "node:fs/promises";
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

  const optionalFilesMissing =
    !snapshot.architecture.exists || !snapshot.decisions.exists || !snapshot.qualityBar.exists;

  return optionalFilesMissing ? "stale" : "parsed";
}

export async function inspectConstitution(repoRoot: string): Promise<ConstitutionInspection> {
  const files = defaultConstitutionSnapshot(repoRoot);
  await Promise.all(Object.values(files).map(async file => {
    file.exists = await exists(file.absolutePath);
  }));

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
    exists: false
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
