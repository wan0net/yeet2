import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
import {
  PIPELINE_TEMPLATES,
  RECOMMENDED_ROLE_MODELS,
  type GlobalBlockerQueueItem,
  type GlobalJobQueueItem,
  type GlobalMissionQueueItem,
  type GlobalTaskQueueItem,
  type ProjectChatMessageSummary,
  type ProjectCostAnalysisSummary,
  type ProjectApprovalQueueItem,
  type OperatorGuidanceSummary,
  type PlanningProvenance,
  type ProjectApprovalAction,
  type ProjectDecisionLogSummary,
  type ProjectBranchCleanupMode,
  type ProjectBranchCleanupState,
  type ProjectAutonomyMode,
  type ProjectMergeApprovalMode,
  type ProjectPullRequestDraftMode,
  type ProjectPullRequestMode,
  type ProjectRoleKey
} from "@yeet2/domain";

import { prisma } from "./db";
import { listProjectDecisionLogs, loadRecentActionableGuidance, loadRecentDecisionLogs, loadRecentOperatorGuidance, recordDecisionLog } from "./decision-logs";
import { getGitHubToken } from "./settings";
import {
  buildGitHubCompareUrl,
  buildGitHubPullRequestBody,
  buildGitHubIssueBody,
  createGitHubIssue,
  createGitHubPullRequest,
  createGitHubTaskIssue,
  commentOnGitHubIssue,
  closeGitHubIssue,
  ensureGitHubLabels,
  deleteGitHubBranchRef,
  fetchGitHubPullRequest,
  mergeGitHubPullRequest,
  parseGitHubRepositoryUrl,
  GitHubIssueError,
  GitHubPullRequestError,
  type GitHubPullRequestDetails
} from "./github";
import { inspectConstitution, type ConstitutionInspection } from "./constitution";
import { buildFallbackModelCatalog, fetchOpenRouterModelCatalog, OpenRouterModelCatalogError } from "./openrouter-models";
import { createInitialPlan, createTaskStageBrief, loadPlanningContext, readBrainJson, type PlanningDraft, type PlanningProject } from "./planning";

let _cachedGitHubToken: string | null | undefined;
let _cachedGitHubTokenAt = 0;

async function resolveGitHubToken(): Promise<string | null> {
  const now = Date.now();
  if (_cachedGitHubToken !== undefined && now - _cachedGitHubTokenAt < 30_000) {
    return _cachedGitHubToken;
  }
  _cachedGitHubToken = await getGitHubToken();
  _cachedGitHubTokenAt = now;
  return _cachedGitHubToken;
}

async function syncGitHubTaskIssue(options: {
  project: { id: string; githubRepoOwner: string | null; githubRepoName: string | null; githubProjectSync: boolean; name: string };
  task: { id: string; title: string; description: string; agentRole: string; githubIssueNumber?: number | null; githubIssueNodeId?: string | null };
  event: "created" | "dispatched" | "completed" | "blocked" | "failed";
  detail?: string;
}): Promise<void> {
  if (!options.project.githubProjectSync) return;
  const token = await resolveGitHubToken();
  if (!token) return;
  const owner = options.project.githubRepoOwner;
  const repo = options.project.githubRepoName;
  if (!owner || !repo) return;

  try {
    const { task, event, detail } = options;
    if (event === "created") {
      await ensureGitHubLabels({
        token,
        owner,
        repo,
        labels: [
          { name: "yeet2", color: "0075ca" },
          { name: `yeet2:${task.agentRole}`, color: "0075ca" }
        ]
      });
      const result = await createGitHubTaskIssue({
        token,
        owner,
        repo,
        title: `[${task.agentRole}] ${task.title}`,
        body: task.description,
        labels: ["yeet2", `yeet2:${task.agentRole}`]
      });
      await prisma.task.update({
        where: { id: task.id },
        data: { githubIssueNumber: result.number, githubIssueNodeId: result.nodeId }
      });
    } else if (event === "dispatched") {
      if (task.githubIssueNumber == null) return;
      await commentOnGitHubIssue({
        token,
        owner,
        repo,
        issueNumber: task.githubIssueNumber,
        body: `🚀 **${task.agentRole}** is starting work on this task.`
      });
    } else if (event === "completed") {
      if (task.githubIssueNumber == null) return;
      await commentOnGitHubIssue({
        token,
        owner,
        repo,
        issueNumber: task.githubIssueNumber,
        body: `✅ Task completed.\n\n${detail || ""}`
      });
      await closeGitHubIssue({ token, owner, repo, issueNumber: task.githubIssueNumber });
    } else if (event === "blocked") {
      if (task.githubIssueNumber == null) return;
      await commentOnGitHubIssue({
        token,
        owner,
        repo,
        issueNumber: task.githubIssueNumber,
        body: `🔴 Task blocked.\n\n${detail || ""}`
      });
    } else if (event === "failed") {
      if (task.githubIssueNumber == null) return;
      await commentOnGitHubIssue({
        token,
        owner,
        repo,
        issueNumber: task.githubIssueNumber,
        body: `❌ Task failed.\n\n${detail || ""}`
      });
    }
  } catch {
    // GitHub sync failures must never propagate to callers
  }
}

export interface ProjectRegistrationInput {
  name: string;
  repoUrl?: string | null;
  defaultBranch: string;
  localPath?: string | null;
  pipelineTemplate?: string | null;
}

export type ProjectTaskStatus = DbTask["status"];
export type ProjectJobStatus = DbJob["status"];

