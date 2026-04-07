import type { PageServerLoad } from "./$types";
import { apiJson } from "$lib/server/api";

export const load: PageServerLoad = async () => {
  let workers: Array<Record<string, unknown>> = [];
  try {
    workers = (await apiJson<{ workers: Array<Record<string, unknown>> }>("/workers")).workers ?? [];
  } catch {
    // API unreachable — render empty registry so the page chrome still loads.
  }

  let summary: Record<string, unknown> | null = null;
  try {
    summary = (await apiJson<{ summary: Record<string, unknown> }>("/workers/summary")).summary;
  } catch {
    // Summary endpoint may not be available.
  }

  return { workers, summary };
};
