import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { loadProjects } from "$lib/server/control-data";
import { postJson } from "$lib/server/mutations";

export const load: PageServerLoad = async () => {
  return {
    projects: await loadProjects()
  };
};

export const actions: Actions = {
  register: async ({ request }) => {
    const form = await request.formData();
    const payload = {
      name: String(form.get("name") || "").trim(),
      repoUrl: String(form.get("repo_url") || "").trim() || null,
      defaultBranch: String(form.get("default_branch") || "main").trim() || "main",
      localPath: String(form.get("local_path") || "").trim() || null
    };

    try {
      await postJson("/projects", payload);
    } catch (error) {
      return fail(400, {
        registerError: error instanceof Error ? error.message : "Unable to register project"
      });
    }

    throw redirect(303, "/projects");
  }
};
