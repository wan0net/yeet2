import { execFile } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

import type {
  Blocker as DbBlocker,
  Constitution,
  Job as DbJob,
  Mission as DbMission,
  Project as DbProject,
  Task as DbTask
} from "@yeet2/db";

import { prisma } from "./db";
import { buildGitHubIssueBody, createGitHubIssue, parseGitHubRepositoryUrl, GitHubIssueError } from "./github";
import { inspectConstitution, type ConstitutionInspection } from "./constitution";
import { createInitialPlan, loadPlanningContext, type PlanningDraft, type PlanningProject } from "./planning";

export interface ProjectRegistrationInput {
  name: string;
  repoUrl?: string | null;
  defaultBranch: string;
  localPath?: string | null;
}

export type ProjectTaskStatus = DbTask["status"];
export type ProjectJobStatus = DbJob["status"];

export interface ProjectJobSummary {
  id: string;
  taskId: string;
  executorType: string;
  workspacePath: string;
  branchName: string;
  status: ProjectJobStatus;
  logPath: string | null;
  artifactSummary: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ProjectTaskSummary {
  id: string;
  missionId: string;
  title: string;
  description: string;
  agentRole: string;
  status: ProjectTaskStatus;
  priority: number;
  acceptanceCriteria: string[];
  attempts: number;
  blockerReason: string | null;
  dispatchable: boolean;
  dispatchBlockedReason: string | null;
  jobs: ProjectJobSummary[];
}

export interface ProjectBlockerSummary {
  id: string;
  taskId: string;
  missionId: string;
  taskTitle: string;
  taskStatus: ProjectTaskStatus;
  taskAgentRole: string;
  title: string;
  context: string;
  options: string[];
  recommendation: string | null;
  status: DbBlocker["status"];
  githubIssueNumber: number | null;
  githubIssueUrl: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ProjectMissionSummary {
  id: string;
  projectId: string;
  title: string;
  objective: string;
  status: string;
  createdBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  tasks: ProjectTaskSummary[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  localPath: string;
  constitutionStatus: ConstitutionInspection["status"];
  constitution: ConstitutionInspection;
  missions: ProjectMissionSummary[];
  dispatchableRoles: string[];
  nextDispatchableTaskId: string | null;
  nextDispatchableTaskRole: string | null;
  activeMissionCount: number;
  activeTaskCount: number;
  blockerCount: number;
  blockers: ProjectBlockerSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface DispatchTaskResult {
  project: ProjectSummary;
  job: ProjectJobSummary;
}

export class ProjectDispatchError extends Error {
  constructor(
    public readonly code:
      | "project_not_found"
      | "task_not_found"
      | "no_dispatchable_task"
      | "invalid_task_role"
      | "task_not_dispatchable"
      | "executor_unavailable",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProjectDispatchError";
  }
}

export class ProjectBlockerError extends Error {
  constructor(
    public readonly code: "project_not_found" | "blocker_not_found",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProjectBlockerError";
  }
}

export class ProjectGitHubIssueError extends Error {
  constructor(
    public readonly code: "project_not_found" | "blocker_not_found" | "invalid_repo_url" | "github_not_configured" | "github_issue_failed",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProjectGitHubIssueError";
  }
}

export class ProjectRegistrationError extends Error {
  constructor(
    public readonly code: "clone_target_conflict" | "git_clone_failed" | "missing_repository_source",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProjectRegistrationError";
  }
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
}

export interface ProjectDetailResponse {
  project: ProjectSummary | null;
}

type ProjectWithRelations = DbProject & {
  constitution?: Constitution | null;
  missions: Array<DbMission & { tasks: Array<DbTask & { jobs: DbJob[]; blockers: DbBlocker[] }> }>;
};

type ProjectTaskWithRelations = ProjectWithRelations["missions"][number]["tasks"][number];

interface ResolvedProjectRegistration {
  localPath: string;
  repoUrl: string | null;
}

const DISPATCHABLE_TASK_ROLES = ["implementer", "qa", "reviewer"] as const;
const DISPATCHABLE_TASK_STATUSES = ["pending", "ready", "failed"] as const;
const MAX_DISPATCH_ATTEMPTS = 2;
const execFileAsync = promisify(execFile);

type DispatchableTaskRole = (typeof DISPATCHABLE_TASK_ROLES)[number];

function isCountedTaskStatus(status: string): boolean {
  return status !== "complete" && status !== "failed" && status !== "cancelled" && status !== "done";
}

function hasOpenTaskBlocker(task: Pick<ProjectTaskWithRelations, "blockers">): boolean {
  return task.blockers.some((blocker) => blocker.status === "open");
}

function hasActionableTaskWork(task: Pick<ProjectTaskWithRelations, "agentRole" | "status" | "blockers">): boolean {
  if (hasOpenTaskBlocker(task)) {
    return true;
  }

  return isDispatchableTaskRole(task.agentRole) && isCountedTaskStatus(task.status);
}

function missionStatusFromTasks(mission: ProjectWithRelations["missions"][number]): ProjectMissionSummary["status"] {
  const hasDispatchableTasks = mission.tasks.some((task) => isDispatchableTaskRole(task.agentRole));
  if (!hasDispatchableTasks) {
    return mission.status;
  }

  return mission.tasks.some((task) => hasActionableTaskWork(task)) ? mission.status : "complete";
}

function isDispatchableTaskStatus(status: ProjectTaskStatus): boolean {
  return DISPATCHABLE_TASK_STATUSES.some((candidate) => candidate === status);
}

function isDispatchableTaskRole(role: string): role is DispatchableTaskRole {
  return DISPATCHABLE_TASK_ROLES.some((candidate) => candidate === role);
}

function dispatchableRolesMessage(): string {
  return DISPATCHABLE_TASK_ROLES.join(", ");
}

function buildInvalidTaskRoleMessage(role: string): string {
  return `Task role "${role}" is not dispatchable yet. Currently dispatchable roles: ${dispatchableRolesMessage()}.`;
}

function buildTaskNotDispatchableMessage(taskId: string, status: ProjectTaskStatus): string {
  return `Task ${taskId} is not dispatchable from status "${status}". Dispatchable statuses: ${DISPATCHABLE_TASK_STATUSES.join(", ")}.`;
}

function buildNoDispatchableTaskMessage(projectId: string): string {
  return `Project ${projectId} has no dispatchable tasks right now.`;
}

function isTaskDispatchable(task: Pick<DbTask, "agentRole" | "status">): boolean {
  return isDispatchableTaskRole(task.agentRole) && isDispatchableTaskStatus(task.status);
}

function dispatchBlockedReasonForTask(task: Pick<DbTask, "id" | "agentRole" | "status">): string | null {
  if (!isDispatchableTaskRole(task.agentRole)) {
    return buildInvalidTaskRoleMessage(task.agentRole);
  }

  if (!isDispatchableTaskStatus(task.status)) {
    return buildTaskNotDispatchableMessage(task.id, task.status);
  }

  return null;
}

function executorBaseUrl(): string {
  return (process.env.YEET2_EXECUTOR_BASE_URL ?? process.env.EXECUTOR_BASE_URL ?? "http://127.0.0.1:8021").replace(/\/+$/, "");
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function projectsBaseDir(): string {
  return resolve(process.env.YEET2_PROJECTS_DIR ?? "/tmp/yeet2-projects");
}

function sanitizeDirectorySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cleanRepoPath(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.git$/i, "");
}

function normalizeRepositoryIdentifier(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("file://")) {
    try {
      const parsed = new URL(normalized);
      return `file:${resolve(parsed.pathname).replace(/\/+$/, "").replace(/\.git$/i, "")}`;
    } catch {
      return normalized;
    }
  }

  if (normalized.includes("://")) {
    try {
      const parsed = new URL(normalized);
      return `${parsed.hostname.toLowerCase()}/${cleanRepoPath(parsed.pathname)}`;
    } catch {
      return normalized;
    }
  }

  const scpStyleMatch = normalized.match(/^(?:[^@/]+@)?([^:]+):(.+)$/);
  if (scpStyleMatch && !/^[a-zA-Z]:[\\/]/.test(normalized)) {
    const [, host, repoPath] = scpStyleMatch;
    return `${host.toLowerCase()}/${cleanRepoPath(repoPath)}`;
  }

  if (normalized.startsWith("/") || normalized.startsWith(".")) {
    return `file:${resolve(normalized).replace(/\/+$/, "").replace(/\.git$/i, "")}`;
  }

  return normalized.replace(/\/+$/, "");
}

function repoDirectorySeed(repoUrl: string): string {
  const identifier = normalizeRepositoryIdentifier(repoUrl);
  const repoPath = identifier.startsWith("file:") ? identifier.slice("file:".length) : identifier;
  const segments = repoPath
    .split(/[/:]+/)
    .map((segment) => sanitizeDirectorySegment(segment))
    .filter(Boolean);

  return segments.join("-") || sanitizeDirectorySegment(basename(repoUrl.replace(/\/+$/, "")));
}

function deriveCloneDirectoryName(projectName: string, repoUrl: string): string {
  const repoSeed = repoDirectorySeed(repoUrl);
  if (repoSeed) {
    return repoSeed;
  }

  return sanitizeDirectorySegment(projectName) || "project";
}

function repoUrlsMatch(left: string, right: string): boolean {
  return normalizeRepositoryIdentifier(left) === normalizeRepositoryIdentifier(right);
}

async function readOriginRemoteUrl(repoPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoPath, "remote", "get-url", "origin"]);
    const remoteUrl = stdout.trim();
    return remoteUrl || null;
  } catch {
    return null;
  }
}

function gitFailureMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Git command failed";
  }

  const withStderr = error as Error & { stderr?: string; stdout?: string; code?: string | number };
  const details = [withStderr.stderr, withStderr.stdout, error.message]
    .map((value) => value?.trim())
    .find(Boolean);

  if (withStderr.code === "ENOENT") {
    return "Git is required for repoUrl registration, but the git CLI is not available.";
  }

  return details ?? "Git command failed";
}

async function cloneRepository(repoUrl: string, targetPath: string): Promise<void> {
  try {
    await execFileAsync("git", ["clone", "--origin", "origin", "--", repoUrl, targetPath]);
  } catch (error) {
    throw new ProjectRegistrationError(
      "git_clone_failed",
      `Unable to clone repository ${repoUrl} into ${targetPath}: ${gitFailureMessage(error)}`,
      503
    );
  }
}

async function resolveProjectRegistration(input: ProjectRegistrationInput): Promise<ResolvedProjectRegistration> {
  const repoUrl = normalizeOptionalString(input.repoUrl);
  const localPath = normalizeOptionalString(input.localPath);

  if (localPath) {
    return {
      localPath,
      repoUrl
    };
  }

  if (!repoUrl) {
    throw new ProjectRegistrationError(
      "missing_repository_source",
      "Either localPath must be provided or repoUrl must be set so the API can clone the repository.",
      400
    );
  }

  const baseDir = projectsBaseDir();
  const targetPath = join(baseDir, deriveCloneDirectoryName(input.name, repoUrl));
  const targetStats = await stat(targetPath).catch(() => null);

  await mkdir(baseDir, { recursive: true });

  if (targetStats) {
    if (!targetStats.isDirectory()) {
      throw new ProjectRegistrationError(
        "clone_target_conflict",
        `Clone target already exists and is not a directory: ${targetPath}`,
        409
      );
    }

    const originUrl = await readOriginRemoteUrl(targetPath);
    if (originUrl && repoUrlsMatch(originUrl, repoUrl)) {
      return {
        localPath: targetPath,
        repoUrl
      };
    }

    throw new ProjectRegistrationError(
      "clone_target_conflict",
      `Clone target already exists and does not match ${repoUrl}: ${targetPath}`,
      409
    );
  }

  await cloneRepository(repoUrl, targetPath);

  return {
    localPath: targetPath,
    repoUrl
  };
}

