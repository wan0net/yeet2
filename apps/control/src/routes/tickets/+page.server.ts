import type { PageServerLoad } from "./$types";
import {
  loadApprovals,
  loadGlobalBlockers,
  loadGlobalJobs,
  loadGlobalTasks
} from "$lib/server/control-data";
import { serverLogger } from "$lib/server/logger";

export const load: PageServerLoad = async () => {
  try {
    const [tasks, blockers, approvalsPayload, jobs] = await Promise.all([
      loadGlobalTasks(),
      loadGlobalBlockers(),
      loadApprovals(),
      loadGlobalJobs()
    ]);

    return {
      tasks,
      blockers,
      approvals: Array.isArray(approvalsPayload.approvals) ? approvalsPayload.approvals : [],
      jobs,
      error: null
    };
  } catch (error) {
    serverLogger.loadFailure("tickets/load", error);
    return {
      tasks: [],
      blockers: [],
      approvals: [],
      jobs: [],
      error: "Unable to reach the API. Check that the API service is running."
    };
  }
};
