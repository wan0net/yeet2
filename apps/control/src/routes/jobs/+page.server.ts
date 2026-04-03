import type { PageServerLoad } from "./$types";
import { loadGlobalJobs } from "$lib/server/control-data";

export const load: PageServerLoad = async () => ({
  jobs: await loadGlobalJobs()
});