function asProjectInput(project: Pick<ProjectWithRelations, "id" | "name" | "repoUrl" | "defaultBranch" | "localPath">): PlanningProject {
  return {
    id: project.id,
    name: project.name,
    repoUrl: project.repoUrl ?? "",
    defaultBranch: project.defaultBranch,
    localPath: project.localPath
  };
}

function toProjectJobSummary(job: DbJob): ProjectJobSummary {
  return {
    id: job.id,
    taskId: job.taskId,
    executorType: job.executorType,
    workspacePath: job.workspacePath,
    branchName: job.branchName,
    status: job.status,
    logPath: job.logPath ?? null,
    artifactSummary: job.artifactSummary ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null
  };
}

function normalizeBlockerOptions(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function jobSortKey(job: DbJob): number {
  return job.completedAt?.getTime() ?? job.startedAt?.getTime() ?? 0;
}

function toProjectTaskSummary(task: ProjectWithRelations["missions"][number]["tasks"][number]): ProjectTaskSummary {
  const acceptanceCriteria = Array.isArray(task.acceptanceCriteria)
    ? (task.acceptanceCriteria as unknown[])
        .filter((value: unknown): value is string => typeof value === "string")
        .map((value: string) => value.trim())
        .filter(Boolean)
    : [];
  const jobs = [...task.jobs].sort((left, right) => jobSortKey(right) - jobSortKey(left)).map(toProjectJobSummary);
  const dispatchable = isTaskDispatchable(task);

  return {
    id: task.id,
    missionId: task.missionId,
    title: task.title,
    description: task.description,
    agentRole: task.agentRole,
    status: task.status,
    priority: task.priority,
    acceptanceCriteria,
    attempts: task.attempts,
    blockerReason: task.blockerReason ?? null,
    dispatchable,
    dispatchBlockedReason: dispatchable ? null : dispatchBlockedReasonForTask(task),
    jobs
  };
}

function toProjectMissionSummary(mission: ProjectWithRelations["missions"][number]): ProjectMissionSummary {
  const tasks = [...mission.tasks]
    .sort((left, right) => left.priority - right.priority)
    .map(toProjectTaskSummary);
  const status = missionStatusFromTasks(mission);

  return {
    id: mission.id,
    projectId: mission.projectId,
    title: mission.title,
    objective: mission.objective,
    status,
    createdBy: mission.createdBy ?? null,
    startedAt: mission.startedAt?.toISOString() ?? null,
    completedAt: mission.completedAt?.toISOString() ?? null,
    tasks
  };
}

function blockerStatusRank(status: DbBlocker["status"]): number {
  if (status === "open") {
    return 0;
  }

  if (status === "resolved") {
    return 1;
  }

  return 2;
}

function toProjectBlockerSummary(
  blocker: DbBlocker,
  task: ProjectWithRelations["missions"][number]["tasks"][number]
): ProjectBlockerSummary {
  return {
    id: blocker.id,
    taskId: blocker.taskId,
    missionId: task.missionId,
    taskTitle: task.title,
    taskStatus: task.status,
    taskAgentRole: task.agentRole,
    title: blocker.title,
    context: blocker.context,
    options: normalizeBlockerOptions(blocker.options),
    recommendation: blocker.recommendation ?? null,
    status: blocker.status,
    githubIssueNumber: blocker.githubIssueNumber ?? null,
    githubIssueUrl: blocker.githubIssueUrl ?? null,
    createdAt: blocker.createdAt.toISOString(),
    resolvedAt: blocker.resolvedAt?.toISOString() ?? null
  };
}

function collectProjectBlockers(project: ProjectWithRelations): ProjectBlockerSummary[] {
  return project.missions
    .flatMap((mission) => mission.tasks.flatMap((task) => task.blockers.map((blocker) => toProjectBlockerSummary(blocker, task))))
    .sort((left, right) => {
      const statusDelta = blockerStatusRank(left.status) - blockerStatusRank(right.status);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      return new Date(right.resolvedAt ?? right.createdAt).getTime() - new Date(left.resolvedAt ?? left.createdAt).getTime();
    });
}

function createEmptyInspection(projectPath: string): ConstitutionInspection {
  return {
    repoRoot: projectPath,
    status: "failed",
    inspectedAt: new Date().toISOString(),
    files: {
      vision: { path: "docs/VISION.md", absolutePath: "", exists: false },
      spec: { path: "docs/SPEC.md", absolutePath: "", exists: false },
      roadmap: { path: "docs/ROADMAP.md", absolutePath: "", exists: false },
      architecture: { path: "docs/ARCHITECTURE.md", absolutePath: "", exists: false },
      decisions: { path: "docs/DECISIONS.md", absolutePath: "", exists: false },
      qualityBar: { path: "docs/QUALITY_BAR.md", absolutePath: "", exists: false }
    },
    presentRequiredFiles: [],
    missingRequiredFiles: ["vision", "spec", "roadmap"]
  };
}

function countProjectTasks(missions: ProjectWithRelations["missions"]): number {
  return missions.flatMap((mission) => mission.tasks).filter((task) => hasActionableTaskWork(task)).length;
}

function countProjectBlockers(blockers: ProjectBlockerSummary[]): number {
  return blockers.filter((blocker) => blocker.status === "open").length;
}

async function inspectProjectConstitution(project: Pick<ProjectWithRelations, "localPath">): Promise<ConstitutionInspection> {
  try {
    return await inspectConstitution(project.localPath);
  } catch {
    return createEmptyInspection(project.localPath);
  }
}

function toProjectSummary(project: ProjectWithRelations, constitution: ConstitutionInspection): ProjectSummary {
  const missions = [...project.missions]
    .sort((left, right) => (right.startedAt?.getTime() ?? 0) - (left.startedAt?.getTime() ?? 0))
    .map(toProjectMissionSummary);
  const blockers = collectProjectBlockers(project);
  const nextDispatchableTask = missions.flatMap((mission) => mission.tasks).find((task) => task.dispatchable) ?? null;

  return {
    id: project.id,
    name: project.name,
    repoUrl: project.repoUrl ?? "",
    defaultBranch: project.defaultBranch,
    localPath: project.localPath,
    constitutionStatus: constitution.status,
    constitution,
    missions,
    dispatchableRoles: [...DISPATCHABLE_TASK_ROLES],
    nextDispatchableTaskId: nextDispatchableTask?.id ?? null,
    nextDispatchableTaskRole: nextDispatchableTask?.agentRole ?? null,
    activeMissionCount: missions.filter((mission) => mission.status === "active" || mission.status === "planned").length,
    activeTaskCount: countProjectTasks(project.missions),
    blockerCount: countProjectBlockers(blockers),
    blockers,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

async function hydrateProject(project: ProjectWithRelations): Promise<ProjectSummary> {
  const constitution = await inspectProjectConstitution(project);
  return toProjectSummary(project, constitution);
}

async function loadProjectById(projectId: string): Promise<ProjectSummary | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      constitution: true,
      missions: {
        include: {
          tasks: {
            include: {
              jobs: true,
              blockers: true
            }
          }
        },
        orderBy: {
          startedAt: "desc"
        }
      }
    }
  });

  if (!project) {
    return null;
  }

  return hydrateProject(project);
}

