import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { loadMissionDetail } from "$lib/server/control-data";
import { postJson } from "$lib/server/mutations";

export const load: PageServerLoad = async ({ params }) => {
  const detail = await loadMissionDetail(params.id);
  if (!detail) {
    throw error(404, "Mission not found");
  }

  return detail;
};

export const actions: Actions = {
  replan: async ({ params }) => {
    const detail = await loadMissionDetail(params.id);
    if (!detail) return fail(404, { actionError: "Mission not found" });
    try {
      await postJson(`/projects/${detail.project.id}/plan`, {});
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to plan" });
    }
    throw redirect(303, `/missions/${params.id}`);
  }
};
