import type { PageServerLoad } from "./$types";
import { loadProjects } from "$lib/server/control-data";

export const load: PageServerLoad = async () => {
  return {
    projects: await loadProjects()
  };
};
