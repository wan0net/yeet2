import type { ProjectBlockerRecord, ProjectJobRecord, ProjectMissionRecord, ProjectRecord, ProjectTaskRecord } from "$lib/projects";
import type { WorkerRegistryResult } from "$lib/workers";
import { normalizeProject, normalizeProjectModelCatalog, type ProjectModelCatalogOption } from "$lib/projects";
import { normalizeWorkerList } from "$lib/workers";
import { apiJson } from "./api";
import { serverLogger } from "./logger";

export interface GlobalJobEntry {
  projectId: string;
  projectName: string;
  projectRepoUrl?: string | null;
  projectGitHubUrl?: string | null;
  missionId: string;
  missionTitle: string;
  taskId: string;
  taskTitle: string;
  taskAgentRole: string;
  taskStatus: string;
  job: ProjectJobRecord;
}

export interface GlobalTaskEntry {
  projectId: string;
  projectName: string;
  projectRepoUrl?: string | null;
  projectGitHubUrl?: string | null;
  missionId: string;
  missionTitle: string;
  task: ProjectTaskRecord;
}

export interface GlobalMissionEntry {
  projectId: string;
  projectName: string;
  projectRepoUrl?: string | null;
  projectGitHubUrl?: string | null;
  mission: ProjectMissionRecord & { taskCount: number };
}

export interface GlobalBlockerEntry {
  projectId: string;
  projectName: string;
  projectRepoUrl?: string | null;
  projectGitHubUrl?: string | null;
  taskId: string | null;
  missionId: string;
  missionTitle: string;
  taskTitle: string;
  blocker: ProjectBlockerRecord;
}

export async function loadOverview() {
  try {
    return await apiJson<{ overview: unknown }>("/overview");
  } catch (error) {
    serverLogger.loadFailure("loadOverview", error);
    return { overview: null };
  }
}

export async function loadProjects(): Promise<ProjectRecord[]> {
  try {
    const payload = await apiJson<{ projects?: unknown[] }>("/projects");
    return Array.isArray(payload.projects)
      ? payload.projects.map(normalizeProject).filter((entry): entry is ProjectRecord => entry !== null)
      : [];
  } catch (error) {
    serverLogger.loadFailure("loadProjects", error);
    return [];
  }
}

export async function loadProject(projectId: string): Promise<ProjectRecord | null> {
  try {
    const response = await apiJson<{ project?: unknown }>(`/projects/${encodeURIComponent(projectId)}`);
    return response.project ? normalizeProject(response.project) : null;
  } catch (error) {
    serverLogger.loadFailure("loadProject", error, { projectId });
    return null;
  }
}

export async function loadProjectRoleModels(_projectId: string): Promise<ProjectModelCatalogOption[]> {
  try {
    const payload = await apiJson<unknown>(`/projects/models`);
    return normalizeProjectModelCatalog(payload);
  } catch (error) {
    serverLogger.loadFailure("loadProjectRoleModels", error);
    return [];
  }
}

export async function loadMissionDetail(missionId: string): Promise<{ project: ProjectRecord; mission: ProjectMissionRecord } | null> {
  try {
    const payload = await apiJson<{ missions?: GlobalMissionEntry[] }>(`/missions?missionId=${encodeURIComponent(missionId)}`);
    const entry = Array.isArray(payload.missions) ? payload.missions.find((candidate) => candidate.mission.id === missionId) : null;
    if (!entry) {
      return null;
    }

    const project = await loadProject(entry.projectId);
    if (!project) {
      return null;
    }

    const mission = project.missions.find((candidate) => candidate.id === missionId) ?? null;
    if (!mission) {
      return null;
    }

    return { project, mission };
  } catch (error) {
    serverLogger.loadFailure("loadMissionDetail", error, { missionId });
    return null;
  }
}

export async function loadGlobalJobs() {
  const payload = await apiJson<{ jobs?: GlobalJobEntry[] }>("/jobs");
  return Array.isArray(payload.jobs) ? payload.jobs : [];
}

export async function loadGlobalJob(jobId: string): Promise<GlobalJobEntry | null> {
  const payload = await apiJson<{ jobs?: GlobalJobEntry[] }>(`/jobs?jobId=${encodeURIComponent(jobId)}`);
  return Array.isArray(payload.jobs) ? payload.jobs.find((entry) => entry.job.id === jobId) ?? null : null;
}

export async function loadGlobalTasks() {
  const payload = await apiJson<{ tasks?: GlobalTaskEntry[] }>("/tasks");
  return Array.isArray(payload.tasks) ? payload.tasks : [];
}

export async function loadGlobalMissions() {
  const payload = await apiJson<{ missions?: GlobalMissionEntry[] }>("/missions");
  return Array.isArray(payload.missions) ? payload.missions : [];
}

export async function loadGlobalBlockers() {
  const payload = await apiJson<{ blockers?: GlobalBlockerEntry[] }>("/blockers");
  return Array.isArray(payload.blockers) ? payload.blockers : [];
}

export async function loadApprovals() {
  try {
    return await apiJson<{ approvals?: unknown[] }>("/approvals");
  } catch (error) {
    serverLogger.loadFailure("loadApprovals", error);
    return { approvals: [] };
  }
}

export async function loadWorkers(): Promise<WorkerRegistryResult> {
  try {
    const payload = await apiJson<{ workers?: unknown[] }>("/workers");
    return {
      workers: normalizeWorkerList(payload.workers ?? []),
      registryAvailable: true,
      status: 200,
      error: null,
      detail: null
    };
  } catch (error) {
    serverLogger.loadFailure("loadWorkers", error);
    return {
      workers: [],
      registryAvailable: false,
      status: 503,
      error: "api_unavailable",
      detail: null
    };
  }
}
