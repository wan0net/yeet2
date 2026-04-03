import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { loadMissionDetail } from "$lib/server/control-data";

export const load: PageServerLoad = async ({ params }) => {
  const detail = await loadMissionDetail(params.id);
  if (!detail) {
    throw error(404, "Mission not found");
  }

  return detail;
};
