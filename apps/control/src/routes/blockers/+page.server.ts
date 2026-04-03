import type { PageServerLoad } from "./$types";
import { loadGlobalBlockers } from "$lib/server/control-data";

export const load: PageServerLoad = async () => ({
  blockers: await loadGlobalBlockers()
});