export interface ProjectJobSummary {
  id: string;
  taskId: string;
  executorType: string;
  workerId: string | null;
  assignedRoleDefinitionId: string | null;
  assignedRoleDefinitionLabel: string | null;
  assignedRoleDefinitionModel: string | null;
  workspacePath: string;
  branchName: string;
  githubCompareUrl: string | null;
  githubPrNumber: number | null;
  githubPrUrl: string | null;
  githubPrTitle: string | null;
  githubPrState: "open" | "closed" | "merged" | null;
  githubPrDraft: boolean | null;
  githubPrMergedAt: string | null;
  githubBranchCleanupState: ProjectBranchCleanupState;
  githubBranchDeletedAt: string | null;
  status: ProjectJobStatus;
  logPath: string | null;
  artifactSummary: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ProjectRoleDefinitionSummary {
  id: string;
  projectId: string;
  roleKey: ProjectRoleKey;
  visualName: string;
  label: string;
  goal: string;
  backstory: string;
  model: string | null;
  recommendedModel: string | null;
  effectiveModel: string | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCostAnalysisResponse extends ProjectCostAnalysisSummary {}

export interface ProjectApprovalQueueResponse {
  approvals: ProjectApprovalQueueItem[];
}

export interface GlobalJobQueueResponse {
  jobs: GlobalJobQueueItem[];
}

export interface GlobalBlockerQueueResponse {
  blockers: GlobalBlockerQueueItem[];
}

export interface GlobalTaskQueueResponse {
  tasks: GlobalTaskQueueItem[];
}

export interface GlobalMissionQueueResponse {
  missions: GlobalMissionQueueItem[];
}

export interface ProjectTaskSummary {
  id: string;
  missionId: string;
  title: string;
  description: string;
  agentRole: string;
  assignedRoleDefinitionId: string | null;
  assignedRoleDefinitionLabel: string | null;
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
  planningProvenance: PlanningProvenance | null;
  startedAt: string | null;
  completedAt: string | null;
  tasks: ProjectTaskSummary[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  repoUrl: string;
  githubRepoOwner: string | null;
  githubRepoName: string | null;
  githubRepoUrl: string | null;
  roleDefinitions: ProjectRoleDefinitionSummary[];
  autonomyMode: ProjectAutonomyMode;
  pullRequestMode: ProjectPullRequestMode;
  pullRequestDraftMode: ProjectPullRequestDraftMode;
  mergeApprovalMode: ProjectMergeApprovalMode;
  branchCleanupMode: ProjectBranchCleanupMode;
  githubProjectSync: boolean;
  lastAutonomyRunAt: string | null;
  lastAutonomyStatus: string | null;
  lastAutonomyMessage: string | null;
  lastAutonomyActor: string | null;
  nextAutonomyRunAt: string | null;
  defaultBranch: string;
  localPath: string;
  constitutionStatus: ConstitutionInspection["status"];
  constitution: ConstitutionInspection;
  decisionLogs: ProjectDecisionLogSummary[];
  operatorGuidance: OperatorGuidanceSummary[];
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

export interface ProjectPullRequestResult {
  project: ProjectSummary;
  job: ProjectJobSummary;
  created: boolean;
  merged?: boolean;
}

export interface ProjectApprovalResult {
  project: ProjectSummary;
  action: ProjectApprovalAction;
  job?: ProjectJobSummary;
}

export interface ProjectJobLogResult {
  jobId: string;
  logPath: string | null;
  content: string;
  truncated: boolean;
}

export interface ProjectJobRefreshResult {
  project: ProjectSummary;
  job: ProjectJobSummary;
}

export interface ProjectActiveJobRefreshResult {
  project: ProjectSummary;
  refreshedJobIds: string[];
}

export interface ProjectChatQuery {
  take?: number;
  actor?: string | null;
  mention?: string | null;
  replyToId?: string | null;
  actionableOnly?: boolean;
}

export interface ProjectRoleDefinitionInput {
  roleKey: ProjectRoleKey;
  visualName: string;
  label: string;
  goal: string;
  backstory: string;
  model: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface ProjectChatResponse {
  messages: ProjectChatMessageSummary[];
}

export interface ProjectAutonomyUpdateInput {
  autonomyMode: ProjectAutonomyMode;
  pullRequestMode?: ProjectPullRequestMode;
  pullRequestDraftMode?: ProjectPullRequestDraftMode;
  mergeApprovalMode?: ProjectMergeApprovalMode;
  branchCleanupMode?: ProjectBranchCleanupMode;
}

export interface ProjectAutonomyRunUpdateInput {
  lastAutonomyRunAt: Date;
  lastAutonomyStatus: string;
  lastAutonomyMessage?: string | null;
  lastAutonomyActor?: string | null;
  nextAutonomyRunAt?: Date | null;
}

interface ProjectMessageInput {
  content: string;
  replyToId?: string | null;
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

export class ProjectPullRequestError extends Error {
  constructor(
    public readonly code:
      | "project_not_found"
      | "job_not_found"
      | "invalid_repo_url"
      | "missing_branch_name"
      | "github_not_configured"
      | "github_pull_request_failed",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProjectPullRequestError";
  }
}

export class ProjectJobLogError extends Error {
  constructor(
    public readonly code: "project_not_found" | "job_not_found" | "log_not_found" | "log_read_failed",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProjectJobLogError";
  }
}

export class ProjectJobRefreshError extends Error {
  constructor(
    public readonly code: "project_not_found" | "job_not_found" | "executor_unavailable" | "job_not_active",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProjectJobRefreshError";
  }
}

export class ProjectApprovalError extends Error {
  constructor(
    public readonly code: "project_not_found" | "blocker_not_found",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProjectApprovalError";
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

export class ProjectRoleDefinitionError extends Error {
  constructor(
    public readonly code: "project_not_found" | "invalid_role_definition",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProjectRoleDefinitionError";
  }
}

export class ProjectAutonomyError extends Error {
  constructor(
    public readonly code: "project_not_found" | "invalid_autonomy_mode",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProjectAutonomyError";
  }
}

export class ProjectConstitutionError extends Error {
  constructor(
    public readonly code: "project_not_found" | "project_no_local_path" | "invalid_file_key" | "file_read_failed" | "file_write_failed" | "path_traversal",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ProjectConstitutionError";
  }
}

const CONSTITUTION_FILE_PATHS: Record<string, string> = {
  vision: "docs/VISION.md",
  spec: "docs/SPEC.md",
  roadmap: "docs/ROADMAP.md",
  architecture: "docs/ARCHITECTURE.md",
  decisions: "docs/DECISIONS.md",
  qualityBar: "docs/QUALITY_BAR.md"
};

export interface ConstitutionFileReadResult {
  fileKey: string;
  path: string;
  content: string;
  exists: boolean;
}

export interface ConstitutionFileWriteResult {
  fileKey: string;
  path: string;
  written: true;
}

export async function readConstitutionFile(projectId: string, fileKey: string): Promise<ConstitutionFileReadResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new ProjectConstitutionError("project_not_found", "Project not found", 404);
  }
  if (!project.localPath) {
    throw new ProjectConstitutionError("project_no_local_path", "Project has no local path configured", 422);
  }

  const relativePath = CONSTITUTION_FILE_PATHS[fileKey];
  if (!relativePath) {
    throw new ProjectConstitutionError("invalid_file_key", `Invalid file key: ${fileKey}. Must be one of: ${Object.keys(CONSTITUTION_FILE_PATHS).join(", ")}`, 400);
  }

  const localRoot = resolve(project.localPath);
  const absolutePath = resolve(join(localRoot, relativePath));
  if (!absolutePath.startsWith(localRoot + "/") && absolutePath !== localRoot) {
    throw new ProjectConstitutionError("path_traversal", "Resolved path is outside the project directory", 400);
  }

  try {
    const content = await readFile(absolutePath, "utf8");
    return { fileKey, path: relativePath, content, exists: true };
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return { fileKey, path: relativePath, content: "", exists: false };
    }
    throw new ProjectConstitutionError("file_read_failed", `Failed to read file: ${relativePath}`, 500);
  }
}

export async function writeConstitutionFile(projectId: string, fileKey: string, content: string): Promise<ConstitutionFileWriteResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new ProjectConstitutionError("project_not_found", "Project not found", 404);
  }
  if (!project.localPath) {
    throw new ProjectConstitutionError("project_no_local_path", "Project has no local path configured", 422);
  }

  const relativePath = CONSTITUTION_FILE_PATHS[fileKey];
  if (!relativePath) {
    throw new ProjectConstitutionError("invalid_file_key", `Invalid file key: ${fileKey}. Must be one of: ${Object.keys(CONSTITUTION_FILE_PATHS).join(", ")}`, 400);
  }

  const localRoot = resolve(project.localPath);
  const absolutePath = resolve(join(localRoot, relativePath));
  if (!absolutePath.startsWith(localRoot + "/") && absolutePath !== localRoot) {
    throw new ProjectConstitutionError("path_traversal", "Resolved path is outside the project directory", 400);
  }

  try {
    await mkdir(resolve(join(localRoot, "docs")), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  } catch {
    throw new ProjectConstitutionError("file_write_failed", `Failed to write file: ${relativePath}`, 500);
  }

  // Re-inspect constitution and update DB metadata
  try {
    const inspection = await inspectConstitution(localRoot);
    const constitutionData = buildConstitutionData(inspection);
    await prisma.project.update({
      where: { id: projectId },
      data: {
        constitutionStatus: inspection.status,
        constitution: {
          upsert: {
            create: constitutionData,
            update: constitutionData
          }
        }
      }
    });
  } catch {
    // Best-effort: don't fail the write if re-inspection fails
  }

  return { fileKey, path: relativePath, written: true };
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
}

export interface ProjectDetailResponse {
  project: ProjectSummary | null;
}

type ProjectWithRelations = DbProject & {
  constitution?: Constitution | null;
  roleDefinitions: Array<{
    id: string;
    projectId: string;
    roleKey: ProjectRoleKey;
    label: string;
    goal: string;
    backstory: string;
    model: string | null;
    enabled: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  missions: Array<DbMission & { tasks: Array<DbTask & { jobs: DbJob[]; blockers: DbBlocker[] }> }>;
};

type ProjectTaskWithRelations = ProjectWithRelations["missions"][number]["tasks"][number];
type ProjectMissionWithRelations = ProjectWithRelations["missions"][number];
type ProjectRoleDefinitionRecord = ProjectWithRelations["roleDefinitions"][number];

interface ResolvedProjectRegistration {
  localPath: string;
  repoUrl: string | null;
}

const DISPATCHABLE_TASK_ROLES = ["architect", "implementer", "tester", "coder", "qa", "reviewer"] as const;
const DISPATCHABLE_TASK_STATUSES = ["pending", "ready", "failed"] as const;
const MAX_DISPATCH_ATTEMPTS = 2;
const execFileAsync = promisify(execFile);

import { pickCharacters } from "@yeet2/domain";

import { getSetting } from "./settings";

let _cachedTheme: string | null = null;
let _cachedThemeAt = 0;

async function getAgentNameTheme(): Promise<string> {
  const now = Date.now();
  if (_cachedTheme && now - _cachedThemeAt < 30_000) return _cachedTheme;
  try {
    const dbTheme = await getSetting("agent_theme");
    _cachedTheme = dbTheme || process.env.YEET2_AGENT_NAME_THEME?.trim().toLowerCase() || "mythology";
  } catch {
    _cachedTheme = process.env.YEET2_AGENT_NAME_THEME?.trim().toLowerCase() || "mythology";
  }
  _cachedThemeAt = now;
  return _cachedTheme;
}

const PROJECT_ROLE_DEFAULTS: Array<Omit<ProjectRoleDefinitionInput, "sortOrder"> & { sortOrder: number }> = [
  {
    roleKey: "planner",
    visualName: "Planner",
    label: "Planner",
    goal: "Turn the constitution into a crisp project plan.",
    backstory: "You frame the first durable slice and keep the team aligned on direction.",
    model: null,
    enabled: true,
    sortOrder: 0
  },
  {
    roleKey: "architect",
    visualName: "Architect",
    label: "Architect",
    goal: "Define the system boundaries and the highest-risk dependencies.",
    backstory: "You map the shape of the work and reduce uncertainty before implementation starts.",
    model: null,
    enabled: true,
    sortOrder: 1
  },
  {
    roleKey: "implementer",
    visualName: "Implementer",
    label: "Implementer",
    goal: "Plan the approach for the smallest shippable slice of the work.",
    backstory: "You define the strategy and execution plan that the coder will carry out.",
    model: null,
    enabled: true,
    sortOrder: 2
  },
  {
    roleKey: "tester" as ProjectRoleKey,
    visualName: "Tester",
    label: "Tester",
    goal: "Write test cases and acceptance tests based on the implementation plan before code is written.",
    backstory: "You define what success looks like with concrete tests, enabling test-driven development.",
    model: null,
    enabled: true,
    sortOrder: 4
  },
  {
    roleKey: "coder" as ProjectRoleKey,
    visualName: "Coder",
    label: "Coder",
    goal: "Execute the implementation plan by writing, modifying, and testing code in the repository.",
    backstory: "Takes the implementer's plan and turns it into concrete file changes, commits, and verified output.",
    model: null,
    enabled: true,
    sortOrder: 5
  },
  {
    roleKey: "qa",
    visualName: "QA",
    label: "QA",
    goal: "Verify the slice and surface regressions or missing coverage.",
    backstory: "You design checks and acceptance coverage that make the change trustworthy.",
    model: null,
    enabled: true,
    sortOrder: 6
  },
  {
    roleKey: "reviewer",
    visualName: "Reviewer",
    label: "Reviewer",
    goal: "Review the work against the constitution and call out follow-up needs.",
    backstory: "You protect quality and ensure the plan is understandable to operators.",
    model: null,
    enabled: true,
    sortOrder: 7
  },
  {
    roleKey: "visual",
    visualName: "Visual",
    label: "Visual",
    goal: "Assess the user-facing presentation and interaction surface.",
    backstory: "You watch for layout, motion, and visual consistency risks.",
    model: null,
    enabled: true,
    sortOrder: 8
  }
];


function recommendedRoleModel(roleKey: ProjectRoleKey): string | null {
  const envName = `YEET2_ROLE_MODEL_DEFAULT_${roleKey.toUpperCase()}`;
  const configured = normalizeOptionalString(process.env[envName]);
  return configured ?? RECOMMENDED_ROLE_MODELS[roleKey] ?? null;
}

async function loadProjectModelCatalog(project: Pick<ProjectWithRelations, "roleDefinitions">): Promise<{
  models: Awaited<ReturnType<typeof fetchOpenRouterModelCatalog>>;
  degraded: boolean;
  warning: string | null;
}> {
  try {
    return {
      models: await fetchOpenRouterModelCatalog(),
      degraded: false,
      warning: null
    };
  } catch (error) {
    if (!(error instanceof OpenRouterModelCatalogError)) {
      throw error;
    }

    const fallbackModels = [
      ...project.roleDefinitions.map((definition) => definition.model ?? "").filter(Boolean),
      ...project.roleDefinitions.map((definition) => recommendedRoleModel(definition.roleKey)).filter((value): value is string => Boolean(value))
    ];

    return {
      models: buildFallbackModelCatalog(fallbackModels),
      degraded: true,
      warning: error.message
    };
  }
}

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

export function executorBaseUrl(): string {
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

function asProjectInput(
  project: Pick<ProjectWithRelations, "id" | "name" | "repoUrl" | "defaultBranch" | "localPath" | "roleDefinitions" | "missions">
): PlanningProject {
  return {
    id: project.id,
    name: project.name,
    repoUrl: project.repoUrl ?? "",
    defaultBranch: project.defaultBranch,
    localPath: project.localPath,
    missionHistory: [...project.missions]
      .sort((left, right) => (right.startedAt?.getTime() ?? 0) - (left.startedAt?.getTime() ?? 0))
      .map((mission) => {
        const tasks = [...mission.tasks].sort((left, right) => left.priority - right.priority);
        return {
          id: mission.id,
          title: mission.title,
          objective: mission.objective,
          status: mission.status,
          createdBy: mission.createdBy ?? null,
          planningProvenance: planningProvenanceFromCreatedBy(mission.createdBy),
          startedAt: mission.startedAt?.toISOString() ?? null,
          completedAt: mission.completedAt?.toISOString() ?? null,
          taskCount: tasks.length,
          completedTaskCount: tasks.filter((task) => task.status === "complete").length,
          blockedTaskCount: tasks.filter((task) => task.status === "blocked").length,
          tasks: tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            agentRole: task.agentRole as "planner" | "architect" | "implementer" | "qa" | "reviewer" | "visual",
            assignedRoleDefinitionId: (task as DbTask & { assignedRoleDefinitionId?: string | null }).assignedRoleDefinitionId ?? null,
            assignedRoleDefinitionLabel: (task as DbTask & { assignedRoleDefinitionLabel?: string | null }).assignedRoleDefinitionLabel ?? null,
            status: task.status,
            priority: task.priority,
            acceptanceCriteria: Array.isArray(task.acceptanceCriteria)
              ? (task.acceptanceCriteria as unknown[])
                  .filter((value): value is string => typeof value === "string")
                  .map((value) => value.trim())
                  .filter(Boolean)
              : [],
            attempts: task.attempts,
            blockerReason: task.blockerReason ?? null
          }))
        };
      }),
    roleDefinitions: [...project.roleDefinitions]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((definition) => ({
        id: definition.id,
        projectId: definition.projectId,
        roleKey: definition.roleKey,
        visualName: definition.label,
        label: definition.label,
        goal: definition.goal,
        backstory: definition.backstory,
        model: definition.model ?? null,
        recommendedModel: recommendedRoleModel(definition.roleKey) ?? null,
        effectiveModel: definition.model?.trim() || recommendedRoleModel(definition.roleKey) || null,
        enabled: definition.enabled,
        sortOrder: definition.sortOrder,
        createdAt: definition.createdAt.toISOString(),
        updatedAt: definition.updatedAt.toISOString()
      }))
  };
}

function toPrismaRoleDefinition(definition: ProjectRoleDefinitionInput) {
  const { visualName: _, ...rest } = definition;
  return rest;
}

async function defaultProjectRoleDefinitions(projectName?: string, pipelineTemplate?: string | null): Promise<ProjectRoleDefinitionInput[]> {
  const templateKey = pipelineTemplate && PIPELINE_TEMPLATES[pipelineTemplate] ? pipelineTemplate : null;

  if (templateKey && templateKey !== "software") {
    const template = PIPELINE_TEMPLATES[templateKey];
    const theme = await getAgentNameTheme();
    const characters = pickCharacters(theme, template.stages.length, projectName || "default");
    return template.stages.map((stage, index) => {
      const character = characters[index];
      const displayName = character && character.name !== stage.label
        ? `${character.name} (${stage.label})`
        : stage.label;
      const backstory = character?.description
        ? `${character.description}. ${stage.backstory}`
        : stage.backstory;
      return {
        roleKey: stage.roleKey as ProjectRoleKey,
        visualName: displayName,
        label: displayName,
        goal: stage.goal,
        backstory,
        model: null,
        enabled: stage.enabled,
        sortOrder: stage.sortOrder
      };
    });
  }

  const theme = await getAgentNameTheme();
  const characters = pickCharacters(theme, PROJECT_ROLE_DEFAULTS.length, projectName || "default");
  return PROJECT_ROLE_DEFAULTS.map((definition, index) => {
    const character = characters[index];
    const displayName = character && character.name !== definition.label
      ? `${character.name} (${definition.label})`
      : definition.label;
    const backstory = character?.description
      ? `${character.description}. ${definition.backstory}`
      : definition.backstory;
    return {
      roleKey: definition.roleKey,
      visualName: displayName,
      label: displayName,
      goal: definition.goal,
      backstory,
      model: definition.model,
      enabled: definition.enabled,
      sortOrder: definition.sortOrder
    };
  });
}

function toProjectRoleDefinitionSummary(definition: ProjectRoleDefinitionRecord): ProjectRoleDefinitionSummary {
  const recommended = recommendedRoleModel(definition.roleKey) ?? null;
  return {
    id: definition.id,
    projectId: definition.projectId,
    roleKey: definition.roleKey,
    visualName: definition.label,
    label: definition.label,
    goal: definition.goal,
    backstory: definition.backstory,
    model: definition.model,
    recommendedModel: recommended,
    effectiveModel: definition.model?.trim() || recommended,
    enabled: definition.enabled,
    sortOrder: definition.sortOrder,
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString()
  };
}

function normalizeProjectAutonomyMode(value: unknown): ProjectAutonomyMode | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "manual" || normalized === "supervised" || normalized === "autonomous") {
    return normalized;
  }

  return null;
}

function toAutonomySummary(
  project: Pick<
    ProjectWithRelations,
    | "autonomyMode"
    | "pullRequestMode"
    | "pullRequestDraftMode"
    | "mergeApprovalMode"
    | "branchCleanupMode"
    | "lastAutonomyRunAt"
    | "lastAutonomyStatus"
    | "lastAutonomyMessage"
    | "lastAutonomyActor"
    | "nextAutonomyRunAt"
  >
) {
  return {
    autonomyMode: project.autonomyMode ?? "manual",
    pullRequestMode: project.pullRequestMode ?? "manual",
    pullRequestDraftMode: project.pullRequestDraftMode ?? "draft",
    mergeApprovalMode: project.mergeApprovalMode ?? "human_approval",
    branchCleanupMode: project.branchCleanupMode ?? "manual",
    lastAutonomyRunAt: project.lastAutonomyRunAt?.toISOString() ?? null,
    lastAutonomyStatus: project.lastAutonomyStatus ?? null,
    lastAutonomyMessage: project.lastAutonomyMessage ?? null,
    lastAutonomyActor: project.lastAutonomyActor ?? null,
    nextAutonomyRunAt: project.nextAutonomyRunAt?.toISOString() ?? null
  };
}

async function ensureProjectRoleDefinitions(projectId: string, definitions: ProjectRoleDefinitionRecord[]): Promise<ProjectRoleDefinitionRecord[]> {
  if (definitions.length > 0) {
    return definitions;
  }

  await prisma.projectRoleDefinition.createMany({
    data: (await defaultProjectRoleDefinitions()).map((definition) => ({
      projectId,
      ...toPrismaRoleDefinition(definition)
    })) as any,
    skipDuplicates: true
  });

  return prisma.projectRoleDefinition.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" }
  });
}

function planningProvenanceFromCreatedBy(value: string | null | undefined): PlanningProvenance | null {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "crewai" || normalized === "brain" || normalized === "fallback") {
    return normalized;
  }

  if (normalized === "api" || normalized === "system") {
    return "brain";
  }

  return null;
}

