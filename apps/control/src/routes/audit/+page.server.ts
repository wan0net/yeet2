import type { PageServerLoad } from "./$types";
import { apiJson } from "$lib/server/api";
import { loadProjects } from "$lib/server/control-data";

interface ActivityResponse {
  activity: Array<{
    id: string;
    projectId: string;
    actor: string;
    kind: string;
    summary: string;
    eventType?: string | null;
    createdAt?: string | null;
    detail?: unknown;
  }>;
}

export const load: PageServerLoad = async ({ url }) => {
  const projectId = url.searchParams.get("project") || "";
  const kind = url.searchParams.get("kind") || "";
  const search = url.searchParams.get("search") || "";

  const params = new URLSearchParams();
  params.set("take", "100");
  if (projectId) params.set("projectId", projectId);
  if (kind) params.set("kind", kind);
  if (search) params.set("search", search);

  const [activityRes, projects] = await Promise.all([
    apiJson<ActivityResponse>(`/activity?${params}`).catch(() => ({ activity: [] })),
    loadProjects().catch(() => [])
  ]);

  return {
    activity: activityRes.activity,
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    filters: { projectId, kind, search }
  };
};
