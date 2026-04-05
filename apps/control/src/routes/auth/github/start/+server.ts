import type { RequestHandler } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { apiJson } from "$lib/server/api";

export const GET: RequestHandler = async () => {
  let url: string;
  try {
    const result = await apiJson<{ url: string }>("/auth/github");
    url = result.url;
  } catch {
    throw redirect(302, "/settings?error=oauth_not_configured");
  }
  throw redirect(302, url);
};