function toProjectJobSummary(job: DbJob): ProjectJobSummary {
  const workerId = (job as DbJob & { workerId?: string | null }).workerId ?? null;
  const githubPrState =
    job.githubPrState === "open" || job.githubPrState === "closed" || job.githubPrState === "merged" ? job.githubPrState : null;

  return {
    id: job.id,
    taskId: job.taskId,
    executorType: job.executorType,
    workerId,
    assignedRoleDefinitionId: (job as DbJob & { assignedRoleDefinitionId?: string | null }).assignedRoleDefinitionId ?? null,
    assignedRoleDefinitionLabel: (job as DbJob & { assignedRoleDefinitionLabel?: string | null }).assignedRoleDefinitionLabel ?? null,
    assignedRoleDefinitionModel: (job as DbJob & { assignedRoleDefinitionModel?: string | null }).assignedRoleDefinitionModel ?? null,
    workspacePath: job.workspacePath,
    branchName: job.branchName,
    githubCompareUrl: job.githubCompareUrl ?? null,
    githubPrNumber: job.githubPrNumber ?? null,
    githubPrUrl: job.githubPrUrl ?? null,
    githubPrTitle: job.githubPrTitle ?? null,
    githubPrState,
    githubPrDraft: job.githubPrDraft ?? null,
    githubPrMergedAt: job.githubPrMergedAt?.toISOString() ?? null,
    githubBranchCleanupState:
      job.githubBranchCleanupState === "pending" ||
      job.githubBranchCleanupState === "deleted" ||
      job.githubBranchCleanupState === "retained" ||
      job.githubBranchCleanupState === "failed"
        ? job.githubBranchCleanupState
        : "pending",
    githubBranchDeletedAt: job.githubBranchDeletedAt?.toISOString() ?? null,
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

function roleDefinitionSortKey(definition: ProjectRoleDefinitionRecord): number {
  return definition.sortOrder;
}

function roleDefinitionsForAgentRole(roleDefinitions: ProjectRoleDefinitionRecord[], agentRole: string): ProjectRoleDefinitionRecord[] {
  return [...roleDefinitions]
    .filter((definition) => definition.enabled && definition.roleKey === agentRole)
    .sort((left, right) => roleDefinitionSortKey(left) - roleDefinitionSortKey(right));
}

function resolveAssignedRoleDefinitionForTaskDraft(
  roleDefinitions: ProjectRoleDefinitionRecord[],
  draftTask: PlanningDraft["tasks"][number],
  roleUsageCounts: Map<string, number>
): { assignedRoleDefinitionId: string | null; assignedRoleDefinitionLabel: string | null } {
  if (draftTask.assignedRoleDefinitionId) {
    const byId = roleDefinitions.find((definition) => definition.id === draftTask.assignedRoleDefinitionId) ?? null;
    if (byId) {
      return {
        assignedRoleDefinitionId: byId.id,
        assignedRoleDefinitionLabel: byId.label
      };
    }
  }

  if (draftTask.assignedRoleDefinitionLabel) {
    const normalizedLabel = draftTask.assignedRoleDefinitionLabel.trim().toLowerCase();
    const byLabel = roleDefinitions.find((definition) => definition.label.trim().toLowerCase() === normalizedLabel) ?? null;
    if (byLabel) {
      return {
        assignedRoleDefinitionId: byLabel.id,
        assignedRoleDefinitionLabel: byLabel.label
      };
    }
  }

  const matchingDefinitions = roleDefinitionsForAgentRole(roleDefinitions, draftTask.agentRole);
  if (matchingDefinitions.length === 0) {
    return {
      assignedRoleDefinitionId: null,
      assignedRoleDefinitionLabel: null
    };
  }

  const currentIndex = roleUsageCounts.get(draftTask.agentRole) ?? 0;
  const chosen = matchingDefinitions[currentIndex % matchingDefinitions.length] ?? matchingDefinitions[0];
  roleUsageCounts.set(draftTask.agentRole, currentIndex + 1);

  return {
    assignedRoleDefinitionId: chosen.id,
    assignedRoleDefinitionLabel: chosen.label
  };
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
    assignedRoleDefinitionId: (task as DbTask & { assignedRoleDefinitionId?: string | null }).assignedRoleDefinitionId ?? null,
    assignedRoleDefinitionLabel: (task as DbTask & { assignedRoleDefinitionLabel?: string | null }).assignedRoleDefinitionLabel ?? null,
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
  const planningProvenance = planningProvenanceFromCreatedBy(mission.createdBy);

  return {
    id: mission.id,
    projectId: mission.projectId,
    title: mission.title,
    objective: mission.objective,
    status,
    createdBy: mission.createdBy ?? null,
    planningProvenance,
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

function toProjectSummary(
  project: ProjectWithRelations,
  constitution: ConstitutionInspection,
  roleDefinitions: ProjectRoleDefinitionRecord[],
  decisionLogs: ProjectDecisionLogSummary[],
  operatorGuidance: OperatorGuidanceSummary[]
): ProjectSummary {
  const missions = [...project.missions]
    .sort((left, right) => (right.startedAt?.getTime() ?? 0) - (left.startedAt?.getTime() ?? 0))
    .map(toProjectMissionSummary);
  const blockers = collectProjectBlockers(project);
  const nextDispatchableTask = missions.flatMap((mission) => mission.tasks).find((task) => task.dispatchable) ?? null;
  const sortedRoleDefinitions = [...roleDefinitions].sort((left, right) => roleDefinitionSortKey(left) - roleDefinitionSortKey(right));

  return {
    id: project.id,
    name: project.name,
    repoUrl: project.repoUrl ?? "",
    githubRepoOwner: project.githubRepoOwner ?? null,
    githubRepoName: project.githubRepoName ?? null,
    githubRepoUrl: project.githubRepoUrl ?? null,
    githubProjectSync: project.githubProjectSync ?? false,
    roleDefinitions: sortedRoleDefinitions.map(toProjectRoleDefinitionSummary),
    decisionLogs,
    operatorGuidance,
    ...toAutonomySummary(project),
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
  const roleDefinitions = await ensureProjectRoleDefinitions(project.id, project.roleDefinitions);
  const [decisionLogs, operatorGuidance] = await Promise.all([
    loadRecentDecisionLogs(project.id, 20),
    loadRecentOperatorGuidance(project.id, 6)
  ]);
  return toProjectSummary(project, constitution, roleDefinitions, decisionLogs, operatorGuidance);
}

async function loadProjectById(projectId: string): Promise<ProjectSummary | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      constitution: true,
      roleDefinitions: true,
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
      roleDefinitions: true,
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

function resolveProjectGitHubMetadata(repoUrl: string | null | undefined): {
  githubRepoOwner: string | null;
  githubRepoName: string | null;
  githubRepoUrl: string | null;
} {
  const repository = repoUrl ? parseGitHubRepositoryUrl(repoUrl) : null;
  if (!repository) {
    return {
      githubRepoOwner: null,
      githubRepoName: null,
      githubRepoUrl: null
    };
  }

  return {
    githubRepoOwner: repository.owner,
    githubRepoName: repository.repo,
    githubRepoUrl: `${repository.htmlBaseUrl.replace(/\/+$/g, "")}/${repository.owner}/${repository.repo}`
  };
}

function resolveProjectGitHubCompareUrl(project: ProjectWithRelations, branchName: string): string | null {
  const repository = project.repoUrl ? parseGitHubRepositoryUrl(project.repoUrl) : null;
  if (!repository) {
    return null;
  }

  return buildGitHubCompareUrl({
    repository,
    baseBranch: project.defaultBranch,
    compareBranch: branchName
  });
}

function mapGitHubPullRequestLifecycle(pullRequest: GitHubPullRequestDetails): {
  githubPrState: "open" | "closed" | "merged";
  githubPrDraft: boolean;
  githubPrMergedAt: Date | null;
} {
  const githubPrState = pullRequest.merged ? "merged" : pullRequest.state === "closed" ? "closed" : "open";

  return {
    githubPrState,
    githubPrDraft: pullRequest.draft,
    githubPrMergedAt: pullRequest.mergedAt ? new Date(pullRequest.mergedAt) : null
  };
}

async function resolveJobBranchCleanupState(
  project: Pick<ProjectWithRelations, "branchCleanupMode" | "repoUrl" | "githubRepoUrl">,
  pullRequest: GitHubPullRequestDetails
): Promise<{ githubBranchCleanupState: ProjectBranchCleanupState; githubBranchDeletedAt: Date | null }> {
  if (!pullRequest.merged) {
    return {
      githubBranchCleanupState: "pending",
      githubBranchDeletedAt: null
    };
  }

  if (project.branchCleanupMode !== "after_merge") {
    return {
      githubBranchCleanupState: "retained",
      githubBranchDeletedAt: null
    };
  }

  const repository = resolveProjectGitHubRepository(project);
  const token = await resolveGitHubToken();
  if (!repository || !token) {
    return {
      githubBranchCleanupState: "failed",
      githubBranchDeletedAt: null
    };
  }

  try {
    await deleteGitHubBranchRef({
      token,
      repository,
      branchName: pullRequest.headBranch
    });

    return {
      githubBranchCleanupState: "deleted",
      githubBranchDeletedAt: new Date()
    };
  } catch {
    return {
      githubBranchCleanupState: "failed",
      githubBranchDeletedAt: null
    };
  }
}

async function persistJobPullRequestState(
  jobId: string,
  project: Pick<ProjectWithRelations, "branchCleanupMode" | "repoUrl" | "githubRepoUrl">,
  pullRequest: GitHubPullRequestDetails,
  compareUrl?: string | null
): Promise<void> {
  const branchCleanup = await resolveJobBranchCleanupState(project, pullRequest);

  await prisma.job.update({
    where: { id: jobId },
    data: {
      ...(typeof compareUrl !== "undefined" ? { githubCompareUrl: compareUrl } : {}),
      githubPrNumber: pullRequest.number,
      githubPrUrl: pullRequest.htmlUrl,
      githubPrTitle: pullRequest.title,
      ...mapGitHubPullRequestLifecycle(pullRequest),
      ...branchCleanup
    }
  });
}

function resolveProjectGitHubRepository(project: Pick<ProjectWithRelations, "repoUrl" | "githubRepoUrl">) {
  const repository = project.repoUrl ? parseGitHubRepositoryUrl(project.repoUrl) : null;
  if (repository) {
    return repository;
  }

  return project.githubRepoUrl ? parseGitHubRepositoryUrl(project.githubRepoUrl) : null;
}

function findProjectJob(project: ProjectWithRelations, jobId: string): { task: ProjectTaskWithRelations; job: DbJob } | null {
  for (const mission of project.missions) {
    for (const task of mission.tasks) {
      const job = task.jobs.find((candidate) => candidate.id === jobId);
      if (job) {
        return { task, job };
      }
    }
  }

  return null;
}

function buildProjectPullRequestTitle(task: Pick<ProjectTaskWithRelations, "title">): string {
  return `yeet2: ${task.title}`;
}

function selectProjectPullRequestReviewTask(mission: ProjectMissionWithRelations): ProjectTaskWithRelations | null {
  const sortedTasks = [...mission.tasks].sort((left, right) => left.priority - right.priority);
  return sortedTasks.find((task) => task.agentRole === "reviewer") ?? sortedTasks.find((task) => task.agentRole === "implementer") ?? null;
}

function buildProjectPullRequestReviewBlockerDraft(input: {
  project: Pick<ProjectWithRelations, "id" | "name" | "defaultBranch" | "localPath" | "repoUrl" | "githubRepoUrl" | "pullRequestDraftMode">;
  mission: Pick<ProjectMissionWithRelations, "id" | "title">;
  task: Pick<ProjectTaskWithRelations, "id" | "title" | "agentRole">;
  job: Pick<DbJob, "id" | "branchName" | "githubCompareUrl" | "githubPrNumber" | "githubPrUrl" | "githubPrTitle">;
}): TaskBlockerDraft {
  const prLabel = input.job.githubPrTitle ?? `pull request ${input.job.githubPrNumber ? `#${input.job.githubPrNumber}` : input.job.id}`;
  const prUrl = input.job.githubPrUrl ?? input.job.githubCompareUrl ?? null;
  const branchLine = input.job.branchName ? `- Branch: ${input.job.branchName}` : null;

  return {
    title: `Human review required for ${prLabel}`,
    context: [
      `A pull request was created automatically for mission "${input.mission.title}" (${input.mission.id}).`,
      `The PR should be reviewed by a human before it is merged.`,
      "",
      `- Project: ${input.project.name} (${input.project.id})`,
      `- Review task: ${input.task.title} (${input.task.agentRole})`,
      prUrl ? `- PR URL: ${prUrl}` : "- PR URL: unavailable",
      `- PR title: ${input.job.githubPrTitle ?? "unavailable"}`,
      branchLine ?? "- Branch: unavailable"
    ].join("\n"),
    options: [
      "Review the PR now, confirm it meets the mission goals, and approve or merge it.",
      "Request changes and push follow-up commits to the same branch.",
      "Defer review for now and leave this blocker open until a human is available."
    ],
    recommendation: "Review the PR now so the mission can move forward, or request changes if the implementation needs follow-up."
  };
}

async function ensureProjectPullRequestReviewBlocker(
  project: ProjectWithRelations,
  mission: ProjectMissionWithRelations,
  job: DbJob
): Promise<void> {
  if (project.pullRequestDraftMode !== "ready") {
    return;
  }

  const blockerTask = selectProjectPullRequestReviewTask(mission);
  if (!blockerTask) {
    return;
  }

  const draft = buildProjectPullRequestReviewBlockerDraft({
    project,
    mission,
    task: blockerTask,
    job
  });

  await upsertOpenTaskBlocker(prisma, blockerTask, draft);
}

async function resolveProjectPullRequestReviewBlocker(mission: ProjectMissionWithRelations): Promise<void> {
  const blockerTask = selectProjectPullRequestReviewTask(mission);
  if (!blockerTask) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.blocker.updateMany({
      where: {
        taskId: blockerTask.id,
        status: "open"
      },
      data: {
        status: "resolved",
        resolvedAt: new Date()
      }
    });

    await tx.task.update({
      where: { id: blockerTask.id },
      data: {
        blockerReason: null
      }
    });
  });
}

function missionHasActionableWork(mission: ProjectMissionSummary): boolean {
  return mission.tasks.some((task) => {
    if (task.dispatchable) {
      return true;
    }

    return ["queued", "pending", "ready", "running", "in_progress", "blocked", "failed"].includes(task.status);
  });
}

function missionIsQueuedBacklog(mission: ProjectMissionSummary): boolean {
  return mission.status === "planned" && mission.startedAt === null && missionHasActionableWork(mission);
}

function shouldTopUpMissionBacklog(summary: ProjectSummary): boolean {
  if (summary.missions.some(missionIsQueuedBacklog)) {
    return false;
  }

  const liveMissionCount = summary.missions.filter((mission) => {
    if (mission.status !== "active" && mission.status !== "planned") {
      return false;
    }

    return missionHasActionableWork(mission);
  }).length;

  if (liveMissionCount > 1) {
    return false;
  }

  if (liveMissionCount === 1) {
    return true;
  }

  return summary.nextDispatchableTaskId === null;
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

export function mapExecutorJobStatus(status: unknown): ProjectJobStatus {
  if (status === "completed") {
    return "complete";
  }

  if (status === "queued" || status === "running" || status === "complete" || status === "failed" || status === "cancelled") {
    return status;
  }

  return "queued";
}

export function taskStatusFromJobStatus(status: ProjectJobStatus, attempts: number, role: string): ProjectTaskStatus {
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
  worker_id?: string | null;
  status: string;
  workspace_path: string;
  branch_name: string;
  log_path?: string | null;
  artifact_summary?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  payload?: Record<string, unknown> | null;
}

async function readExecutorJob(jobId: string): Promise<ExecutorJobRecord> {
  const response = await fetch(`${executorBaseUrl()}/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new ProjectJobRefreshError("executor_unavailable", `Executor returned invalid JSON for job ${jobId}`, 502);
    }
  }

  if (response.status === 404) {
    throw new ProjectJobRefreshError("job_not_found", "Executor does not know about this job", 404);
  }

  if (!response.ok || typeof parsed !== "object" || parsed === null) {
    throw new ProjectJobRefreshError(
      "executor_unavailable",
      `Unable to load job ${jobId} from the executor`,
      502
    );
  }

  return parsed as ExecutorJobRecord;
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
  llm_model?: string;
}

interface TaskStageBriefResult {
  instructions: string;
  workingSummary: string;
  handoffTargetRole: string | null;
  successSignals: string[];
  source: string;
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

function assignedRoleDefinitionForTask(
  project: ProjectWithRelations,
  task: ProjectWithRelations["missions"][number]["tasks"][number]
): ProjectRoleDefinitionRecord | null {
  const assignedId = (task as DbTask & { assignedRoleDefinitionId?: string | null }).assignedRoleDefinitionId ?? null;
  if (assignedId) {
    const byId = project.roleDefinitions.find((definition) => definition.id === assignedId) ?? null;
    if (byId) {
      return byId;
    }
  }

  const assignedLabel = (task as DbTask & { assignedRoleDefinitionLabel?: string | null }).assignedRoleDefinitionLabel ?? null;
  if (assignedLabel) {
    const normalized = assignedLabel.trim().toLowerCase();
    const byLabel = project.roleDefinitions.find((definition) => definition.label.trim().toLowerCase() === normalized) ?? null;
    if (byLabel) {
      return byLabel;
    }
  }

  return null;
}

function planningActorName(project: ProjectWithRelations, fallback: string): string {
  const planner = project.roleDefinitions
    .filter((definition) => definition.roleKey === "planner" && definition.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder)[0];
  return planner?.label ?? fallback;
}

function slugifyMention(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function uniqueMentionList(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => (typeof value === "string" ? slugifyMention(value) : "")).filter(Boolean))];
}

function mentionHandle(value: string | null | undefined): string | null {
  const normalized = uniqueMentionList([value])[0];
  return normalized ? `@${normalized}` : null;
}

async function recordWorkflowMessage(input: {
  projectId: string;
  actor: string;
  summary: string;
  mentions?: Array<string | null | undefined>;
  mode?: "working" | "handoff" | "directive";
  missionId?: string | null;
  taskId?: string | null;
  jobId?: string | null;
  replyToId?: string | null;
}): Promise<void> {
  await recordDecisionLog({
    projectId: input.projectId,
    missionId: input.missionId,
    taskId: input.taskId,
    jobId: input.jobId,
    kind: "message",
    actor: input.actor,
    summary: input.summary,
    detail: {
      source: "agent",
      messageMode: input.mode ?? "working",
      mentions: uniqueMentionList(input.mentions ?? []),
      replyToId: input.replyToId ?? null
    }
  });
}

function firstEnabledRoleDefinitionForKey(project: ProjectWithRelations, roleKey: ProjectRoleKey): ProjectRoleDefinitionRecord | null {
  return (
    project.roleDefinitions
      .filter((definition) => definition.roleKey === roleKey && definition.enabled)
      .sort((left, right) => left.sortOrder - right.sortOrder)[0] ?? null
  );
}

function nextPlanningHandoffDefinition(
  project: ProjectWithRelations,
  draft: PlanningDraft
): ProjectRoleDefinitionRecord | null {
  const architect = firstEnabledRoleDefinitionForKey(project, "architect");
  if (architect) {
    return architect;
  }

  const firstTask = draft.tasks[0];
  if (!firstTask) {
    return null;
  }

  return firstEnabledRoleDefinitionForKey(project, firstTask.agentRole as ProjectRoleKey);
}

function nextWorkflowRoleKeyForTask(task: ProjectTaskWithRelations): ProjectRoleKey | null {
  switch (task.agentRole) {
    case "planner":
      return "architect";
    case "architect":
      return "implementer";
    case "implementer":
      return "tester";
    case "tester":
      return "coder";
    case "coder":
      return "qa";
    case "qa":
      return "reviewer";
    case "reviewer":
      return "planner";
    default:
      return null;
  }
}

async function recordTaskOutcomeWorkflowMessage(input: {
  project: ProjectWithRelations;
  task: ProjectTaskWithRelations;
  actor: string;
  taskStatus: ProjectTaskStatus;
  previousTaskStatus?: ProjectTaskStatus | null;
  jobId?: string | null;
  artifactSummary?: string | null;
}): Promise<void> {
  if (input.previousTaskStatus === input.taskStatus) {
    return;
  }

  if (input.taskStatus === "blocked") {
    const planner = firstEnabledRoleDefinitionForKey(input.project, "planner");
    const plannerMention = mentionHandle(planner?.label ?? planner?.roleKey);
    await recordWorkflowMessage({
      projectId: input.project.id,
      missionId: input.task.missionId,
      taskId: input.task.id,
      jobId: input.jobId ?? null,
      actor: input.actor,
      mode: "directive",
      mentions: [planner?.label, planner?.roleKey],
      summary: `${plannerMention ?? "Planner"}, this work is blocked on "${input.task.title}". Re-check the spec, decide the next move, and keep the mission aligned.`
    });
    return;
  }

  if (input.taskStatus !== "complete") {
    return;
  }

  const nextRoleKey = nextWorkflowRoleKeyForTask(input.task);
  const nextDefinition = nextRoleKey ? firstEnabledRoleDefinitionForKey(input.project, nextRoleKey) : null;
  if (!nextDefinition) {
    return;
  }

  const nextMention = mentionHandle(nextDefinition.label) ?? mentionHandle(nextDefinition.roleKey) ?? nextDefinition.label;
  const summarySuffix = input.artifactSummary?.trim() ? ` ${input.artifactSummary.trim()}` : "";
  await recordWorkflowMessage({
    projectId: input.project.id,
    missionId: input.task.missionId,
    taskId: input.task.id,
    jobId: input.jobId ?? null,
    actor: input.actor,
    mode: "handoff",
    mentions: [nextDefinition.label, nextDefinition.roleKey],
    summary: `${nextMention} your turn. "${input.task.title}" is ready for ${nextDefinition.roleKey}.${summarySuffix}`
  });
}

async function recordStageVerdictIfApplicable(input: {
  projectId: string;
  missionId: string;
  taskId: string;
  jobId: string;
  agentRole: string;
  actor: string;
  taskStatus: ProjectTaskStatus;
  previousTaskStatus?: ProjectTaskStatus | null;
  artifactSummary?: string | null;
}): Promise<void> {
  if (input.previousTaskStatus === input.taskStatus) {
    return;
  }

  if (input.agentRole !== "qa" && input.agentRole !== "reviewer") {
    return;
  }

  if (input.taskStatus !== "complete" && input.taskStatus !== "failed" && input.taskStatus !== "blocked") {
    return;
  }

  const verdict = input.taskStatus === "complete" ? "pass" : "fail";
  const summaryPrefix = input.agentRole === "qa" ? "QA verdict" : "Reviewer verdict";
  const summaryBody = input.artifactSummary?.trim() || (verdict === "pass" ? "Accepted." : "Issues found.");

  try {
    await recordDecisionLog({
      projectId: input.projectId,
      missionId: input.missionId,
      taskId: input.taskId,
      jobId: input.jobId,
      kind: "verdict",
      actor: input.actor,
      summary: `${summaryPrefix}: ${verdict}. ${summaryBody}`,
      detail: {
        stage: input.agentRole,
        verdict,
        artifactSummary: input.artifactSummary ?? null
      }
    });
  } catch {
    // Best-effort verdict log only.
  }
}

function guidanceAliasesForTask(
  task: ProjectWithRelations["missions"][number]["tasks"][number],
  assignedRoleDefinition: ProjectRoleDefinitionRecord | null
): Set<string> {
  const aliases = new Set<string>();
  aliases.add(slugifyMention(task.agentRole));

  if (assignedRoleDefinition) {
    aliases.add(slugifyMention(assignedRoleDefinition.label));
    aliases.add(slugifyMention(assignedRoleDefinition.roleKey));
  }

  return aliases;
}

function guidanceForTask(
  task: ProjectWithRelations["missions"][number]["tasks"][number],
  assignedRoleDefinition: ProjectRoleDefinitionRecord | null,
  entries: OperatorGuidanceSummary[]
): OperatorGuidanceSummary[] {
  const aliases = guidanceAliasesForTask(task, assignedRoleDefinition);
  return entries.filter((entry) => entry.mentions.length === 0 || entry.mentions.some((mention) => aliases.has(slugifyMention(mention))));
}

function guidanceForPlanning(project: ProjectWithRelations, entries: OperatorGuidanceSummary[]): OperatorGuidanceSummary[] {
  const aliases = new Set<string>(["planner"]);

  for (const definition of project.roleDefinitions) {
    if (definition.roleKey !== "planner" || !definition.enabled) {
      continue;
    }

    aliases.add(slugifyMention(definition.roleKey));
    aliases.add(slugifyMention(definition.label));
  }

  return entries.filter((entry) => entry.mentions.length === 0 || entry.mentions.some((mention) => aliases.has(slugifyMention(mention))));
}

function guidanceLogDetail(entries: OperatorGuidanceSummary[]): {
  guidanceCount: number;
  guidanceIds: string[];
  guidancePreview: string[];
} {
  return {
    guidanceCount: entries.length,
    guidanceIds: entries.map((entry) => entry.id),
    guidancePreview: entries.map((entry) => entry.content).slice(0, 3)
  };
}

async function buildTaskStageBrief(
  project: ProjectWithRelations,
  task: ProjectWithRelations["missions"][number]["tasks"][number],
  assignedRoleDefinition: ProjectRoleDefinitionRecord | null,
  operatorGuidance: OperatorGuidanceSummary[]
): Promise<TaskStageBriefResult> {
  const mission = project.missions.find((candidate) => candidate.id === task.missionId) ?? null;
  return createTaskStageBrief({
    projectId: project.id,
    projectName: project.name,
    missionId: task.missionId,
    missionTitle: mission?.title ?? "Current mission",
    missionObjective: mission?.objective ?? "",
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description,
    taskAgentRole: task.agentRole,
    taskPriority: task.priority,
    taskAttempts: task.attempts,
    acceptanceCriteria: normalizeAcceptanceCriteria(task.acceptanceCriteria),
    assignedRoleLabel: assignedRoleDefinition?.label ?? null,
    assignedRoleGoal: assignedRoleDefinition?.goal ?? null,
    assignedRoleBackstory: assignedRoleDefinition?.backstory ?? null,
    operatorGuidance
  });
}

function toProjectChatMessageSummary(log: ProjectDecisionLogSummary): ProjectChatMessageSummary | null {
  if (log.kind !== "message") {
    return null;
  }

  const detail = typeof log.detail === "object" && log.detail !== null ? (log.detail as Record<string, unknown>) : {};
  const source =
    typeof detail.source === "string" && (detail.source === "operator" || detail.source === "agent" || detail.source === "system")
      ? detail.source
      : "system";
  const messageMode =
    typeof detail.messageMode === "string" &&
    (detail.messageMode === "working" || detail.messageMode === "handoff" || detail.messageMode === "directive" || detail.messageMode === "comment")
      ? detail.messageMode
      : source === "operator"
        ? "comment"
        : "working";
  const mentions = Array.isArray(detail.mentions)
    ? detail.mentions.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean)
    : [];

  return {
    id: log.id,
    projectId: log.projectId,
    missionId: log.missionId ?? null,
    taskId: log.taskId ?? null,
    jobId: log.jobId ?? null,
    actor: log.actor,
    content: log.summary,
    source,
    messageMode,
    mentions,
    replyToId: typeof detail.replyToId === "string" ? detail.replyToId.trim() || null : null,
    actionable: mentions.length > 0,
    createdAt: log.createdAt
  };
}

async function submitTaskToExecutor(
  project: ProjectWithRelations,
  task: ProjectWithRelations["missions"][number]["tasks"][number],
  stageBrief: TaskStageBriefResult
): Promise<ExecutorJobRecord> {
  const assignedRoleDefinition = assignedRoleDefinitionForTask(project, task);
  const assignedRoleModel = assignedRoleDefinition?.model?.trim() || recommendedRoleModel(assignedRoleDefinition?.roleKey ?? (task.agentRole as ProjectRoleKey)) || null;
  const operatorGuidance = guidanceForTask(task, assignedRoleDefinition, await loadRecentActionableGuidance(project.id, 8)).slice(0, 4);
  const response = await fetch(`${executorBaseUrl()}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      repo_path: project.localPath,
      base_branch: project.defaultBranch,
      task_title: task.title,
      task_description: stageBrief.instructions,
      acceptance_criteria: stageBrief.successSignals,
      task_id: task.id,
      project_id: project.id,
      mission_id: task.missionId,
      agent_role: task.agentRole,
      priority: task.priority,
      attempts: task.attempts + 1,
      ...(assignedRoleModel ? { llm_model: assignedRoleModel } : {}),
      metadata: {
        project_id: project.id,
        project_name: project.name,
        mission_id: task.missionId,
        task_id: task.id,
        agent_role: task.agentRole,
        assigned_role_definition_id: assignedRoleDefinition?.id ?? null,
        assigned_role_definition_label: assignedRoleDefinition?.label ?? null,
        assigned_role_definition_model: assignedRoleModel,
        stage_brief: {
          instructions: stageBrief.instructions,
          working_summary: stageBrief.workingSummary,
          handoff_target_role: stageBrief.handoffTargetRole,
          success_signals: stageBrief.successSignals,
          source: stageBrief.source
        },
        operator_guidance: operatorGuidance.map((entry) => ({
          id: entry.id,
          actor: entry.actor,
          content: entry.content,
          mentions: entry.mentions,
          reply_to_id: entry.replyToId ?? null,
          created_at: entry.createdAt
        })),
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
  const payload = typeof candidate.payload === "object" && candidate.payload !== null ? (candidate.payload as Record<string, unknown>) : null;
  const payloadWorkerId = payload && typeof payload.worker_id === "string" ? payload.worker_id.trim() || null : null;
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
    worker_id: payloadWorkerId,
    status: candidate.status,
    workspace_path: candidate.workspace_path,
    branch_name: candidate.branch_name,
    log_path: typeof candidate.log_path === "string" ? candidate.log_path : null,
    artifact_summary: typeof candidate.artifact_summary === "string" ? candidate.artifact_summary : null,
    started_at: typeof candidate.started_at === "string" ? candidate.started_at : null,
    completed_at: typeof candidate.completed_at === "string" ? candidate.completed_at : null,
    payload
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
  attempts: number,
  stageBrief: TaskStageBriefResult
): Promise<ProjectJobSummary> {
  const jobStatus = mapExecutorJobStatus(executorJob.status);
  const taskStatus = taskStatusFromJobStatus(jobStatus, attempts, task.agentRole);
  const startedAt = parseDate(executorJob.started_at) ?? new Date();
  const completedAt = jobStatus === "queued" || jobStatus === "running" ? null : parseDate(executorJob.completed_at) ?? startedAt;
  const githubCompareUrl = resolveProjectGitHubCompareUrl(project, executorJob.branch_name);
  const workerId = typeof executorJob.worker_id === "string" && executorJob.worker_id.trim() ? executorJob.worker_id.trim() : null;
  const assignedRoleDefinition = assignedRoleDefinitionForTask(project, task);
  const operatorGuidance = await loadRecentActionableGuidance(project.id, 6);

  const createdJob = await prisma.job.create({
    data: {
      id: executorJob.id,
      taskId: task.id,
      executorType: executorJob.executor_type,
      workerId,
      assignedRoleDefinitionId: assignedRoleDefinition?.id ?? null,
      assignedRoleDefinitionLabel: assignedRoleDefinition?.label ?? null,
      assignedRoleDefinitionModel: assignedRoleDefinition?.model ?? null,
      workspacePath: executorJob.workspace_path,
      branchName: executorJob.branch_name,
      githubCompareUrl,
      status: jobStatus,
      logPath: executorJob.log_path ?? null,
      artifactSummary: executorJob.artifact_summary ?? null,
      startedAt,
      completedAt
    } as any
  });
  const createdJobWithAssignment = createdJob as typeof createdJob & {
    assignedRoleDefinitionId?: string | null;
    assignedRoleDefinitionLabel?: string | null;
    assignedRoleDefinitionModel?: string | null;
  };

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

  await recordDecisionLog({
    projectId: project.id,
    missionId: task.missionId,
    taskId: task.id,
    jobId: createdJob.id,
    kind: "dispatch",
    actor: assignedRoleDefinition?.label ?? task.agentRole,
    summary: `Dispatched task "${task.title}" to job ${createdJob.id}${assignedRoleDefinition?.label ? ` as ${assignedRoleDefinition.label}` : ""}`,
    detail: {
      jobStatus,
      branchName: executorJob.branch_name,
      attempts,
      stageBriefSource: stageBrief.source,
      stageBriefWorkingSummary: stageBrief.workingSummary,
      stageBriefHandoffTargetRole: stageBrief.handoffTargetRole,
      ...guidanceLogDetail(operatorGuidance),
      assignedRoleDefinitionId: createdJobWithAssignment.assignedRoleDefinitionId ?? null,
      assignedRoleDefinitionLabel: createdJobWithAssignment.assignedRoleDefinitionLabel ?? null,
      assignedRoleDefinitionModel: createdJobWithAssignment.assignedRoleDefinitionModel ?? null
    }
  });

  await recordWorkflowMessage({
    projectId: project.id,
    missionId: task.missionId,
    taskId: task.id,
    jobId: createdJob.id,
    actor: assignedRoleDefinition?.label ?? task.agentRole,
    mode: "working",
    summary: `${stageBrief.workingSummary} Branch: ${executorJob.branch_name}.`,
    mentions: []
  });

  await recordTaskOutcomeWorkflowMessage({
    project,
    task,
    actor: assignedRoleDefinition?.label ?? task.agentRole,
    taskStatus,
    previousTaskStatus: task.status,
    jobId: createdJob.id,
    artifactSummary: executorJob.artifact_summary ?? null
  });

  await recordStageVerdictIfApplicable({
    projectId: project.id,
    missionId: task.missionId,
    taskId: task.id,
    jobId: createdJob.id,
    agentRole: task.agentRole,
    actor: assignedRoleDefinition?.label ?? task.agentRole,
    taskStatus,
    previousTaskStatus: task.status,
    artifactSummary: executorJob.artifact_summary ?? null
  });

  // GitHub sync — post dispatch comment (fire-and-forget)
  syncGitHubTaskIssue({ project, task, event: "dispatched" }).catch(() => {});

  return toProjectJobSummary(createdJob);
}

async function createProjectJobPullRequest(
  project: ProjectWithRelations,
  task: ProjectWithRelations["missions"][number]["tasks"][number],
  job: DbJob
): Promise<ProjectPullRequestResult> {
  if (job.githubPrNumber !== null || job.githubPrUrl !== null || job.githubPrTitle !== null) {
    const hydratedProject = await loadProjectById(project.id);
    if (!hydratedProject) {
      throw new ProjectPullRequestError("project_not_found", "Project not found", 404);
    }

    const repository = resolveProjectGitHubRepository(project);
    const token = await resolveGitHubToken();
    if (repository && token && job.githubPrNumber !== null) {
      try {
        const pullRequest = await fetchGitHubPullRequest({
          token,
          repository,
          pullRequestNumber: job.githubPrNumber
        });

        await persistJobPullRequestState(job.id, project, pullRequest, job.githubCompareUrl ?? resolveProjectGitHubCompareUrl(project, job.branchName));
      } catch {
        // Keep existing PR metadata readable if GitHub cannot be inspected right now.
      }
    }

    const updatedJob = await prisma.job.findUnique({
      where: { id: job.id }
    });
    if (!updatedJob) {
      throw new ProjectPullRequestError("job_not_found", "Job not found", 404);
    }

    const mission = project.missions.find((candidate) => candidate.id === task.missionId) ?? null;
    if (mission) {
      try {
        await ensureProjectPullRequestReviewBlocker(project, mission, updatedJob);
      } catch {
        // Keep PR reads resilient if blocker persistence is temporarily unavailable.
      }
    }

    await recordDecisionLog({
      projectId: project.id,
      missionId: task.missionId,
      taskId: task.id,
      jobId: job.id,
      kind: "pull_request",
      actor: "api",
      summary: `Refreshed pull request for job ${job.id}`,
      detail: {
        prNumber: updatedJob.githubPrNumber,
        prUrl: updatedJob.githubPrUrl,
        branchName: updatedJob.branchName
      }
    });

    return {
      project: hydratedProject,
      job: toProjectJobSummary(updatedJob),
      created: false
    };
  }

  const repository = resolveProjectGitHubRepository(project);
  if (!repository) {
    throw new ProjectPullRequestError("invalid_repo_url", "Project repoUrl must point to a GitHub repository.", 400);
  }

  const branchName = normalizeOptionalString(job.branchName);
  if (!branchName) {
    throw new ProjectPullRequestError("missing_branch_name", "Job branchName is required before a pull request can be created.", 400);
  }

  const token = await resolveGitHubToken();
  if (!token) {
    throw new ProjectPullRequestError("github_not_configured", "GITHUB_TOKEN is required to create GitHub pull requests.", 503);
  }

  const compareUrl = job.githubCompareUrl ?? resolveProjectGitHubCompareUrl(project, branchName);
  let pullRequest;
  try {
    pullRequest = await createGitHubPullRequest({
      token,
      repository,
      title: buildProjectPullRequestTitle(task),
      body: buildGitHubPullRequestBody({
        project: {
          id: project.id,
          name: project.name,
          defaultBranch: project.defaultBranch,
          localPath: project.localPath,
          repoUrl: project.repoUrl ?? project.githubRepoUrl ?? ""
        },
        task: {
          id: task.id,
          title: task.title,
          agentRole: task.agentRole
        },
        job: {
          id: job.id,
          branchName,
          compareUrl,
          executorType: job.executorType
        }
      }),
      headBranch: branchName,
      baseBranch: project.defaultBranch,
      isDraft: project.pullRequestDraftMode !== "ready"
    });
  } catch (error) {
    if (error instanceof GitHubPullRequestError) {
      if (error.code === "missing_token") {
        throw new ProjectPullRequestError("github_not_configured", error.message, error.statusCode);
      }

      throw new ProjectPullRequestError("github_pull_request_failed", error.message, error.statusCode);
    }

    throw error;
  }

  await persistJobPullRequestState(
    job.id,
    project,
    {
      number: pullRequest.number,
      htmlUrl: pullRequest.htmlUrl,
      title: pullRequest.title,
      draft: project.pullRequestDraftMode !== "ready",
      merged: false,
      mergedAt: null,
      state: "open",
      headBranch: branchName,
      baseBranch: project.defaultBranch
    },
    compareUrl ?? job.githubCompareUrl ?? null
  );

  await recordDecisionLog({
    projectId: project.id,
    missionId: task.missionId,
    taskId: task.id,
    jobId: job.id,
    kind: "pull_request",
    actor: "api",
    summary: `Created pull request for job ${job.id}`,
    detail: {
      prNumber: pullRequest.number,
      prUrl: pullRequest.htmlUrl,
      branchName
    }
  });

  const mission = project.missions.find((candidate) => candidate.id === task.missionId) ?? null;
  if (mission) {
    try {
      await ensureProjectPullRequestReviewBlocker(project, mission, {
        ...job,
        githubPrNumber: pullRequest.number,
        githubPrUrl: pullRequest.htmlUrl,
        githubPrTitle: pullRequest.title
      });
    } catch {
      // The PR was created successfully; blocker refresh is best-effort.
    }
  }

  const hydratedProject = await loadProjectById(project.id);
  if (!hydratedProject) {
    throw new ProjectPullRequestError("project_not_found", "Project not found after pull request creation", 404);
  }

  const updatedJob = await prisma.job.findUnique({
    where: { id: job.id }
  });
  if (!updatedJob) {
    throw new ProjectPullRequestError("job_not_found", "Job not found after pull request creation", 404);
  }

  return {
    project: hydratedProject,
    job: toProjectJobSummary(updatedJob),
    created: true
  };
}

async function mergeProjectJobPullRequest(
  project: ProjectWithRelations,
  task: ProjectWithRelations["missions"][number]["tasks"][number],
  job: DbJob
): Promise<ProjectPullRequestResult> {
  if (!job.githubPrNumber || !job.githubPrUrl) {
    throw new ProjectPullRequestError("github_pull_request_failed", "Job does not have a pull request to merge.", 409);
  }

  const repository = resolveProjectGitHubRepository(project);
  if (!repository) {
    throw new ProjectPullRequestError("invalid_repo_url", "Project repoUrl must point to a GitHub repository.", 400);
  }

  const token = await resolveGitHubToken();
  if (!token) {
    throw new ProjectPullRequestError("github_not_configured", "GITHUB_TOKEN is required to merge GitHub pull requests.", 503);
  }

  let pullRequest = await fetchGitHubPullRequest({
    token,
    repository,
    pullRequestNumber: job.githubPrNumber
  });

  if (pullRequest.draft) {
    throw new ProjectPullRequestError("github_pull_request_failed", "Draft pull requests are never auto-merged.", 409);
  }

  if (!pullRequest.merged) {
    try {
      pullRequest = await mergeGitHubPullRequest({
        token,
        repository,
        pullRequestNumber: pullRequest.number,
        mergeMethod: "squash"
      });
    } catch (error) {
      if (error instanceof GitHubPullRequestError) {
        if (error.code === "missing_token") {
          throw new ProjectPullRequestError("github_not_configured", error.message, error.statusCode);
        }

        throw new ProjectPullRequestError("github_pull_request_failed", error.message, error.statusCode);
      }

      throw error;
    }
  }

  await persistJobPullRequestState(job.id, project, pullRequest, job.githubCompareUrl ?? resolveProjectGitHubCompareUrl(project, job.branchName));

  await recordDecisionLog({
    projectId: project.id,
    missionId: task.missionId,
    taskId: task.id,
    jobId: job.id,
    kind: "merge",
    actor: "api",
    summary: `Merged pull request for job ${job.id}`,
    detail: {
      prNumber: pullRequest.number,
      prUrl: pullRequest.htmlUrl,
      branchName: job.branchName,
      mergedAt: pullRequest.mergedAt ?? null
    }
  });

  const hydratedProject = await loadProjectById(project.id);
  if (!hydratedProject) {
    throw new ProjectPullRequestError("project_not_found", "Project not found after pull request merge", 404);
  }

  const mission = project.missions.find((candidate) => candidate.id === task.missionId) ?? null;
  if (mission) {
    await resolveProjectPullRequestReviewBlocker(mission);
  }

  const mergedJob = await prisma.job.findUnique({
    where: { id: job.id }
  });

  if (!mergedJob) {
    throw new ProjectPullRequestError("job_not_found", "Job not found after pull request merge", 404);
  }

  return {
    project: hydratedProject,
    job: toProjectJobSummary(mergedJob),
    created: false,
    merged: true
  };
}

async function refreshProjectJobPullRequestState(
  project: ProjectWithRelations,
  task: ProjectWithRelations["missions"][number]["tasks"][number],
  job: DbJob
): Promise<ProjectPullRequestResult> {
  const repository = resolveProjectGitHubRepository(project);
  const token = await resolveGitHubToken();
  if (!repository || !token || job.githubPrNumber === null) {
    const hydratedProject = await loadProjectById(project.id);
    if (!hydratedProject) {
      throw new ProjectPullRequestError("project_not_found", "Project not found", 404);
    }

    const refreshedJob = await prisma.job.findUnique({
      where: { id: job.id }
    });
    if (!refreshedJob) {
      throw new ProjectPullRequestError("job_not_found", "Job not found", 404);
    }

    return {
      project: hydratedProject,
      job: toProjectJobSummary(refreshedJob),
      created: false
    };
  }

  let pullRequest: GitHubPullRequestDetails;
  try {
    pullRequest = await fetchGitHubPullRequest({
      token,
      repository,
      pullRequestNumber: job.githubPrNumber
    });
  } catch (error) {
    if (error instanceof GitHubPullRequestError) {
      if (error.code === "missing_token") {
        throw new ProjectPullRequestError("github_not_configured", error.message, error.statusCode);
      }

      throw new ProjectPullRequestError("github_pull_request_failed", error.message, error.statusCode);
    }

    throw error;
  }

  const wasMerged = job.githubPrState === "merged" || job.githubPrMergedAt !== null;
  await persistJobPullRequestState(job.id, project, pullRequest, job.githubCompareUrl ?? resolveProjectGitHubCompareUrl(project, job.branchName));

  if (pullRequest.merged && !wasMerged) {
    const mission = project.missions.find((candidate) => candidate.id === task.missionId) ?? null;
    if (mission) {
      await resolveProjectPullRequestReviewBlocker(mission);
    }

    await recordDecisionLog({
      projectId: project.id,
      missionId: task.missionId,
      taskId: task.id,
      jobId: job.id,
      kind: "merge",
      actor: "github",
      summary: `Detected external merge for job ${job.id}`,
      detail: {
        prNumber: pullRequest.number,
        prUrl: pullRequest.htmlUrl,
        branchName: job.branchName,
        mergedAt: pullRequest.mergedAt ?? null
      }
    });
  }

  const hydratedProject = await loadProjectById(project.id);
  if (!hydratedProject) {
    throw new ProjectPullRequestError("project_not_found", "Project not found after pull request refresh", 404);
  }

  const refreshedJob = await prisma.job.findUnique({
    where: { id: job.id }
  });
  if (!refreshedJob) {
    throw new ProjectPullRequestError("job_not_found", "Job not found after pull request refresh", 404);
  }

  return {
    project: hydratedProject,
    job: toProjectJobSummary(refreshedJob),
    created: false,
    merged: pullRequest.merged
  };
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

  // Compute the new attempt count but only persist it after the executor confirms.
  // This avoids draining the retry budget when the executor is simply unreachable.
  const nextAttempts = task.attempts + 1;
  try {
    const assignedRoleDefinition = assignedRoleDefinitionForTask(project, task);
    const operatorGuidance = guidanceForTask(task, assignedRoleDefinition, await loadRecentActionableGuidance(project.id, 8)).slice(0, 4);
    const stageBrief = await buildTaskStageBrief(project, task, assignedRoleDefinition, operatorGuidance);
    const executorJob = await submitTaskToExecutor(project, task, stageBrief);
    await prisma.task.update({
      where: { id: task.id },
      data: { attempts: { increment: 1 } }
    });
    const job = await persistDispatchedJob(project, task, executorJob, nextAttempts, stageBrief);
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
    await updateTaskAfterDispatchFailure(task, nextAttempts, message);
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

export async function createProjectPullRequest(projectId: string, jobId: string): Promise<ProjectPullRequestResult> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectPullRequestError("project_not_found", "Project not found", 404);
  }

  const match = findProjectJob(project, jobId);
  if (!match) {
    throw new ProjectPullRequestError("job_not_found", "Job not found", 404);
  }

  return createProjectJobPullRequest(project, match.task, match.job);
}

export async function mergeProjectPullRequest(projectId: string, jobId: string): Promise<ProjectPullRequestResult> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectPullRequestError("project_not_found", "Project not found", 404);
  }

  const match = findProjectJob(project, jobId);
  if (!match) {
    throw new ProjectPullRequestError("job_not_found", "Job not found", 404);
  }

  return mergeProjectJobPullRequest(project, match.task, match.job);
}

export async function refreshProjectPullRequestState(projectId: string, jobId: string): Promise<ProjectPullRequestResult> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectPullRequestError("project_not_found", "Project not found", 404);
  }

  const match = findProjectJob(project, jobId);
  if (!match) {
    throw new ProjectPullRequestError("job_not_found", "Job not found", 404);
  }

  return refreshProjectJobPullRequestState(project, match.task, match.job);
}

export async function readProjectJobLog(projectId: string, jobId: string): Promise<ProjectJobLogResult> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectJobLogError("project_not_found", "Project not found", 404);
  }

  const match = findProjectJob(project, jobId);
  if (!match) {
    throw new ProjectJobLogError("job_not_found", "Job not found", 404);
  }

  const logPath = match.job.logPath?.trim() || null;
  if (!logPath) {
    throw new ProjectJobLogError("log_not_found", "Job does not have a log path recorded yet", 404);
  }

  try {
    const raw = await readFile(logPath, "utf8");
    const maxChars = 24_000;
    const truncated = raw.length > maxChars;
    const content = truncated ? raw.slice(-maxChars) : raw;

    return {
      jobId,
      logPath,
      content,
      truncated
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      throw new ProjectJobLogError("log_not_found", "Job log file does not exist on disk", 404);
    }

    throw new ProjectJobLogError("log_read_failed", error instanceof Error ? error.message : "Unable to read job log", 500);
  }
}

