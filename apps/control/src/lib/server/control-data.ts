import type { ProjectBlockerRecord, ProjectJobRecord, ProjectMissionRecord, ProjectRecord, ProjectTaskRecord } from "$lib/projects";
import type { WorkerRegistryResult } from "$lib/workers";
import { normalizeProject, normalizeProjectModelCatalog, type ProjectModelCatalogOption } from "$lib/projects";
import { normalizeWorkerList } from "$lib/workers";
import { apiJson } from "./api";

export interface GlobalJobEntry {
  projectId: string;
  projectName: string;
  missionId: string;
  missionTitle: string;
  taskId: string;
  taskTitle: string;
  job: ProjectJobRecord;
}

export interface GlobalTaskEntry {
  projectId: string;
  projectName: string;
  missionId: string;
  missionTitle: string;
  task: ProjectTaskRecord;
}

export interface GlobalMissionEntry {
  projectId: string;
  projectName: string;
  mission: ProjectMissionRecord & { taskCount: number };
}

export interface GlobalBlockerEntry {
  projectId: string;
  projectName: string;
  taskId: string | null;
  taskTitle: string;
  blocker: ProjectBlockerRecord;
}

export async function loadOverview() {
  return apiJson<{ overview: unknown }>("/overview");
}

export async function loadProjects(): Promise<ProjectRecord[]> {
  const payload = await apiJson<{ projects?: unknown[] }>("/projects");
  return Array.isArray(payload.projects)
    ? payload.projects.map(normalizeProject).filter((entry): entry is ProjectRecord => entry !== null)
    : [];
}

export async function loadProject(projectId: string): Promise<ProjectRecord | null> {
  const response = await apiJson<{ project?: unknown }>(`/projects/${encodeURIComponent(projectId)}`);
  return response.project ? normalizeProject(response.project) : null;
}

export async function loadProjectRoleModels(projectId: string): Promise<ProjectModelCatalogOption[]> {
  const payload = await apiJson<unknown>(`/projects/models`);
  return normalizeProjectModelCatalog(payload);
}

export async function loadMissionDetail(missionId: string): Promise<{ project: ProjectRecord; mission: ProjectMissionRecord } | null> {
  const projects = await loadProjects();
  for (const project of projects) {
    const mission = project.missions.find((entry) => entry.id === missionId);
    if (mission) {
      return { project, mission };
    }
  }

  return null;
}

export async function loadGlobalJobs() {
  const projects = await loadProjects();

  return projects
    .flatMap((project) =>
      project.missions.flatMap((mission) =>
        mission.tasks.flatMap((task) =>
          task.jobs.map((job) => ({
            projectId: project.id,
            projectName: project.name,
            missionId: mission.id,
            missionTitle: mission.title,
            taskId: task.id,
            taskTitle: task.title,
            job
          }))
        )
      )
    )
    .sort((left, right) => (right.job.startedAt ?? right.job.completedAt ?? "").localeCompare(left.job.startedAt ?? left.job.completedAt ?? ""));
}

export async function loadGlobalTasks() {
  const projects = await loadProjects();

  return projects.flatMap((project) =>
    project.missions.flatMap((mission) =>
      mission.tasks.map((task) => ({
        projectId: project.id,
        projectName: project.name,
        missionId: mission.id,
        missionTitle: mission.title,
        task
      }))
    )
  );
}

export async function loadGlobalMissions() {
  const projects = await loadProjects();

  return projects.flatMap((project) =>
    project.missions.map((mission) => ({
      projectId: project.id,
      projectName: project.name,
      mission: {
        ...mission,
        taskCount: mission.tasks.length
      }
    }))
  );
}

export async function loadGlobalBlockers() {
  const projects = await loadProjects();

  return projects.flatMap((project) =>
    project.blockers.map((blocker) => ({
      projectId: project.id,
      projectName: project.name,
      taskId: blocker.taskId,
      taskTitle:
        project.missions.flatMap((mission) => mission.tasks).find((task) => task.id === blocker.taskId)?.title ?? "Project blocker",
      blocker
    }))
  );
}

export async function loadApprovals() {
  return apiJson<{ approvals?: unknown[] }>("/approvals");
}

export async function loadWorkers(): Promise<WorkerRegistryResult> {
  const payload = await apiJson<{ workers?: unknown[] }>("/workers");
  return {
    workers: normalizeWorkerList(payload.workers ?? []),
    registryAvailable: true,
    status: 200,
    error: null,
    detail: null
  };
}
