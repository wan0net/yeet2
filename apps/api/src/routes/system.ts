import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { buildControlPlaneOverview } from "../overview";

export const registerSystemRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/overview", async (_request, reply) => {
    try {
      return reply.code(200).send({
        overview: await buildControlPlaneOverview()
      });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to load control plane overview"
      });
    }
  });
};