export async function refreshProjectJob(projectId: string, jobId: string): Promise<ProjectJobRefreshResult> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectJobRefreshError("project_not_found", "Project not found", 404);
  }

  const match = findProjectJob(project, jobId);
  if (!match) {
    throw new ProjectJobRefreshError("job_not_found", "Job not found", 404);
  }

  const executorJob = await readExecutorJob(jobId);
  const task = match.task;
  const previousTaskStatus = task.status;
  const attempts = task.attempts;
  const jobStatus = mapExecutorJobStatus(executorJob.status);
  const taskStatus = taskStatusFromJobStatus(jobStatus, attempts, task.agentRole);
  const startedAt = parseDate(executorJob.started_at) ?? match.job.startedAt ?? new Date();
  const completedAt = jobStatus === "queued" || jobStatus === "running" ? null : parseDate(executorJob.completed_at) ?? startedAt;
  const blockerReason = taskStatus === "blocked" ? buildDispatchBlockerReason(`Executor reported job status ${jobStatus}`) : null;

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: {
        executorType: executorJob.executor_type,
        workerId: executorJob.worker_id?.trim() || null,
        workspacePath: executorJob.workspace_path,
        branchName: executorJob.branch_name,
        logPath: executorJob.log_path ?? null,
        artifactSummary: executorJob.artifact_summary ?? null,
        status: jobStatus,
        startedAt,
        completedAt
      } as any
    });

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

  await recordTaskOutcomeWorkflowMessage({
    project,
    task,
    actor: match.job.assignedRoleDefinitionLabel ?? task.agentRole,
    taskStatus,
    previousTaskStatus,
    jobId,
    artifactSummary: executorJob.artifact_summary ?? null
  });

  await recordStageVerdictIfApplicable({
    projectId: project.id,
    missionId: task.missionId,
    taskId: task.id,
    jobId,
    agentRole: task.agentRole,
    actor: match.job.assignedRoleDefinitionLabel ?? task.agentRole,
    taskStatus,
    previousTaskStatus,
    artifactSummary: executorJob.artifact_summary ?? null
  });

  // GitHub sync — fire-and-forget based on task outcome
  if (taskStatus === "complete") {
    syncGitHubTaskIssue({ project, task, event: "completed", detail: executorJob.artifact_summary || "" }).catch(() => {});
  } else if (taskStatus === "blocked") {
    syncGitHubTaskIssue({ project, task, event: "blocked", detail: blockerReason || "" }).catch(() => {});
  } else if (taskStatus === "failed") {
    syncGitHubTaskIssue({ project, task, event: "failed" }).catch(() => {});
  }

  const updatedProject = await loadProjectById(projectId);
  if (!updatedProject) {
    throw new ProjectJobRefreshError("project_not_found", "Project not found", 404);
  }

  const updatedJob =
    updatedProject.missions
      .flatMap((mission) => mission.tasks)
      .flatMap((taskEntry) => taskEntry.jobs)
      .find((jobEntry) => jobEntry.id === jobId) ?? null;

  if (!updatedJob) {
    throw new ProjectJobRefreshError("job_not_found", "Job not found after refresh", 404);
  }

  return {
    project: updatedProject,
    job: updatedJob
  };
}

