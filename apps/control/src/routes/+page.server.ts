import { loadApprovals, loadGlobalBlockers, loadProjects } from "$lib/server/control-data";
import { buildControlPlaneOverview } from "$lib/server/overview-local";

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
      error: "Unable to reach the API. Check that the API service is running."
    };
  }
}