async function loadProjects(): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    orderBy: {
      createdAt: "desc"
    },
    include: {
      constitution: true,
      missions: {
        include: {
          tasks: {
            include: {
              jobs: true,
              blockers: true
            }
          }
        },
        orderBy: {
          startedAt: "desc"
        }
      }
    }
  });

  const summaries = await Promise.all(projects.map((project) => hydrateProject(project)));
  return summaries;
}

function buildConstitutionData(inspection: ConstitutionInspection) {
  return {
    visionPath: inspection.files.vision.path,
    specPath: inspection.files.spec.path,
    roadmapPath: inspection.files.roadmap.path,
    architecturePath: inspection.files.architecture.path,
    decisionsPath: inspection.files.decisions.path,
    qualityBarPath: inspection.files.qualityBar.path,
    parseStatus: inspection.status,
    lastIndexedAt: new Date()
  };
}

function isPlanningComplete(missions: ProjectMissionSummary[]): boolean {
  return missions.length > 0 && missions[0].tasks.length >= 3;
}

function buildBranchName(projectId: string, taskId: string): string {
  return `yeet2/${projectId}/${taskId}`;
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapExecutorJobStatus(status: unknown): ProjectJobStatus {
  if (status === "completed") {
    return "complete";
  }

  if (status === "queued" || status === "running" || status === "complete" || status === "failed" || status === "cancelled") {
    return status;
  }

  return "queued";
}

function taskStatusFromJobStatus(status: ProjectJobStatus, attempts: number, role: string): ProjectTaskStatus {
  if (status === "queued" || status === "running") {
    return "running";
  }

  if (status === "complete" && isDispatchableTaskRole(role)) {
    return "complete";
  }

  return attempts >= MAX_DISPATCH_ATTEMPTS ? "blocked" : "failed";
}

function taskStatusFromDispatchFailure(attempts: number): ProjectTaskStatus {
  return attempts >= MAX_DISPATCH_ATTEMPTS ? "blocked" : "failed";
}

function buildDispatchBlockerReason(message: string): string {
  return `Dispatch failed after repeated attempts: ${message}`;
}

function normalizeFailureMessage(message: string): string {
  const normalized = message.trim().replace(/\s+/g, " ");
  return normalized || "No failure details were provided.";
}

interface TaskBlockerDraft {
  title: string;
  context: string;
  options: string[];
  recommendation: string | null;
}

function buildBlockedTaskDraft(
  task: ProjectWithRelations["missions"][number]["tasks"][number],
  reason: string,
  details: { source: "dispatch_failure"; attempts: number } | { source: "executor_outcome"; attempts: number; jobStatus: ProjectJobStatus }
): TaskBlockerDraft {
  const normalizedReason = normalizeFailureMessage(reason);
  const taskLabel = `Task "${task.title}" (${task.agentRole})`;
  const attemptLabel = `attempt ${details.attempts}`;

  if (details.source === "dispatch_failure") {
    return {
      title: `Dispatch blocker for ${task.title}`,
      context: `${taskLabel} entered blocked status after ${attemptLabel} because the dispatcher could not hand work to the executor. Latest failure: ${normalizedReason}`,
      options: [
        "Check whether the executor service is reachable and correctly configured.",
        "Confirm the repository path, base branch, and task metadata are still valid for dispatch.",
        "Resolve the dispatch issue, then move the task back to a dispatchable state and retry."
      ],
      recommendation: "Restore executor availability or configuration, then re-dispatch the task."
    };
  }

  const outcomeLabel = details.jobStatus === "cancelled" ? "cancelled" : "failed";
  return {
    title: `Executor ${outcomeLabel} for ${task.title}`,
    context: `${taskLabel} entered blocked status after ${attemptLabel} because the executor reported job status "${details.jobStatus}". Latest failure: ${normalizedReason}`,
    options: [
      "Inspect the latest job log and any available executor artifacts for the task.",
      "Fix the task, repository state, or runtime dependency that caused the executor outcome.",
      "When the issue is understood, clear the blocker and return the task to a dispatchable state."
    ],
    recommendation:
      details.jobStatus === "cancelled"
        ? "Confirm why the executor cancelled the run, correct the trigger condition, and retry."
        : "Review the failed run output, fix the underlying issue, and retry the task."
  };
}

type BlockerMutationClient = Pick<typeof prisma, "blocker" | "task">;

async function upsertOpenTaskBlocker(
  tx: BlockerMutationClient,
  task: ProjectWithRelations["missions"][number]["tasks"][number],
  draft: TaskBlockerDraft
): Promise<void> {
  const existing = await tx.blocker.findFirst({
    where: {
      taskId: task.id,
      status: "open"
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (existing) {
    await tx.blocker.update({
      where: { id: existing.id },
      data: {
        title: draft.title,
        context: draft.context,
        options: draft.options,
        recommendation: draft.recommendation
      }
    });
    return;
  }

  await tx.blocker.create({
    data: {
      taskId: task.id,
      title: draft.title,
      context: draft.context,
      options: draft.options,
      recommendation: draft.recommendation
    }
  });
}

function normalizeAcceptanceCriteria(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

interface ExecutorJobRecord {
  id: string;
  task_id: string;
  executor_type: string;
  status: string;
  workspace_path: string;
  branch_name: string;
  log_path?: string | null;
  artifact_summary?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  payload?: Record<string, unknown> | null;
}

interface ExecutorDispatchPayload {
  repo_path: string;
  base_branch: string;
  task_title: string;
  task_description: string;
  acceptance_criteria: string[];
  task_id?: string;
  project_id?: string;
  mission_id?: string;
  agent_role?: string;
  priority?: number;
  attempts?: number;
  metadata?: Record<string, unknown>;
}

function dispatchableTaskForProject(project: ProjectWithRelations, taskId: string) {
  for (const mission of project.missions) {
    const task = mission.tasks.find((candidate) => candidate.id === taskId);
    if (task) {
      return task;
    }
  }

  return null;
}

function firstImplementerTask(project: ProjectWithRelations) {
  for (const mission of project.missions) {
    const task = mission.tasks
      .filter((candidate) => candidate.agentRole === "implementer")
      .sort((left, right) => left.priority - right.priority)[0];
    if (task) {
      return task;
    }
  }

  return null;
}

function nextDispatchableTaskForProject(project: ProjectWithRelations) {
  for (const mission of project.missions) {
    const task = [...mission.tasks].sort((left, right) => left.priority - right.priority).find((candidate) => isTaskDispatchable(candidate));
    if (task) {
      return task;
    }
  }

  return null;
}

async function submitTaskToExecutor(
  project: ProjectWithRelations,
  task: ProjectWithRelations["missions"][number]["tasks"][number]
): Promise<ExecutorJobRecord> {
  const response = await fetch(`${executorBaseUrl()}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      repo_path: project.localPath,
      base_branch: project.defaultBranch,
      task_title: task.title,
      task_description: task.description,
      acceptance_criteria: normalizeAcceptanceCriteria(task.acceptanceCriteria),
      task_id: task.id,
      project_id: project.id,
      mission_id: task.missionId,
      agent_role: task.agentRole,
      priority: task.priority,
      attempts: task.attempts + 1,
      metadata: {
        project_id: project.id,
        project_name: project.name,
        mission_id: task.missionId,
        task_id: task.id,
        agent_role: task.agentRole,
        priority: task.priority,
        attempts: task.attempts + 1
      }
    } satisfies ExecutorDispatchPayload)
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(`Executor returned invalid JSON (${response.status})`);
    }
  }

  if (!response.ok) {
    const message = typeof parsed === "object" && parsed !== null && "error" in parsed ? String((parsed as Record<string, unknown>).error) : response.statusText;
    throw new Error(`Executor dispatch failed (${response.status}): ${message || "unknown error"}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Executor returned an empty job payload");
  }

  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.task_id !== "string" ||
    typeof candidate.executor_type !== "string" ||
    typeof candidate.status !== "string" ||
    typeof candidate.workspace_path !== "string" ||
    typeof candidate.branch_name !== "string"
  ) {
    throw new Error("Executor returned an incomplete job payload");
  }

  return {
    id: candidate.id,
    task_id: candidate.task_id,
    executor_type: candidate.executor_type,
    status: candidate.status,
    workspace_path: candidate.workspace_path,
    branch_name: candidate.branch_name,
    log_path: typeof candidate.log_path === "string" ? candidate.log_path : null,
    artifact_summary: typeof candidate.artifact_summary === "string" ? candidate.artifact_summary : null,
    started_at: typeof candidate.started_at === "string" ? candidate.started_at : null,
    completed_at: typeof candidate.completed_at === "string" ? candidate.completed_at : null,
    payload: typeof candidate.payload === "object" && candidate.payload !== null ? (candidate.payload as Record<string, unknown>) : null
  };
}

async function updateTaskAfterDispatchFailure(
  task: ProjectWithRelations["missions"][number]["tasks"][number],
  attempts: number,
  message: string
): Promise<void> {
  const status = taskStatusFromDispatchFailure(attempts);
  const blockerReason = status === "blocked" ? buildDispatchBlockerReason(message) : null;

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status,
        blockerReason
      }
    });

    if (status === "blocked" && blockerReason) {
      await upsertOpenTaskBlocker(tx, task, buildBlockedTaskDraft(task, message, { source: "dispatch_failure", attempts }));
    }
  });
}

