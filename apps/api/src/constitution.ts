import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import {
  inspectConstitution as inspectSharedConstitution,
  type ConstitutionParseStatus
} from "@yeet2/constitution";

export type ConstitutionFileKey =
  | "vision"
  | "spec"
  | "roadmap"
  | "architecture"
  | "decisions"
  | "qualityBar";

export interface ConstitutionFileSummary {
  path: string;
  absolutePath: string;
  exists: boolean;
}

export interface ConstitutionInspection {
  repoRoot: string;
  status: ConstitutionParseStatus;
  inspectedAt: string;
  files: Record<ConstitutionFileKey, ConstitutionFileSummary>;
  presentRequiredFiles: ConstitutionFileKey[];
  missingRequiredFiles: ConstitutionFileKey[];
}

export class RepositoryPathError extends Error {
  override name = "RepositoryPathError";
}

export async function inspectConstitution(repoPath: string): Promise<ConstitutionInspection> {
  const repoRoot = resolve(repoPath);
  const repoStats = await stat(repoRoot).catch(() => null);

  if (repoStats === null || !repoStats.isDirectory()) {
    throw new RepositoryPathError(`Repository path not found: ${repoRoot}`);
  }

  const sharedInspection = await inspectSharedConstitution(repoRoot);
  const files: Record<ConstitutionFileKey, ConstitutionFileSummary> = {
    vision: {
      path: sharedInspection.files.vision.path,
      absolutePath: sharedInspection.files.vision.absolutePath,
      exists: sharedInspection.files.vision.exists
    },
    spec: {
      path: sharedInspection.files.spec.path,
      absolutePath: sharedInspection.files.spec.absolutePath,
      exists: sharedInspection.files.spec.exists
    },
    roadmap: {
      path: sharedInspection.files.roadmap.path,
      absolutePath: sharedInspection.files.roadmap.absolutePath,
      exists: sharedInspection.files.roadmap.exists
    },
    architecture: {
      path: sharedInspection.files.architecture.path,
      absolutePath: sharedInspection.files.architecture.absolutePath,
      exists: sharedInspection.files.architecture.exists
    },
    decisions: {
      path: sharedInspection.files.decisions.path,
      absolutePath: sharedInspection.files.decisions.absolutePath,
      exists: sharedInspection.files.decisions.exists
    },
    qualityBar: {
      path: sharedInspection.files.qualityBar.path,
      absolutePath: sharedInspection.files.qualityBar.absolutePath,
      exists: sharedInspection.files.qualityBar.exists
    }
  };
  const requiredKeys: ConstitutionFileKey[] = ["vision", "spec", "roadmap"];
  const presentRequiredFiles = requiredKeys.filter((key) => files[key].exists);
  const missingRequiredFiles = requiredKeys.filter((key) => !files[key].exists);

  return {
    repoRoot,
    status: sharedInspection.status,
    inspectedAt: sharedInspection.inspectedAt,
    files,
    presentRequiredFiles,
    missingRequiredFiles
  };
}
