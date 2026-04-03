import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { postJson } from "$lib/server/mutations";

export const actions: Actions = {
  register: async ({ request }) => {
    const form = await request.formData();
    const payload = {
      name: String(form.get("name") || "").trim(),
      repoUrl: String(form.get("repo_url") || "").trim() || null,
      defaultBranch: String(form.get("default_branch") || "main").trim() || "main",
      localPath: String(form.get("local_path") || "").trim() || null
    };

    let response: { project?: { id?: string } } | null = null;
    try {
      response = (await postJson("/projects", payload)) as { project?: { id?: string } } | null;
    } catch (error) {
      return fail(400, {
        registerError: error instanceof Error ? error.message : "Unable to register project",
        values: {
          name: payload.name,
          repoUrl: payload.repoUrl ?? "",
          defaultBranch: payload.defaultBranch,
          localPath: payload.localPath ?? ""
        }
      });
    }

    const projectId = response?.project?.id;
    throw redirect(303, projectId ? `/projects/${projectId}` : "/projects");
  }
};
