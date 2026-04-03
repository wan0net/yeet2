import { buildControlPlaneOverview } from "$lib/server/overview-local";

export async function load() {
  return {
    overview: await buildControlPlaneOverview()
  };
}