export async function refreshProjectActiveJobs(projectId: string): Promise<ProjectActiveJobRefreshResult> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectJobRefreshError("project_not_found", "Project not found", 404);
  }

  const activeJobs = project.missions
    .flatMap((mission) => mission.tasks.flatMap((task) => task.jobs))
    .filter((job) => job.status === "queued" || job.status === "running");

  const refreshedJobIds: string[] = [];
  for (const job of activeJobs) {
    try {
      await refreshProjectJob(projectId, job.id);
      refreshedJobIds.push(job.id);
    } catch (error) {
      if (error instanceof ProjectJobRefreshError && error.code === "job_not_found") {
        continue;
      }
      throw error;
    }
  }

  const updatedProject = await loadProjectById(projectId);
  if (!updatedProject) {
    throw new ProjectJobRefreshError("project_not_found", "Project not found", 404);
  }

  return {
    project: updatedProject,
    refreshedJobIds
  };
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
          blockerReason: null,
          status: "ready"
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

function buildProjectApprovalRejectionMessage(blocker: DbBlocker, task: ProjectWithRelations["missions"][number]["tasks"][number]): string {
  return `Human review was rejected for blocker "${blocker.title || task.title}". The task remains blocked until the underlying issue is addressed.`;
}

function hasApprovablePullRequestMetadata(job: DbJob): boolean {
  return job.githubPrNumber !== null && job.githubPrUrl !== null && job.githubPrDraft !== true && job.githubPrState !== "closed" && job.githubPrState !== "merged";
}

