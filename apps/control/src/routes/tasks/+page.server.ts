import type { PageServerLoad } from "./$types";
import { loadGlobalTasks } from "$lib/server/control-data";

export const load: PageServerLoad = async () => {
  try {
    return { tasks: await loadGlobalTasks(), error: null };
  } catch {
    return { tasks: [], error: "Unable to reach the API. Check that the API service is running." };
  }
};
