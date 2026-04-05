import type { RequestHandler } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { apiFetch } from "$lib/server/api";

export const GET: RequestHandler = async ({ url }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    throw redirect(302, "/settings?error=oauth_failed");
  }

  try {
    const params = new URLSearchParams({ code, state });
    const response = await apiFetch(`/auth/github/callback?${params.toString()}`);
    if (!response.ok) {
      throw redirect(302, "/settings?error=oauth_failed");
    }
  } catch (err) {
    // Re-throw SvelteKit redirects (they have a status property in the 3xx range)
    if (
      err instanceof Response ||
      (err && typeof err === "object" && "status" in err && Number((err as { status: number }).status) >= 300 && Number((err as { status: number }).status) < 400)
    ) {
      throw err;
    }
    throw redirect(302, "/settings?error=oauth_failed");
  }

  throw redirect(302, "/settings");
};