async function persistDispatchedJob(
  project: ProjectWithRelations,
  task: ProjectWithRelations["missions"][number]["tasks"][number],
  executorJob: ExecutorJobRecord,
  attempts: number
): Promise<ProjectJobSummary> {
  const jobStatus = mapExecutorJobStatus(executorJob.status);
  const taskStatus = taskStatusFromJobStatus(jobStatus, attempts, task.agentRole);
  const startedAt = parseDate(executorJob.started_at) ?? new Date();
  const completedAt = jobStatus === "queued" || jobStatus === "running" ? null : parseDate(executorJob.completed_at) ?? startedAt;

  const createdJob = await prisma.job.create({
    data: {
      id: executorJob.id,
      taskId: task.id,
      executorType: executorJob.executor_type,
      workspacePath: executorJob.workspace_path,
      branchName: executorJob.branch_name,
      status: jobStatus,
      logPath: executorJob.log_path ?? null,
      artifactSummary: executorJob.artifact_summary ?? null,
      startedAt,
      completedAt
    }
  });

  const blockerReason = taskStatus === "blocked" ? buildDispatchBlockerReason(`Executor reported job status ${jobStatus}`) : null;

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: taskStatus,
        blockerReason
      }
    });

    if (taskStatus === "blocked" && blockerReason) {
      await upsertOpenTaskBlocker(
        tx,
        task,
        buildBlockedTaskDraft(task, `Executor reported job status ${jobStatus}`, {
          source: "executor_outcome",
          attempts,
          jobStatus
        })
      );
    }
  });

  return toProjectJobSummary(createdJob);
}

