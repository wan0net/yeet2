import { loadApprovals, loadGlobalBlockers, loadProjects } from "$lib/server/control-data";
import { buildControlPlaneOverview } from "$lib/server/overview-local";

export async function load() {
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
    projects
  };
}
