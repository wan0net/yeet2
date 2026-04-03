import type { PageServerLoad } from "./$types";
import { apiJson } from "$lib/server/api";

export const load: PageServerLoad = async () => ({
  approvals: (await apiJson<{ approvals: Array<Record<string, unknown>> }>("/approvals")).approvals ?? []
});
