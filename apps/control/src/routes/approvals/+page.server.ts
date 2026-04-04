import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { apiJson } from "$lib/server/api";
import { postJson } from "$lib/server/mutations";

export const load: PageServerLoad = async () => ({
  approvals: (await apiJson<{ approvals: Array<Record<string, unknown>> }>("/approvals")).approvals ?? []
});

export const actions: Actions = {
  approve: async ({ request }) => {
    const form = await request.formData();
    const projectId = String(form.get("projectId") || "").trim();
    const blockerId = String(form.get("blockerId") || "").trim();
    if (!projectId || !blockerId) {
      return fail(400, { actionError: "Missing projectId or blockerId" });
    }

    try {
      await postJson(`/projects/${projectId}/blockers/${blockerId}/approval`, { action: "approve" });
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to approve" });
    }

    throw redirect(303, "/approvals");
  },
  reject: async ({ request }) => {
    const form = await request.formData();
    const projectId = String(form.get("projectId") || "").trim();
    const blockerId = String(form.get("blockerId") || "").trim();
    if (!projectId || !blockerId) {
      return fail(400, { actionError: "Missing projectId or blockerId" });
    }

    try {
      await postJson(`/projects/${projectId}/blockers/${blockerId}/approval`, { action: "reject" });
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to reject" });
    }

    throw redirect(303, "/approvals");
  }
};
