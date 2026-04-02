import { headers } from "next/headers";

import type { ProjectMissionRecord, ProjectRecord } from "./projects";

export async function controlBaseUrl(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  return host ? `${protocol}://${host}` : "http://127.0.0.1:3000";
}

export async function fetchProjects(): Promise<ProjectRecord[]> {
  const baseUrl = await controlBaseUrl();
  const response = await fetch(`${baseUrl}/api/projects`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Unable to load projects");
  }

  const payload = (await response.json()) as { projects?: ProjectRecord[] };
  return Array.isArray(payload.projects) ? payload.projects : [];
}

export async function fetchProject(projectId: string): Promise<ProjectRecord | null> {
  const baseUrl = await controlBaseUrl();
  const response = await fetch(`${baseUrl}/api/projects?id=${encodeURIComponent(projectId)}`, {
    cache: "no-store"
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to load project");
  }

  const payload = (await response.json()) as { project?: ProjectRecord };
  return payload.project ?? null;
}

export async function fetchMissionDetail(
  missionId: string
): Promise<{ project: ProjectRecord; mission: ProjectMissionRecord } | null> {
  const projects = await fetchProjects();

  for (const project of projects) {
    const mission = project.missions.find((entry) => entry.id === missionId);
    if (mission) {
      return { project, mission };
    }
  }

  return null;
}
