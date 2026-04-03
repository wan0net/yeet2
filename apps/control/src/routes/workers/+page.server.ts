import type { PageServerLoad } from "./$types";
import { apiJson } from "$lib/server/api";

export const load: PageServerLoad = async () => ({
  workers: (await apiJson<{ workers: Array<Record<string, unknown>> }>("/workers")).workers ?? [],
  summary: (await apiJson<{ summary: Record<string, unknown> }>("/workers/summary")).summary
});