async function findApprovableImplementerJob(
  project: ProjectWithRelations,
  mission: ProjectMissionWithRelations
): Promise<{ task: ProjectWithRelations["missions"][number]["tasks"][number]; job: DbJob } | null> {
  const repository = resolveProjectGitHubRepository(project);
  const token = await resolveGitHubToken();
  if (!repository || !token) {
    return null;
  }

  const candidates = mission.tasks
    .filter((task) => task.agentRole === "implementer")
    .flatMap((task) =>
      task.jobs
        .filter((job) => job.status === "complete" && hasApprovablePullRequestMetadata(job))
        .map((job) => ({ task, job }))
    )
    .sort((left, right) => jobSortKey(right.job) - jobSortKey(left.job));

  for (const candidate of candidates) {
    if (candidate.job.githubPrNumber === null) {
      continue;
    }

    try {
      const pullRequest = await fetchGitHubPullRequest({
        token,
        repository,
        pullRequestNumber: candidate.job.githubPrNumber
      });

      if (pullRequest.merged || pullRequest.state !== "open" || pullRequest.draft) {
        continue;
      }

      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

function buildGitHubIssueTitle(project: ProjectWithRelations, task: ProjectWithRelations["missions"][number]["tasks"][number], blocker: DbBlocker): string {
  return `[yeet2] ${project.name}: ${blocker.title || task.title}`;
}

function isHumanReviewApprovalBlocker(blocker: Pick<DbBlocker, "title">): boolean {
  return blocker.title.trim().toLowerCase().startsWith("human review required");
}

export async function applyProjectBlockerApproval(
  projectId: string,
  blockerId: string,
  action: ProjectApprovalAction
): Promise<ProjectApprovalResult> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectApprovalError("project_not_found", "Project not found", 404);
  }

  const located = findProjectBlocker(project, blockerId);
  if (!located) {
    throw new ProjectApprovalError("blocker_not_found", "Blocker not found", 404);
  }

  const { blocker, task, mission } = located;
  const actor = "human";

  if (action === "reject") {
    const rejectionMessage = buildProjectApprovalRejectionMessage(blocker, task);

    await prisma.$transaction(async (tx) => {
      await tx.blocker.update({
        where: { id: blocker.id },
        data: {
          status: "dismissed",
          resolvedAt: new Date()
        }
      });

      await tx.task.update({
        where: { id: task.id },
        data: {
          status: "blocked",
          blockerReason: rejectionMessage
        }
      });
    });

    const updatedProject = await loadProjectById(projectId);
    if (!updatedProject) {
      throw new ProjectApprovalError("project_not_found", "Project not found", 404);
    }

    await recordDecisionLog({
      projectId,
      missionId: mission.id,
      taskId: task.id,
      blockerId: blocker.id,
      kind: "approval",
      actor,
      summary: `Rejected blocker "${blocker.title || task.title}"`,
      detail: {
        action,
        blockerId: blocker.id,
        blockerStatus: "dismissed",
        missionId: mission.id,
        taskId: task.id,
        taskStatus: "blocked",
        message: rejectionMessage
      }
    });

    return {
      project: updatedProject,
      action
    };
  }

  await resolveProjectBlocker(projectId, blockerId);
  const resolvedProject = await loadProjectById(projectId);
  if (!resolvedProject) {
    throw new ProjectApprovalError("project_not_found", "Project not found", 404);
  }

  let mergedJob: ProjectJobSummary | undefined;
  let mergeMessage = "No matching implementer PR was available to merge.";

  const approvableJob = await findApprovableImplementerJob(project, mission);
  if (approvableJob) {
    try {
      const merged = await mergeProjectPullRequest(projectId, approvableJob.job.id);
      mergedJob = merged.job;
      mergeMessage = `Merged pull request #${mergedJob.githubPrNumber ?? approvableJob.job.githubPrNumber} for job ${approvableJob.job.id}.`;
    } catch (error) {
      mergeMessage = error instanceof Error ? error.message : "Unable to merge the related pull request.";
    }
  }

  await recordDecisionLog({
    projectId,
    missionId: mission.id,
    taskId: task.id,
    blockerId: blocker.id,
    jobId: mergedJob?.id ?? approvableJob?.job.id ?? null,
    kind: "approval",
    actor,
    summary: `Approved blocker "${blocker.title || task.title}"`,
    detail: {
      action,
      blockerId: blocker.id,
      blockerStatus: "resolved",
      missionId: mission.id,
      taskId: task.id,
      mergedJobId: mergedJob?.id ?? null,
      mergeMessage
    }
  });

  const refreshedProject = mergedJob ? ((await loadProjectById(projectId)) ?? resolvedProject) : resolvedProject;
  return {
    project: refreshedProject,
    action,
    ...(mergedJob ? { job: mergedJob } : {})
  };
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

  const token = await resolveGitHubToken();
  try {
    const issue = await createGitHubIssue({
      token: token ?? undefined,
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

export async function listProjectApprovals(input: { projectId?: string | null; status?: "open" | "resolved" | "dismissed" | "all" | null } = {}): Promise<ProjectApprovalQueueResponse> {
  const blockers = await prisma.blocker.findMany({
    where: {
      ...(input.projectId ? { task: { mission: { projectId: input.projectId } } } : {}),
      ...(input.status && input.status !== "all" ? { status: input.status } : {})
    },
    include: {
      task: {
        include: {
          mission: {
            include: {
              project: true
            }
          }
        }
      }
    },
    orderBy: [
      {
        createdAt: "desc"
      }
    ]
  });

  const approvals = blockers
    .filter(isHumanReviewApprovalBlocker)
    .map((blocker) => ({
      blockerId: blocker.id,
      blockerTitle: blocker.title,
      blockerStatus: blocker.status,
      blockerCreatedAt: blocker.createdAt.toISOString(),
      blockerResolvedAt: blocker.resolvedAt?.toISOString() ?? null,
      blockerContext: blocker.context,
      blockerRecommendation: blocker.recommendation ?? null,
      projectId: blocker.task.mission.project.id,
      projectName: blocker.task.mission.project.name,
      projectRepoUrl: blocker.task.mission.project.repoUrl ?? null,
      projectGitHubUrl: blocker.task.mission.project.githubRepoUrl ?? null,
      missionId: blocker.task.mission.id,
      missionTitle: blocker.task.mission.title,
      taskId: blocker.task.id,
      taskTitle: blocker.task.title,
      taskAgentRole: blocker.task.agentRole as ProjectApprovalQueueItem["taskAgentRole"]
    }))
    .sort((left, right) => {
      const leftOpen = left.blockerStatus === "open";
      const rightOpen = right.blockerStatus === "open";
      if (leftOpen !== rightOpen) {
        return leftOpen ? -1 : 1;
      }

      return right.blockerCreatedAt.localeCompare(left.blockerCreatedAt);
    });

  return { approvals };
}

export async function listGlobalJobs(input: { status?: ProjectJobStatus | "all" | null; projectId?: string | null } = {}): Promise<GlobalJobQueueResponse> {
  const projects = await loadProjects();

  return {
    jobs: projects
      .filter((project) => !input.projectId || project.id === input.projectId)
      .flatMap((project) =>
        project.missions.flatMap((mission) =>
          mission.tasks.flatMap((task) =>
            (task.jobs ?? [])
              .filter((job) => !input.status || input.status === "all" || job.status === input.status)
              .map((job) => ({
                projectId: project.id,
                projectName: project.name,
                projectRepoUrl: project.repoUrl,
                projectGitHubUrl: project.githubRepoUrl,
                missionId: mission.id,
                missionTitle: mission.title,
                taskId: task.id,
                taskTitle: task.title,
                taskAgentRole: task.agentRole as GlobalJobQueueItem["taskAgentRole"],
                taskStatus: task.status as GlobalJobQueueItem["taskStatus"],
                job
              }))
          )
        )
      )
      .sort((left, right) => {
        const leftTime = Date.parse(left.job.completedAt ?? left.job.startedAt ?? "") || 0;
        const rightTime = Date.parse(right.job.completedAt ?? right.job.startedAt ?? "") || 0;
        return rightTime - leftTime;
      })
  };
}

export async function listGlobalBlockers(input: { status?: DbBlocker["status"] | "all" | null; projectId?: string | null } = {}): Promise<GlobalBlockerQueueResponse> {
  const projects = await loadProjects();

  return {
    blockers: projects
      .filter((project) => !input.projectId || project.id === input.projectId)
      .flatMap((project) =>
        project.missions.flatMap((mission) =>
          mission.tasks.flatMap((task) =>
            project.blockers
              .filter((blocker) => blocker.taskId === task.id)
              .filter((blocker) => !input.status || input.status === "all" || blocker.status === input.status)
              .map((blocker) => ({
                projectId: project.id,
                projectName: project.name,
                projectRepoUrl: project.repoUrl,
                projectGitHubUrl: project.githubRepoUrl,
                missionId: mission.id,
                missionTitle: mission.title,
                taskId: task.id,
                taskTitle: task.title,
                blocker: {
                  ...blocker,
                  taskAgentRole: task.agentRole as GlobalBlockerQueueItem["blocker"]["taskAgentRole"]
                }
              }))
          )
        )
      )
      .sort((left, right) => {
        const leftOpen = left.blocker.status === "open";
        const rightOpen = right.blocker.status === "open";
        if (leftOpen !== rightOpen) {
          return leftOpen ? -1 : 1;
        }

        return right.blocker.createdAt.localeCompare(left.blocker.createdAt);
      })
  };
}

export async function listGlobalTasks(input: { status?: ProjectTaskStatus | "all" | null; projectId?: string | null } = {}): Promise<GlobalTaskQueueResponse> {
  const projects = await loadProjects();

  return {
    tasks: projects
      .filter((project) => !input.projectId || project.id === input.projectId)
      .flatMap((project) =>
        project.missions.flatMap((mission) =>
          mission.tasks
            .filter((task) => !input.status || input.status === "all" || task.status === input.status)
            .map((task) => ({
              projectId: project.id,
              projectName: project.name,
              projectRepoUrl: project.repoUrl,
              projectGitHubUrl: project.githubRepoUrl,
              missionId: mission.id,
              missionTitle: mission.title,
              task: {
                ...task,
                agentRole: task.agentRole as GlobalTaskQueueItem["task"]["agentRole"],
                status: task.status as GlobalTaskQueueItem["task"]["status"]
              }
            }))
        )
      )
      .sort((left, right) => {
        if (left.task.priority !== right.task.priority) {
          return right.task.priority - left.task.priority;
        }

        return left.task.title.localeCompare(right.task.title, undefined, { sensitivity: "base" });
      })
  };
}

export async function listGlobalMissions(input: { status?: ProjectMissionSummary["status"] | "all" | null; projectId?: string | null } = {}): Promise<GlobalMissionQueueResponse> {
  const projects = await loadProjects();

  return {
    missions: projects
      .filter((project) => !input.projectId || project.id === input.projectId)
      .flatMap((project) =>
        project.missions
          .filter((mission) => !input.status || input.status === "all" || mission.status === input.status)
          .map((mission) => ({
            projectId: project.id,
            projectName: project.name,
            projectRepoUrl: project.repoUrl,
            projectGitHubUrl: project.githubRepoUrl,
            mission: {
              id: mission.id,
              projectId: mission.projectId,
              title: mission.title,
              objective: mission.objective,
              status: mission.status as GlobalMissionQueueItem["mission"]["status"],
              createdBy: mission.createdBy ?? null,
              planningProvenance: mission.planningProvenance ?? null,
              startedAt: mission.startedAt ?? null,
              completedAt: mission.completedAt ?? null,
              taskCount: mission.tasks.length
            }
          }))
      )
      .sort((left, right) => {
        const leftTime = Date.parse(left.mission.startedAt ?? left.mission.completedAt ?? "") || 0;
        const rightTime = Date.parse(right.mission.startedAt ?? right.mission.completedAt ?? "") || 0;
        return rightTime - leftTime;
      })
  };
}

async function persistPlannedMission(project: ProjectWithRelations, draft: PlanningDraft): Promise<void> {
  const operatorGuidance = guidanceForPlanning(project, await loadRecentActionableGuidance(project.id, 8));
  const missionTitle = draft.mission.title.trim() || "Initial mission";
  const missionObjective = draft.mission.objective.trim() || "Translate the constitution into an actionable project plan.";
  const createdBy = draft.mission.createdBy;

  const queuedBacklogMission = project.missions.find(
    (mission) => mission.status === "planned" && mission.startedAt === null && mission.tasks.length > 0
  );
  if (queuedBacklogMission) {
    return;
  }

  const existingMission = project.missions.find((mission) => mission.tasks.length === 0) ?? project.missions[0] ?? null;
  if (existingMission && existingMission.tasks.length > 0) {
    const hasActionableMission = project.missions.some((mission) =>
      mission.tasks.some((task) => hasActionableTaskWork(task))
    );

    if (hasActionableMission) {
      const createdMission = await prisma.mission.create({
        data: {
          projectId: project.id,
          title: missionTitle,
          objective: missionObjective,
          status: "planned",
          createdBy,
          startedAt: null,
          tasks: {
            create: (() => {
              const roleUsageCounts = new Map<string, number>();
              return draft.tasks.map((task) => ({
                ...resolveAssignedRoleDefinitionForTaskDraft(project.roleDefinitions, task, roleUsageCounts),
                title: task.title,
                description: task.description,
                agentRole: task.agentRole,
                status: task.status,
                priority: task.priority,
                acceptanceCriteria: task.acceptanceCriteria,
                attempts: task.attempts,
                blockerReason: task.blockerReason
              }));
            })()
          }
        },
        select: { id: true, title: true }
      });

      await recordDecisionLog({
        projectId: project.id,
        missionId: createdMission.id,
        kind: "planning",
        actor: planningActorName(project, draft.mission.planningProvenance),
        summary: `Queued backlog mission "${createdMission.title}"`,
        detail: {
          taskCount: draft.tasks.length,
          objective: missionObjective,
          mode: "backlog_top_up",
          ...guidanceLogDetail(operatorGuidance)
        }
      });

      // GitHub sync — create issues for newly created tasks (fire-and-forget)
      if (project.githubProjectSync) {
        const createdTasks = await prisma.task.findMany({ where: { missionId: createdMission.id } });
        await Promise.allSettled(
          createdTasks.map((createdTask) =>
            syncGitHubTaskIssue({ project, task: { ...createdTask, description: createdTask.description ?? "" }, event: "created" })
          )
        );
      }

      const nextDefinition = nextPlanningHandoffDefinition(project, draft);
      const firstTaskTitle = draft.tasks[0]?.title?.trim() || createdMission.title;
      if (nextDefinition) {
        await recordWorkflowMessage({
          projectId: project.id,
          missionId: createdMission.id,
          actor: planningActorName(project, draft.mission.planningProvenance),
          mode: "handoff",
          mentions: [nextDefinition.label, nextDefinition.roleKey],
          summary: `${mentionHandle(nextDefinition.label) ?? mentionHandle(nextDefinition.roleKey) ?? "Next up"} your turn. Review "${firstTaskTitle}" against the constitution and keep the mission moving.`
        });
      }
    }

    return;
  }

  if (existingMission && existingMission.tasks.length === 0) {
    const roleUsageCounts = new Map<string, number>();
    await prisma.task.createMany({
      data: draft.tasks.map((task) => ({
        ...resolveAssignedRoleDefinitionForTaskDraft(project.roleDefinitions, task, roleUsageCounts),
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
    await recordDecisionLog({
      projectId: project.id,
      missionId: existingMission.id,
      kind: "planning",
      actor: planningActorName(project, draft.mission.planningProvenance),
      summary: `Seeded planned tasks for mission "${existingMission.title}"`,
      detail: {
        taskCount: draft.tasks.length,
        mode: "follow_on",
        ...guidanceLogDetail(operatorGuidance)
      }
    });
    const nextDefinition = nextPlanningHandoffDefinition(project, draft);
    const firstTaskTitle = draft.tasks[0]?.title?.trim() || existingMission.title;
    if (nextDefinition) {
      await recordWorkflowMessage({
        projectId: project.id,
        missionId: existingMission.id,
        actor: planningActorName(project, draft.mission.planningProvenance),
        mode: "handoff",
        mentions: [nextDefinition.label, nextDefinition.roleKey],
        summary: `${mentionHandle(nextDefinition.label) ?? mentionHandle(nextDefinition.roleKey) ?? "Next up"} your turn. Review "${firstTaskTitle}" against the constitution and keep the mission moving.`
      });
    }
    return;
  }

  const createdMission = await prisma.mission.create({
    data: {
      projectId: project.id,
      title: missionTitle,
      objective: missionObjective,
      status: draft.mission.status,
      createdBy,
      startedAt: new Date(),
      tasks: {
        create: (() => {
          const roleUsageCounts = new Map<string, number>();
          return draft.tasks.map((task) => ({
            ...resolveAssignedRoleDefinitionForTaskDraft(project.roleDefinitions, task, roleUsageCounts),
            title: task.title,
            description: task.description,
            agentRole: task.agentRole,
            status: task.status,
            priority: task.priority,
            acceptanceCriteria: task.acceptanceCriteria,
            attempts: task.attempts,
            blockerReason: task.blockerReason
          }));
        })()
      }
    },
    select: { id: true, title: true }
  });

  await recordDecisionLog({
    projectId: project.id,
    missionId: createdMission.id,
    kind: "planning",
    actor: planningActorName(project, draft.mission.planningProvenance),
    summary: `Planned mission "${createdMission.title}"`,
    detail: {
      taskCount: draft.tasks.length,
      objective: missionObjective,
      mode: "bootstrap",
      ...guidanceLogDetail(operatorGuidance)
    }
  });

  // GitHub sync — create issues for newly created tasks (fire-and-forget)
  if (project.githubProjectSync) {
    const createdTasks = await prisma.task.findMany({ where: { missionId: createdMission.id } });
    await Promise.allSettled(
      createdTasks.map((createdTask) =>
        syncGitHubTaskIssue({ project, task: { ...createdTask, description: createdTask.description ?? "" }, event: "created" })
      )
    );
  }

  const nextDefinition = nextPlanningHandoffDefinition(project, draft);
  const firstTaskTitle = draft.tasks[0]?.title?.trim() || createdMission.title;
  if (nextDefinition) {
    await recordWorkflowMessage({
      projectId: project.id,
      missionId: createdMission.id,
      actor: planningActorName(project, draft.mission.planningProvenance),
      mode: "handoff",
      mentions: [nextDefinition.label, nextDefinition.roleKey],
      summary: `${mentionHandle(nextDefinition.label) ?? mentionHandle(nextDefinition.roleKey) ?? "Next up"} your turn. Review "${firstTaskTitle}" against the constitution and keep the mission moving.`
    });
  }
}

async function getProjectWithRelations(projectId: string): Promise<ProjectWithRelations | null> {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      constitution: true,
      roleDefinitions: true,
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

export async function readProjectCostAnalysis(projectId: string): Promise<ProjectCostAnalysisResponse> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectRoleDefinitionError("project_not_found", "Project not found", 404);
  }

  const catalog = await loadProjectModelCatalog(project);
  const catalogById = new Map(catalog.models.map((model) => [model.id, model] as const));
  const roles = project.roleDefinitions
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, undefined, { sensitivity: "base" }))
    .map((definition) => {
      const explicitModel = normalizeOptionalString(definition.model);
      const recommendedModel = recommendedRoleModel(definition.roleKey);
      const effectiveModel = explicitModel ?? recommendedModel ?? null;
      const modelSource: "explicit" | "recommended" | "unconfigured" = explicitModel
        ? "explicit"
        : effectiveModel
          ? "recommended"
          : "unconfigured";
      const pricing = effectiveModel ? catalogById.get(effectiveModel) ?? null : null;

      return {
        roleDefinitionId: definition.id,
        roleKey: definition.roleKey,
        visualName: definition.label,
        enabled: definition.enabled,
        model: effectiveModel,
        modelSource,
        promptCostPerMillionUsd: pricing?.promptCostPerMillionUsd ?? null,
        completionCostPerMillionUsd: pricing?.completionCostPerMillionUsd ?? null,
        requestCostUsd: pricing?.requestCostUsd ?? null
      };
    });

  const pricedRoles = roles.filter(
    (role) =>
      role.promptCostPerMillionUsd !== null ||
      role.completionCostPerMillionUsd !== null ||
      role.requestCostUsd !== null
  );
  const sumKnown = (values: Array<number | null | undefined>): number | null => {
    const known = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!known.length) {
      return null;
    }

    return known.reduce((total, value) => total + value, 0);
  };

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    degraded: catalog.degraded,
    warning: catalog.warning,
    roles,
    enabledRoleCount: roles.filter((role) => role.enabled).length,
    pricedRoleCount: pricedRoles.length,
    promptCostPerMillionUsdTotal: sumKnown(roles.map((role) => role.promptCostPerMillionUsd)),
    completionCostPerMillionUsdTotal: sumKnown(roles.map((role) => role.completionCostPerMillionUsd)),
    requestCostUsdTotal: sumKnown(roles.map((role) => role.requestCostUsd))
  };
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
          ...resolveProjectGitHubMetadata(registration.repoUrl ?? existing.repoUrl ?? null),
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
          ...resolveProjectGitHubMetadata(registration.repoUrl),
          defaultBranch: input.defaultBranch,
          localPath: inspection.repoRoot,
          constitutionStatus: inspection.status,
          roleDefinitions: {
            create: (await defaultProjectRoleDefinitions(input.name, input.pipelineTemplate)).map(toPrismaRoleDefinition) as any
          },
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
      githubRepoOwner: project.githubRepoOwner ?? null,
      githubRepoName: project.githubRepoName ?? null,
      githubRepoUrl: project.githubRepoUrl ?? null,
      roleDefinitions: (await defaultProjectRoleDefinitions(input.name, input.pipelineTemplate)).map((definition, index) => ({
        id: `seed-${project.id}-${definition.roleKey}-${index}`,
        projectId: project.id,
        roleKey: definition.roleKey,
        visualName: definition.visualName,
        label: definition.label,
        goal: definition.goal,
        backstory: definition.backstory,
        model: null,
        recommendedModel: recommendedRoleModel(definition.roleKey) ?? null,
        effectiveModel: recommendedRoleModel(definition.roleKey) ?? null,
        enabled: definition.enabled,
        sortOrder: definition.sortOrder,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString()
      })),
      decisionLogs: [],
      operatorGuidance: [],
      ...toAutonomySummary(project),
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
      githubProjectSync: project.githubProjectSync ?? false,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    };
  }

  return hydrateProject(hydrated);
}

function validateProjectRoleDefinitionSet(definitions: ProjectRoleDefinitionInput[]): void {
  const validKeys = new Set<ProjectRoleKey>(["planner", "architect", "implementer", "tester", "coder", "qa", "reviewer", "visual"]);
  const seenKeys = new Set<ProjectRoleKey>();

  if (!definitions.length) {
    throw new ProjectRoleDefinitionError("invalid_role_definition", "At least one role definition is required.", 400);
  }

  for (const definition of definitions) {
    if (!validKeys.has(definition.roleKey)) {
      throw new ProjectRoleDefinitionError("invalid_role_definition", `Unknown roleKey "${definition.roleKey}" is not allowed.`, 400);
    }

    if (!definition.visualName.trim() || !definition.goal.trim() || !definition.backstory.trim()) {
      throw new ProjectRoleDefinitionError("invalid_role_definition", `Role definition "${definition.roleKey}" must include visualName, goal, and backstory.`, 400);
    }

    if (seenKeys.has(definition.roleKey)) {
      throw new ProjectRoleDefinitionError("invalid_role_definition", `Duplicate roleKey "${definition.roleKey}" in roleDefinitions payload.`, 400);
    }

    seenKeys.add(definition.roleKey);
  }
}

export async function replaceProjectRoleDefinitions(
  projectId: string,
  definitions: ProjectRoleDefinitionInput[]
): Promise<ProjectSummary> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true }
  });

  if (!project) {
    throw new ProjectRoleDefinitionError("project_not_found", "Project not found", 404);
  }

  validateProjectRoleDefinitionSet(definitions);

  await prisma.$transaction(async (tx) => {
    await tx.projectRoleDefinition.deleteMany({
      where: { projectId }
    });

    await tx.projectRoleDefinition.createMany({
      data: definitions.map((definition, index) => ({
        projectId,
        roleKey: definition.roleKey,
        label: definition.visualName,
        goal: definition.goal,
        backstory: definition.backstory,
        model: definition.model || null,
        enabled: definition.enabled,
        sortOrder: definition.sortOrder ?? index
      })) as any
    });
  });

  const updatedProject = await loadProjectById(projectId);
  if (!updatedProject) {
    throw new ProjectRoleDefinitionError("project_not_found", "Project not found", 404);
  }

  return updatedProject;
}

