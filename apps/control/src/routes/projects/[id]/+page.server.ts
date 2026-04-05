import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { loadProject, loadProjectRoleModels } from "$lib/server/control-data";
import { postJson, putJson } from "$lib/server/mutations";

export const load: PageServerLoad = async ({ params }) => {
  const project = await loadProject(params.id);
  if (!project) {
    throw error(404, "Project not found");
  }

  return {
    project,
    modelCatalog: await loadProjectRoleModels(params.id)
  };
};

export const actions: Actions = {
  plan: async ({ params, request }) => {
    const form = await request.formData();
    const returnTab = String(form.get("returnTab") || "").trim();

    try {
      await postJson(`/projects/${params.id}/plan`, {});
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to plan project" });
    }

    throw redirect(303, returnTab ? `/projects/${params.id}?tab=${returnTab}` : `/projects/${params.id}`);
  },
  run: async ({ params, request }) => {
    const form = await request.formData();
    const returnTab = String(form.get("returnTab") || "").trim();

    try {
      await postJson(`/projects/${params.id}/run`, {});
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to run project" });
    }

    throw redirect(303, returnTab ? `/projects/${params.id}?tab=${returnTab}` : `/projects/${params.id}`);
  },
  autonomy: async ({ params, request }) => {
    const form = await request.formData();
    const autonomyMode = String(form.get("autonomyMode") || "").trim();
    const returnTab = String(form.get("returnTab") || "").trim();

    try {
      await putJson(`/projects/${params.id}/autonomy`, { autonomyMode });
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to update autonomy" });
    }

    throw redirect(303, returnTab ? `/projects/${params.id}?tab=${returnTab}` : `/projects/${params.id}`);
  },
  message: async ({ params, request }) => {
    const form = await request.formData();
    const content = String(form.get("content") || "").trim();
    const returnTab = String(form.get("returnTab") || "").trim();
    if (!content) {
      return fail(400, { actionError: "Message content is required" });
    }

    try {
      await postJson(`/projects/${params.id}/messages`, {
        content,
        replyToId: String(form.get("replyToId") || "").trim() || null
      });
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to post message" });
    }

    throw redirect(303, returnTab ? `/projects/${params.id}?tab=${returnTab}` : `/projects/${params.id}`);
  },
  interview: async ({ params, request }) => {
    const form = await request.formData();
    const returnTab = String(form.get("returnTab") || "").trim();

    try {
      await postJson(`/projects/${params.id}/interview`, {});
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to start interview" });
    }

    throw redirect(303, returnTab ? `/projects/${params.id}?tab=${returnTab}` : `/projects/${params.id}`);
  },
  toggleGithubSync: async ({ params, request }) => {
    const form = await request.formData();
    const enabled = String(form.get("enabled") || "").trim();
    const returnTab = String(form.get("returnTab") || "").trim();

    try {
      await putJson(`/projects/${params.id}/github-sync`, { enabled: enabled === "true" });
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to update GitHub sync" });
    }

    throw redirect(303, returnTab ? `/projects/${params.id}?tab=${returnTab}` : `/projects/${params.id}`);
  },
  saveRoles: async ({ params, request }) => {
    const form = await request.formData();
    const rolesRaw = String(form.get("roles") || "").trim();

    let roleDefinitions: unknown;
    try {
      roleDefinitions = JSON.parse(rolesRaw);
    } catch {
      return fail(400, { actionError: "Invalid roles JSON" });
    }

    try {
      await putJson(`/projects/${params.id}/roles`, { roleDefinitions });
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to save roles" });
    }

    throw redirect(303, `/projects/${params.id}?tab=agents`);
  },
  steer: async ({ params, request }) => {
    const form = await request.formData();
    const jobId = String(form.get("jobId") || "").trim();
    const steerContent = String(form.get("steerContent") || "").trim();
    const returnTab = String(form.get("returnTab") || "chat").trim();

    if (!jobId || !steerContent) {
      return fail(400, { actionError: "Job ID and steering content are required" });
    }

    try {
      await postJson(`/projects/${params.id}/jobs/${jobId}/steer`, { content: steerContent });
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to steer job" });
    }

    throw redirect(303, `/projects/${params.id}?tab=${returnTab}`);
  }
};
