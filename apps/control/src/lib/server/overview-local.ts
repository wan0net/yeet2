import type { ControlPlaneOverview } from "@yeet2/domain";
import { apiJson } from "./api";

export async function buildControlPlaneOverview(): Promise<ControlPlaneOverview> {
  const payload = await apiJson<{ overview: ControlPlaneOverview }>("/overview");
  return payload.overview;
}