function extractMessageMentions(content: string): string[] {
  const matches = [...content.matchAll(/(^|\s)@([a-z0-9][a-z0-9._-]{1,63})/gi)];
  return [...new Set(matches.map((match) => match[2]?.trim()).filter((value): value is string => Boolean(value)))];
}

export async function createProjectMessage(projectId: string, input: ProjectMessageInput): Promise<ProjectDecisionLogSummary> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true }
  });

  if (!project) {
    throw new ProjectRoleDefinitionError("project_not_found", "Project not found", 404);
  }

  const content = input.content.trim();
  if (!content) {
    throw new ProjectRoleDefinitionError("invalid_role_definition", "Message content is required", 400);
  }

  const replyTarget =
    input.replyToId
      ? await prisma.decisionLog.findFirst({
          where: {
            id: input.replyToId,
            projectId
          }
        })
      : null;

  const inheritedMentions =
    replyTarget && typeof replyTarget.detail === "object" && replyTarget.detail !== null
      ? Array.isArray((replyTarget.detail as Record<string, unknown>).mentions)
        ? ((replyTarget.detail as Record<string, unknown>).mentions as unknown[])
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean)
        : []
      : [];
  const mentions = extractMessageMentions(content);
  const effectiveMentions = mentions.length > 0 ? mentions : inheritedMentions;

  return recordDecisionLog({
    projectId,
    missionId: replyTarget?.missionId ?? undefined,
    taskId: replyTarget?.taskId ?? undefined,
    jobId: replyTarget?.jobId ?? undefined,
    kind: "message",
    actor: "operator",
    summary: content,
    detail: {
      source: "operator",
      replyToId: input.replyToId ?? null,
      mentions: effectiveMentions,
      inheritedMentions: mentions.length === 0 && inheritedMentions.length > 0
    }
  });
}