async function dispatchTaskFromProject(
  project: ProjectWithRelations,
  task: ProjectWithRelations["missions"][number]["tasks"][number]
): Promise<DispatchTaskResult> {
  if (!isDispatchableTaskRole(task.agentRole)) {
    throw new ProjectDispatchError("invalid_task_role", buildInvalidTaskRoleMessage(task.agentRole), 400);
  }

  if (!isDispatchableTaskStatus(task.status)) {
    throw new ProjectDispatchError("task_not_dispatchable", buildTaskNotDispatchableMessage(task.id, task.status), 409);
  }

  const attempts = task.attempts + 1;
  await prisma.task.update({
    where: { id: task.id },
    data: {
      attempts: {
        increment: 1
      }
    }
  });

  try {
    const executorJob = await submitTaskToExecutor(project, task);
    const job = await persistDispatchedJob(project, task, executorJob, attempts);
    const hydratedProject = await loadProjectById(project.id);
    if (!hydratedProject) {
      throw new ProjectDispatchError("project_not_found", "Project not found after dispatch", 404);
    }

    return {
      project: hydratedProject,
      job
    };
  } catch (error) {
    if (error instanceof ProjectDispatchError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Executor dispatch failed";
    await updateTaskAfterDispatchFailure(task, attempts, message);
    throw new ProjectDispatchError("executor_unavailable", message, 503);
  }
}

export async function dispatchTask(projectId: string, taskId: string): Promise<DispatchTaskResult> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectDispatchError("project_not_found", "Project not found", 404);
  }

  const task = dispatchableTaskForProject(project, taskId);
  if (!task) {
    throw new ProjectDispatchError("task_not_found", "Task not found", 404);
  }

  return dispatchTaskFromProject(project, task);
}

