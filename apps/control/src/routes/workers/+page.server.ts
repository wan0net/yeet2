import type { PageServerLoad } from "./$types";
import { apiJson } from "$lib/server/api";
import { serverLogger } from "$lib/server/logger";

export const load: PageServerLoad = async () => {
  let workers: Array<Record<string, unknown>> = [];
  try {
    workers = (await apiJson<{ workers: Array<Record<string, unknown>> }>("/workers")).workers ?? [];
  } catch (error) {
    // API unreachable — render empty registry so the page chrome still loads.
    serverLogger.loadFailure("workers/load/workers", error);
  }

  let summary: Record<string, unknown> | null = null;
  try {
    summary = (await apiJson<{ summary: Record<string, unknown> }>("/workers/summary")).summary;
  } catch (error) {
    // Summary endpoint may not be available.
    serverLogger.loadFailure("workers/load/summary", error);
  }

  return { workers, summary };
};
