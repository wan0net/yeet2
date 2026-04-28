import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { apiJson } from "$lib/server/api";
import { deleteJson, putJson } from "$lib/server/mutations";

interface ThemeOption { key: string; label: string }

export const load: PageServerLoad = async () => {
  const [tokenStatus, themeStatus, oauthStatus] = await Promise.all([
    apiJson<{ configured: boolean }>("/settings/github-token"),
    apiJson<{ active: string; themes: ThemeOption[] }>("/settings/agent-theme"),
    apiJson<{ configured: boolean }>("/settings/github-oauth-configured")
  ]);
  return {
    githubTokenConfigured: tokenStatus.configured,
    githubOAuthConfigured: oauthStatus.configured,
    activeTheme: themeStatus.active,
    themes: themeStatus.themes
  };
};

export const actions: Actions = {
  saveToken: async ({ request }) => {
    const form = await request.formData();
    const token = String(form.get("token") || "").trim();
    if (!token) return fail(400, { actionError: "Token is required" });
    try {
      await putJson("/settings/github-token", { token });
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to save token" });
    }
    throw redirect(303, "/settings");
  },
  setTheme: async ({ request }) => {
    const form = await request.formData();
    const theme = String(form.get("theme") || "").trim();
    if (!theme) return fail(400, { actionError: "Theme is required" });
    try {
      await putJson("/settings/agent-theme", { theme });
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to save theme" });
    }
    throw redirect(303, "/settings");
  },
  removeToken: async () => {
    try {
      await deleteJson("/settings/github-token");
    } catch (err) {
      return fail(400, { actionError: err instanceof Error ? err.message : "Unable to remove token" });
    }
    throw redirect(303, "/settings");
  }
};
