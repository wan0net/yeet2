import type { PageServerLoad } from "./$types";
import { loadGlobalTasks } from "$lib/server/control-data";

export const load: PageServerLoad = async () => ({
  tasks: await loadGlobalTasks()
});
