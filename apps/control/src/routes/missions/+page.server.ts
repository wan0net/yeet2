import type { PageServerLoad } from "./$types";
import { loadGlobalMissions } from "$lib/server/control-data";

export const load: PageServerLoad = async () => ({
  missions: await loadGlobalMissions()
});
