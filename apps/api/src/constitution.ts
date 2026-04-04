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
  readable?: boolean;
  indexed?: boolean;
  bytes?: number;
  wordCount?: number;
  headingCount?: number;
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
      exists: sharedInspection.files.vision.exists,
      readable: sharedInspection.files.vision.readable,
      indexed: sharedInspection.files.vision.indexed,
      bytes: sharedInspection.files.vision.bytes,
      wordCount: sharedInspection.files.vision.wordCount,
      headingCount: sharedInspection.files.vision.headingCount
    },
    spec: {
      path: sharedInspection.files.spec.path,
      absolutePath: sharedInspection.files.spec.absolutePath,
      exists: sharedInspection.files.spec.exists,
      readable: sharedInspection.files.spec.readable,
      indexed: sharedInspection.files.spec.indexed,
      bytes: sharedInspection.files.spec.bytes,
      wordCount: sharedInspection.files.spec.wordCount,
      headingCount: sharedInspection.files.spec.headingCount
    },
    roadmap: {
      path: sharedInspection.files.roadmap.path,
      absolutePath: sharedInspection.files.roadmap.absolutePath,
      exists: sharedInspection.files.roadmap.exists,
      readable: sharedInspection.files.roadmap.readable,
      indexed: sharedInspection.files.roadmap.indexed,
      bytes: sharedInspection.files.roadmap.bytes,
      wordCount: sharedInspection.files.roadmap.wordCount,
      headingCount: sharedInspection.files.roadmap.headingCount
    },
    architecture: {
      path: sharedInspection.files.architecture.path,
      absolutePath: sharedInspection.files.architecture.absolutePath,
      exists: sharedInspection.files.architecture.exists,
      readable: sharedInspection.files.architecture.readable,
      indexed: sharedInspection.files.architecture.indexed,
      bytes: sharedInspection.files.architecture.bytes,
      wordCount: sharedInspection.files.architecture.wordCount,
      headingCount: sharedInspection.files.architecture.headingCount
    },
    decisions: {
      path: sharedInspection.files.decisions.path,
      absolutePath: sharedInspection.files.decisions.absolutePath,
      exists: sharedInspection.files.decisions.exists,
      readable: sharedInspection.files.decisions.readable,
      indexed: sharedInspection.files.decisions.indexed,
      bytes: sharedInspection.files.decisions.bytes,
      wordCount: sharedInspection.files.decisions.wordCount,
      headingCount: sharedInspection.files.decisions.headingCount
    },
    qualityBar: {
      path: sharedInspection.files.qualityBar.path,
      absolutePath: sharedInspection.files.qualityBar.absolutePath,
      exists: sharedInspection.files.qualityBar.exists,
      readable: sharedInspection.files.qualityBar.readable,
      indexed: sharedInspection.files.qualityBar.indexed,
      bytes: sharedInspection.files.qualityBar.bytes,
      wordCount: sharedInspection.files.qualityBar.wordCount,
      headingCount: sharedInspection.files.qualityBar.headingCount
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
