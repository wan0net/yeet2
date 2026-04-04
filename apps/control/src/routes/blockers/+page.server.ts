import type { Actions, PageServerLoad } from "./$types";
import { loadGlobalBlockers } from "$lib/server/control-data";
import { fail, redirect } from "@sveltejs/kit";
import { postJson } from "$lib/server/mutations";

export const load: PageServerLoad = async () => ({
  blockers: await loadGlobalBlockers()
});

export const actions: Actions = {
  resolve: async ({ request }) => {
    const form = await request.formData();
    const projectId = String(form.get("projectId") || "").trim();
    const blockerId = String(form.get("blockerId") || "").trim();
    if (!projectId || !blockerId) {
      return fail(400, { actionError: "Missing projectId or blockerId" });
    }

    try {
      await postJson(`/projects/${projectId}/blockers/${blockerId}/resolve`, {});
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to resolve blocker" });
    }

    throw redirect(303, "/blockers");
  },
  dismiss: async ({ request }) => {
    const form = await request.formData();
    const projectId = String(form.get("projectId") || "").trim();
    const blockerId = String(form.get("blockerId") || "").trim();
    if (!projectId || !blockerId) {
      return fail(400, { actionError: "Missing projectId or blockerId" });
    }

    try {
      await postJson(`/projects/${projectId}/blockers/${blockerId}/resolve`, {});
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to dismiss blocker" });
    }

    throw redirect(303, "/blockers");
  }
};
