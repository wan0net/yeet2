import type { PageServerLoad } from "./$types";
import { loadGlobalJobs } from "$lib/server/control-data";
import { serverLogger } from "$lib/server/logger";

export const load: PageServerLoad = async () => {
  try {
    return { jobs: await loadGlobalJobs(), error: null };
  } catch (error) {
    serverLogger.loadFailure("jobs/load", error);
    return { jobs: [], error: "Unable to reach the API. Check that the API service is running." };
  }
};
