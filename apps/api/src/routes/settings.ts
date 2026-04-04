import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { deleteSetting, getSetting, setSetting } from "../settings";

export const registerSettingsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/settings/github-token", async (_request, reply) => {
    try {
      const token = await getSetting("github_token");
      return reply.code(200).send({ configured: token !== null && token.length > 0 });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: "internal_error", message: "Unable to load GitHub token setting" });
    }
  });

  app.put("/settings/github-token", async (request, reply) => {
    try {
      const body = request.body as { token?: unknown };
      const token = typeof body?.token === "string" ? body.token.trim() : "";
      if (!token) {
        return reply.code(400).send({ error: "validation_error", message: "token is required" });
      }
      await setSetting("github_token", token);
      return reply.code(200).send({ ok: true });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: "internal_error", message: "Unable to save GitHub token" });
    }
  });

  app.delete("/settings/github-token", async (_request, reply) => {
    try {
      await deleteSetting("github_token");
      return reply.code(200).send({ ok: true });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: "internal_error", message: "Unable to remove GitHub token" });
    }
  });
};
