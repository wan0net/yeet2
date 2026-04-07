import type { PageServerLoad } from "./$types";
import { loadGlobalTasks } from "$lib/server/control-data";
import { serverLogger } from "$lib/server/logger";

export const load: PageServerLoad = async () => {
  try {
    return { tasks: await loadGlobalTasks(), error: null };
  } catch (error) {
    serverLogger.loadFailure("tasks/load", error);
    return { tasks: [], error: "Unable to reach the API. Check that the API service is running." };
  }
};
