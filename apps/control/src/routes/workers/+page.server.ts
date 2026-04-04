import type { PageServerLoad } from "./$types";
import { apiJson } from "$lib/server/api";

export const load: PageServerLoad = async () => {
  const workers = (await apiJson<{ workers: Array<Record<string, unknown>> }>("/workers")).workers ?? [];

  let summary: Record<string, unknown> | null = null;
  try {
    summary = (await apiJson<{ summary: Record<string, unknown> }>("/workers/summary")).summary;
  } catch {
    // Summary endpoint may not be available.
  }

  return { workers, summary };
};
