import type {
  Constitution,
  Job as DbJob,
  Mission as DbMission,
  Project as DbProject,
  Task as DbTask
} from "@yeet2/db";

import { prisma } from "./db";
import { inspectConstitution, type ConstitutionInspection } from "./constitution";
import { createInitialPlan, loadPlanningContext, type PlanningDraft, type PlanningProject } from "./planning";

export interface ProjectRegistrationInput {
  name: string;
  repoUrl: string;
  defaultBranch: string;
  localPath: string;
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
  jobs: ProjectJobSummary[];
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
  activeMissionCount: number;
  activeTaskCount: number;
  blockerCount: number;
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

export interface ProjectListResponse {
  projects: ProjectSummary[];
}

export interface ProjectDetailResponse {
  project: ProjectSummary | null;
}

type ProjectWithRelations = DbProject & {
  constitution?: Constitution | null;
  missions: Array<DbMission & { tasks: Array<DbTask & { jobs: DbJob[] }> }>;
};

function isCountedTaskStatus(status: string): boolean {
  return status !== "complete" && status !== "failed" && status !== "cancelled" && status !== "done";
}

function isDispatchableTaskStatus(status: ProjectTaskStatus): boolean {
  return status === "pending" || status === "ready" || status === "failed";
}

function executorBaseUrl(): string {
  return (process.env.YEET2_EXECUTOR_BASE_URL ?? process.env.EXECUTOR_BASE_URL ?? "http://127.0.0.1:8021").replace(/\/+$/, "");
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
    jobs
  };
}

function toProjectMissionSummary(mission: ProjectWithRelations["missions"][number]): ProjectMissionSummary {
  const tasks = [...mission.tasks]
    .sort((left, right) => left.priority - right.priority)
    .map(toProjectTaskSummary);

  return {
    id: mission.id,
    projectId: mission.projectId,
    title: mission.title,
    objective: mission.objective,
    status: mission.status,
    createdBy: mission.createdBy ?? null,
    startedAt: mission.startedAt?.toISOString() ?? null,
    completedAt: mission.completedAt?.toISOString() ?? null,
    tasks
  };
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

function countProjectTasks(missions: ProjectMissionSummary[]): number {
  return missions.flatMap((mission) => mission.tasks).filter((task) => isCountedTaskStatus(task.status)).length;
}

function countProjectBlockers(missions: ProjectMissionSummary[]): number {
  return missions.flatMap((mission) => mission.tasks).filter((task) => task.status === "blocked" || Boolean(task.blockerReason)).length;
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

  return {
    id: project.id,
    name: project.name,
    repoUrl: project.repoUrl ?? "",
    defaultBranch: project.defaultBranch,
    localPath: project.localPath,
    constitutionStatus: constitution.status,
    constitution,
    missions,
    activeMissionCount: missions.filter((mission) => mission.status === "active" || mission.status === "planned").length,
    activeTaskCount: countProjectTasks(missions),
    blockerCount: countProjectBlockers(missions),
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
              jobs: true
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
              jobs: true
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

function taskStatusFromJobStatus(status: ProjectJobStatus, attempts: number): ProjectTaskStatus {
  if (status === "queued" || status === "running") {
    return "running";
  }

  if (status === "complete") {
    return "complete";
  }

  return attempts >= 2 ? "blocked" : "failed";
}

function taskStatusFromDispatchFailure(attempts: number): ProjectTaskStatus {
  return attempts >= 2 ? "blocked" : "failed";
}

function buildDispatchBlockerReason(message: string): string {
  return `Dispatch failed after repeated attempts: ${message}`;
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

async function updateTaskAfterDispatchFailure(taskId: string, attempts: number, message: string): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: taskStatusFromDispatchFailure(attempts),
      blockerReason: attempts >= 2 ? buildDispatchBlockerReason(message) : null
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
  const taskStatus = taskStatusFromJobStatus(jobStatus, attempts);
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

  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: taskStatus,
      blockerReason: taskStatus === "blocked" ? buildDispatchBlockerReason(`Executor reported job status ${jobStatus}`) : null
    }
  });

  return toProjectJobSummary(createdJob);
}

async function dispatchTaskFromProject(
  project: ProjectWithRelations,
  task: ProjectWithRelations["missions"][number]["tasks"][number]
): Promise<DispatchTaskResult> {
  if (task.agentRole !== "implementer") {
    throw new ProjectDispatchError("invalid_task_role", "Only implementer tasks can be dispatched", 400);
  }

  if (!isDispatchableTaskStatus(task.status)) {
    throw new ProjectDispatchError("task_not_dispatchable", `Task ${task.id} is not dispatchable in its current state`, 409);
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
    await updateTaskAfterDispatchFailure(task.id, attempts, message);
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
              jobs: true
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
  const inspection = await inspectConstitution(input.localPath);
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
          repoUrl: input.repoUrl,
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
          repoUrl: input.repoUrl,
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
      activeMissionCount: 0,
      activeTaskCount: 0,
      blockerCount: 0,
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
