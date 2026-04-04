import { loadApprovals, loadGlobalBlockers, loadProjects } from "$lib/server/control-data";
import { buildControlPlaneOverview } from "$lib/server/overview-local";
import type { ProjectRecord, ProjectRoleDefinition, ProjectTaskRecord } from "$lib/projects";

export interface AgentCard {
  projectId: string;
  projectName: string;
  roleKey: string;
  characterName: string;
  status: "working" | "idle" | "blocked" | "complete" | "queued";
  currentTask: string | null;
  model: string | null;
}

function deriveAgentStatus(
  role: ProjectRoleDefinition,
  tasks: ProjectTaskRecord[]
): { status: AgentCard["status"]; currentTask: string | null } {
  const roleTasks = tasks.filter(
    (task) =>
      task.agentRole?.toLowerCase() === role.roleKey?.toLowerCase() ||
      task.assignedRoleDefinitionId === role.id
  );

  const running = roleTasks.find((t) => t.status === "running");
  if (running) return { status: "working", currentTask: running.title };

  const blocked = roleTasks.find((t) => t.status === "blocked");
  if (blocked) return { status: "blocked", currentTask: blocked.title };

  const queued = roleTasks.find((t) => t.status === "ready" || t.status === "pending");
  if (queued) return { status: "queued", currentTask: queued.title };

  const complete = [...roleTasks].reverse().find((t) => t.status === "complete");
  if (complete) return { status: "complete", currentTask: complete.title };

  return { status: "idle", currentTask: null };
}

function buildAgentCards(projects: ProjectRecord[]): AgentCard[] {
  return projects.flatMap((project) => {
    const activeMission =
      project.missions.find((m) => m.status === "active" || m.status === "planned") ??
      project.missions[0] ??
      null;
    const tasks = activeMission?.tasks ?? [];

    return project.roleDefinitions
      .filter((role) => role.enabled)
      .map((role): AgentCard => {
        const { status, currentTask } = deriveAgentStatus(role, tasks);
        return {
          projectId: project.id,
          projectName: project.name,
          roleKey: role.roleKey,
          characterName: role.visualName || role.label || role.roleKey,
          status,
          currentTask,
          model: role.effectiveModel ?? role.model ?? null
        };
      });
  });
}

export async function load() {
  try {
    const [overview, approvalsPayload, blockers, projects] = await Promise.all([
      buildControlPlaneOverview(),
      loadApprovals(),
      loadGlobalBlockers(),
      loadProjects()
    ]);

    return {
      overview,
      approvals: Array.isArray(approvalsPayload.approvals) ? approvalsPayload.approvals : [],
      blockers,
      projects,
      agents: buildAgentCards(projects),
      error: null
    };
  } catch {
    return {
      overview: {
        totals: { projects: 0, activeMissions: 0, runningJobs: 0, openBlockers: 0, queuedJobs: 0, failedJobs: 0 },
        workers: { availableWorkers: 0, healthyWorkers: 0, busyWorkers: 0, staleWorkers: 0 },
        auth: { enabled: false, mode: "none" }
      },
      approvals: [],
      blockers: [],
      projects: [],
      agents: [] as AgentCard[],
      error: "Unable to reach the API. Check that the API service is running."
    };
  }
}