export async function steerProjectJob(projectId: string, jobId: string, content: string): Promise<ProjectDecisionLogSummary> {
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      task: {
        mission: { projectId }
      }
    },
    select: {
      id: true,
      status: true,
      task: {
        select: { agentRole: true }
      }
    }
  });

  if (!job) {
    throw new ProjectJobRefreshError("job_not_found", "Job not found", 404);
  }

  if (job.status === "complete" || job.status === "failed" || job.status === "cancelled") {
    throw new ProjectJobRefreshError("job_not_active", "Cannot steer a job that is no longer running", 409);
  }

  const agentRole = job.task.agentRole;
  const steerContent = content.trim();
  if (!steerContent) {
    throw new ProjectRoleDefinitionError("invalid_role_definition", "Steering content is required", 400);
  }

  // Prepend @mention so guidance is routed to the running agent role
  const mentionPrefix = `@${agentRole} `;
  const effectiveContent = steerContent.startsWith(mentionPrefix) ? steerContent : `${mentionPrefix}${steerContent}`;

  return recordDecisionLog({
    projectId,
    actor: "operator",
    kind: "steer",
    summary: effectiveContent,
    detail: {
      source: "operator",
      jobId,
      agentRole,
      mentions: [agentRole]
    }
  });
}

export async function listProjectChatMessages(projectId: string, query: ProjectChatQuery = {}): Promise<ProjectChatMessageSummary[]> {
  const logs = await listProjectDecisionLogs(projectId, {
    kind: "message",
    take: Math.max(1, Math.min(200, Math.trunc(query.take ?? 50))),
    actor: query.actor ?? null,
    mention: query.mention ?? null,
    replyToId: query.replyToId ?? null
  });
  return logs
    .map(toProjectChatMessageSummary)
    .filter((message): message is ProjectChatMessageSummary => message !== null)
    .filter((message) => !query.actionableOnly || message.actionable);
}

export async function updateProjectAutonomy(
  projectId: string,
  update: ProjectAutonomyUpdateInput
): Promise<ProjectSummary> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true }
  });

  if (!project) {
    throw new ProjectAutonomyError("project_not_found", "Project not found", 404);
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(update.autonomyMode ? { autonomyMode: update.autonomyMode } : {}),
      ...(update.pullRequestMode ? { pullRequestMode: update.pullRequestMode } : {}),
      ...(update.pullRequestDraftMode ? { pullRequestDraftMode: update.pullRequestDraftMode } : {}),
      ...(update.mergeApprovalMode ? { mergeApprovalMode: update.mergeApprovalMode } : {}),
      ...(update.branchCleanupMode ? { branchCleanupMode: update.branchCleanupMode } : {})
    }
  });

  const updatedProject = await loadProjectById(projectId);
  if (!updatedProject) {
    throw new ProjectAutonomyError("project_not_found", "Project not found", 404);
  }

  return updatedProject;
}

export async function recordProjectAutonomyRun(
  projectId: string,
  update: ProjectAutonomyRunUpdateInput
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true }
  });

  if (!project) {
    throw new ProjectAutonomyError("project_not_found", "Project not found", 404);
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      lastAutonomyRunAt: update.lastAutonomyRunAt,
      lastAutonomyStatus: update.lastAutonomyStatus,
      lastAutonomyMessage: update.lastAutonomyMessage ?? null,
      lastAutonomyActor: update.lastAutonomyActor ?? null,
      nextAutonomyRunAt: update.nextAutonomyRunAt ?? null
    }
  });
}

export async function planProject(projectId: string): Promise<ProjectSummary | null> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    return null;
  }

  const currentSummary = await hydrateProject(project);
  if (!shouldTopUpMissionBacklog(currentSummary)) {
    return currentSummary;
  }

  const inspection = await inspectProjectConstitution(project);
  const operatorGuidance = guidanceForPlanning(project, await loadRecentActionableGuidance(project.id, 8));
  const planningContext = await loadPlanningContext(asProjectInput(project), inspection, operatorGuidance);
  const context = await createInitialPlan(planningContext);

  await persistPlannedMission(project, context);
  return loadProjectById(projectId);
}

interface BrainInterviewResponse {
  action: "ask" | "synthesize";
  question?: string;
  interviewStep?: number;
  totalSteps?: number;
  files?: Partial<Record<string, string>>;
  suggestedTemplate?: string;
}

async function applyInterviewTemplate(projectId: string, projectName: string, templateKey: string): Promise<void> {
  const definitions = await defaultProjectRoleDefinitions(projectName, templateKey);
  await prisma.$transaction(async (tx) => {
    await tx.projectRoleDefinition.deleteMany({ where: { projectId } });
    await tx.projectRoleDefinition.createMany({
      data: definitions.map((definition, index) => ({
        projectId,
        roleKey: definition.roleKey,
        label: definition.visualName,
        goal: definition.goal,
        backstory: definition.backstory,
        model: definition.model || null,
        enabled: definition.enabled,
        sortOrder: definition.sortOrder ?? index
      })) as any
    });
  });
}

export async function conductConstitutionInterview(
  projectId: string,
  operatorMessage: string | null
): Promise<{ action: string; question?: string; interviewStep?: number; totalSteps?: number; filesWritten?: string[]; suggestedTemplate?: string }> {
  const project = await getProjectWithRelations(projectId);
  if (!project) {
    throw new ProjectConstitutionError("project_not_found", "Project not found", 404);
  }

  // Record the incoming operator message before building history
  if (operatorMessage) {
    await recordDecisionLog({
      projectId,
      kind: "message",
      actor: "operator",
      summary: operatorMessage,
      detail: { source: "operator" }
    });
  }

  // Load recent decision logs and filter to interview-related entries
  const recentLogs = await loadRecentDecisionLogs(projectId, 50);
  const interviewLogs = recentLogs
    .filter((log) => {
      if (log.kind === "interview") {
        return true;
      }
      if (log.kind === "message") {
        const detail = typeof log.detail === "object" && log.detail !== null ? (log.detail as Record<string, unknown>) : {};
        return detail.source === "operator";
      }
      return false;
    })
    .reverse(); // chronological order for chat history

  // Determine which constitution files already exist by reading the path fields
  // from the Prisma Constitution record (visionPath, specPath, roadmapPath).
  // The old code incorrectly read `missingRequiredFiles` which is a field on
  // ConstitutionInspection, not on the DB model — causing re-run to always skip all questions.
  const existingFiles: string[] = [];
  if (project.constitution) {
    if (project.constitution.visionPath) existingFiles.push("vision");
    if (project.constitution.specPath) existingFiles.push("spec");
    if (project.constitution.roadmapPath) existingFiles.push("roadmap");
  }
  const isRerun = project.constitutionStatus === "parsed" || project.constitutionStatus === "stale";

  const response = await readBrainJson<BrainInterviewResponse>("/orchestration/interview", {
    project_id: projectId,
    project_name: project.name,
    constitution_status: project.constitutionStatus,
    missing_files: [],
    existing_files: existingFiles,
    rerun: isRerun,
    chat_history: interviewLogs.map((log) => ({
      actor: log.actor,
      content: log.summary,
      detail: log.detail
    }))
  });

  if (response.action === "ask") {
    await recordDecisionLog({
      projectId,
      kind: "interview",
      actor: "planner",
      summary: response.question ?? "",
      detail: { source: "system", interviewStep: response.interviewStep }
    });

    return {
      action: "ask",
      question: response.question,
      interviewStep: response.interviewStep,
      totalSteps: response.totalSteps
    };
  }

  if (response.action === "synthesize" && typeof response.files === "object" && response.files !== null) {
    const filesWritten: string[] = [];
    for (const [fileKey, content] of Object.entries(response.files)) {
      if (typeof content === "string" && content.trim()) {
        await writeConstitutionFile(projectId, fileKey, content);
        filesWritten.push(fileKey);
      }
    }

    const suggestedTemplate = typeof response.suggestedTemplate === "string" ? response.suggestedTemplate : undefined;

    if (suggestedTemplate && PIPELINE_TEMPLATES[suggestedTemplate]) {
      await applyInterviewTemplate(projectId, project.name, suggestedTemplate);
    }

    await recordDecisionLog({
      projectId,
      kind: "interview",
      actor: "planner",
      summary: "Constitution documents generated from interview.",
      detail: { source: "system", suggestedTemplate: suggestedTemplate ?? null }
    });

    return { action: "synthesize", filesWritten, suggestedTemplate };
  }

  throw new Error(`Unexpected Brain interview response action: ${response.action}`);
}

export async function forceFailStuckJob(projectId: string, jobId: string, taskId: string, attempts: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: {
        status: "failed",
        completedAt: new Date(),
        artifactSummary: "Job timed out — marked as failed by stuck job recovery."
      } as any
    });

    const taskStatus = attempts >= 2 ? "blocked" : "failed";
    const blockerReason = taskStatus === "blocked" ? "Job timed out after repeated attempts." : null;

    await tx.task.update({
      where: { id: taskId },
      data: { status: taskStatus, blockerReason }
    });

    if (taskStatus === "blocked") {
      await tx.blocker.create({
        data: {
          taskId,
          title: `Stuck job timeout for job ${jobId}`,
          context: `Job ${jobId} was running for longer than the configured timeout and was force-failed by the autonomy loop.`,
          options: ["Check executor logs", "Retry the task", "Dismiss if no longer needed"],
          recommendation: "Check whether the executor process crashed or the OpenHands session hung.",
          status: "open"
        }
      });
    }
  });

  await recordDecisionLog({
    projectId,
    taskId,
    jobId,
    kind: "workflow",
    actor: "autonomy-loop",
    summary: `Force-failed stuck job ${jobId} after timeout.`,
    detail: { source: "stuck_job_recovery", jobId, taskId, attempts }
  });
}