export async function advanceProject(projectId: string): Promise<DispatchTaskResult> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectDispatchError("project_not_found", "Project not found", 404);
  }

  const task = nextDispatchableTaskForProject(project);
  if (!task) {
    throw new ProjectDispatchError("no_dispatchable_task", buildNoDispatchableTaskMessage(projectId), 409);
  }

  return dispatchTaskFromProject(project, task);
}

export async function dispatchFirstImplementerTask(projectId: string): Promise<DispatchTaskResult> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectDispatchError("project_not_found", "Project not found", 404);
  }

  const task = firstImplementerTask(project);
  if (!task) {
    throw new ProjectDispatchError("task_not_found", "No implementer task found", 404);
  }

  return dispatchTaskFromProject(project, task);
}

export async function resolveProjectBlocker(projectId: string, blockerId: string): Promise<ProjectDetailResponse> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true }
  });

  if (!project) {
    throw new ProjectBlockerError("project_not_found", "Project not found", 404);
  }

  const blocker = await prisma.blocker.findFirst({
    where: {
      id: blockerId,
      task: {
        mission: {
          projectId
        }
      }
    }
  });

  if (!blocker) {
    throw new ProjectBlockerError("blocker_not_found", "Blocker not found", 404);
  }

  await prisma.$transaction(async (tx) => {
    if (blocker.status !== "resolved") {
      await tx.blocker.update({
        where: { id: blocker.id },
        data: {
          status: "resolved",
          resolvedAt: blocker.resolvedAt ?? new Date()
        }
      });
    }

    const remainingOpenBlockers = await tx.blocker.count({
      where: {
        taskId: blocker.taskId,
        status: "open",
        id: {
          not: blocker.id
        }
      }
    });

    if (remainingOpenBlockers === 0) {
      await tx.task.update({
        where: { id: blocker.taskId },
        data: {
          blockerReason: null
        }
      });
    }
  });

  const updatedProject = await loadProjectById(projectId);
  if (!updatedProject) {
    throw new ProjectBlockerError("project_not_found", "Project not found", 404);
  }

  return { project: updatedProject };
}

function findProjectBlocker(
  project: ProjectWithRelations,
  blockerId: string
): { blocker: DbBlocker; task: ProjectWithRelations["missions"][number]["tasks"][number]; mission: ProjectWithRelations["missions"][number] } | null {
  for (const mission of project.missions) {
    for (const task of mission.tasks) {
      const blocker = task.blockers.find((candidate) => candidate.id === blockerId);
      if (blocker) {
        return { blocker, task, mission };
      }
    }
  }

  return null;
}

function buildGitHubIssueTitle(project: ProjectWithRelations, task: ProjectWithRelations["missions"][number]["tasks"][number], blocker: DbBlocker): string {
  return `[yeet2] ${project.name}: ${blocker.title || task.title}`;
}

export async function createProjectBlockerGitHubIssue(projectId: string, blockerId: string): Promise<ProjectDetailResponse> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectGitHubIssueError("project_not_found", "Project not found", 404);
  }

  const located = findProjectBlocker(project, blockerId);
  if (!located) {
    throw new ProjectGitHubIssueError("blocker_not_found", "Blocker not found", 404);
  }

  const { blocker, task, mission } = located;
  if (blocker.githubIssueNumber != null || blocker.githubIssueUrl) {
    const refreshedProject = await loadProjectById(projectId);
    if (!refreshedProject) {
      throw new ProjectGitHubIssueError("project_not_found", "Project not found", 404);
    }

    return { project: refreshedProject };
  }

  if (!project.repoUrl) {
    throw new ProjectGitHubIssueError("invalid_repo_url", "Project repoUrl must point to a GitHub repository.", 400);
  }

  const repository = parseGitHubRepositoryUrl(project.repoUrl);
  if (!repository) {
    throw new ProjectGitHubIssueError("invalid_repo_url", "Project repoUrl must point to a GitHub repository.", 400);
  }

  try {
    const issue = await createGitHubIssue({
      token: process.env.GITHUB_TOKEN,
      repository,
      title: buildGitHubIssueTitle(project, task, blocker),
      body: buildGitHubIssueBody({
        project: {
          id: project.id,
          name: project.name,
          defaultBranch: project.defaultBranch,
          localPath: project.localPath,
          repoUrl: project.repoUrl
        },
        mission: {
          id: mission.id,
          title: mission.title
        },
        task: {
          id: task.id,
          title: task.title,
          agentRole: task.agentRole
        },
        blocker: {
          id: blocker.id,
          title: blocker.title,
          context: blocker.context,
          options: normalizeBlockerOptions(blocker.options),
          recommendation: blocker.recommendation ?? null
        }
      })
    });

    await prisma.blocker.update({
      where: { id: blocker.id },
      data: {
        githubIssueNumber: issue.number,
        githubIssueUrl: issue.htmlUrl
      }
    });
  } catch (error) {
    if (error instanceof GitHubIssueError) {
      throw new ProjectGitHubIssueError(
        error.code === "missing_token"
          ? "github_not_configured"
          : error.code === "invalid_repository_url"
            ? "invalid_repo_url"
            : "github_issue_failed",
        error.message,
        error.statusCode
      );
    }

    throw new ProjectGitHubIssueError("github_issue_failed", error instanceof Error ? error.message : "Unable to create GitHub issue", 502);
  }

  const updatedProject = await loadProjectById(projectId);
  if (!updatedProject) {
    throw new ProjectGitHubIssueError("project_not_found", "Project not found", 404);
  }

  return { project: updatedProject };
}

