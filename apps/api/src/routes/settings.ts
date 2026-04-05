import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { AGENT_THEME_NAMES } from "@yeet2/domain";
import { deleteSetting, getSetting, setSetting } from "../settings";

const THEME_LABELS: Record<string, string> = {
  mythology: "Greek Mythology",
  norse: "Norse Mythology",
  "star-trek-tos": "Star Trek: The Original Series",
  "star-trek-tng": "Star Trek: The Next Generation",
  "star-trek-ds9": "Star Trek: Deep Space Nine",
  "star-trek-voyager": "Star Trek: Voyager",
  "star-wars": "Star Wars",
  "stargate-sg1": "Stargate SG-1",
  "stargate-atlantis": "Stargate Atlantis",
  "stargate-universe": "Stargate Universe",
  firefly: "Firefly",
  hitchhikers: "The Hitchhiker's Guide to the Galaxy",
  dune: "Dune",
  lotr: "The Lord of the Rings",
  matrix: "The Matrix",
  "doctor-who": "Doctor Who",
  expanse: "The Expanse",
  "red-dwarf": "Red Dwarf",
  futurama: "Futurama",
  "silicon-valley": "Silicon Valley",
  severance: "Severance",
  "blade-runner": "Blade Runner",
  westworld: "Westworld",
  "the-office": "The Office",
  "it-crowd": "The IT Crowd",
  foundation: "Foundation"
};

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

  app.get("/settings/agent-theme", async (_request, reply) => {
    try {
      const dbTheme = await getSetting("agent_theme");
      const active = dbTheme || process.env.YEET2_AGENT_NAME_THEME?.trim().toLowerCase() || "mythology";
      return reply.code(200).send({
        active,
        themes: AGENT_THEME_NAMES.map((key) => ({ key, label: THEME_LABELS[key] || key }))
      });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: "internal_error", message: "Unable to load theme setting" });
    }
  });

  app.put("/settings/agent-theme", async (request, reply) => {
    try {
      const body = request.body as { theme?: unknown };
      const theme = typeof body?.theme === "string" ? body.theme.trim().toLowerCase() : "";
      if (!theme || !AGENT_THEME_NAMES.includes(theme)) {
        return reply.code(400).send({ error: "validation_error", message: "Invalid theme" });
      }
      await setSetting("agent_theme", theme);
      return reply.code(200).send({ ok: true, active: theme });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: "internal_error", message: "Unable to save theme" });
    }
  });

  app.get("/settings/github-oauth-configured", async (_request, reply) => {
    return reply.code(200).send({ configured: !!process.env.GITHUB_OAUTH_CLIENT_ID });
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