async function persistPlannedMission(project: ProjectWithRelations, draft: PlanningDraft): Promise<void> {
  const missionTitle = draft.mission.title.trim() || "Initial mission";
  const missionObjective = draft.mission.objective.trim() || "Translate the constitution into an actionable project plan.";
  const createdBy = draft.mission.createdBy;

  const existingMission = project.missions[0] ?? null;
  if (existingMission && existingMission.tasks.length > 0) {
    return;
  }

  if (existingMission && existingMission.tasks.length === 0) {
    await prisma.task.createMany({
      data: draft.tasks.map((task) => ({
        missionId: existingMission.id,
        title: task.title,
        description: task.description,
        agentRole: task.agentRole,
        status: task.status,
        priority: task.priority,
        acceptanceCriteria: task.acceptanceCriteria,
        attempts: task.attempts,
        blockerReason: task.blockerReason
      }))
    });
    return;
  }

  await prisma.mission.create({
    data: {
      projectId: project.id,
      title: missionTitle,
      objective: missionObjective,
      status: draft.mission.status,
      createdBy,
      startedAt: new Date(),
      tasks: {
        create: draft.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          agentRole: task.agentRole,
          status: task.status,
          priority: task.priority,
          acceptanceCriteria: task.acceptanceCriteria,
          attempts: task.attempts,
          blockerReason: task.blockerReason
        }))
      }
    }
  });
}

async function getProjectWithRelations(projectId: string): Promise<ProjectWithRelations | null> {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      constitution: true,
      missions: {
        include: {
          tasks: {
            include: {
              jobs: true,
              blockers: true
            }
          }
        },
        orderBy: {
          startedAt: "desc"
        }
      }
    }
  });
}

export async function listRegisteredProjects(): Promise<ProjectListResponse> {
  return {
    projects: await loadProjects()
  };
}

export async function getRegisteredProject(projectId: string): Promise<ProjectDetailResponse> {
  const project = await loadProjectById(projectId);
  return { project };
}

export async function registerProject(input: ProjectRegistrationInput): Promise<ProjectSummary> {
  const registration = await resolveProjectRegistration(input);
  const inspection = await inspectConstitution(registration.localPath);
  const constitutionData = buildConstitutionData(inspection);

  const existing = await prisma.project.findFirst({
    where: {
      localPath: inspection.repoRoot
    }
  });

  const project = existing
    ? await prisma.project.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          repoUrl: registration.repoUrl ?? existing.repoUrl ?? null,
          defaultBranch: input.defaultBranch,
          localPath: inspection.repoRoot,
          constitutionStatus: inspection.status,
          constitution: {
            upsert: {
              create: constitutionData,
              update: constitutionData
            }
          }
        }
      })
    : await prisma.project.create({
        data: {
          name: input.name,
          repoUrl: registration.repoUrl,
          defaultBranch: input.defaultBranch,
          localPath: inspection.repoRoot,
          constitutionStatus: inspection.status,
          constitution: {
            create: constitutionData
          }
        }
      });

  const hydrated = await getProjectWithRelations(project.id);
  if (!hydrated) {
    return {
      id: project.id,
      name: project.name,
      repoUrl: project.repoUrl ?? "",
      defaultBranch: project.defaultBranch,
      localPath: project.localPath,
      constitutionStatus: inspection.status,
      constitution: inspection,
      missions: [],
      dispatchableRoles: [...DISPATCHABLE_TASK_ROLES],
      nextDispatchableTaskId: null,
      nextDispatchableTaskRole: null,
      activeMissionCount: 0,
      activeTaskCount: 0,
      blockerCount: 0,
      blockers: [],
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    };
  }

  return toProjectSummary(hydrated, inspection);
}

export async function planProject(projectId: string): Promise<ProjectSummary | null> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    return null;
  }

  const currentSummary = await hydrateProject(project);
  if (isPlanningComplete(currentSummary.missions)) {
    return currentSummary;
  }

  const inspection = await inspectProjectConstitution(project);
  const planningContext = await loadPlanningContext(asProjectInput(project), inspection);
  const context = await createInitialPlan(planningContext);

  await persistPlannedMission(project, context);
  return loadProjectById(projectId);
}
