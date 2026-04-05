import crypto from "node:crypto";

import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { setSetting } from "../settings";

interface StateEntry {
  expiresAt: number;
}

const pendingStates = new Map<string, StateEntry>();

function cleanExpiredStates() {
  const now = Date.now();
  for (const [key, entry] of pendingStates) {
    if (entry.expiresAt < now) {
      pendingStates.delete(key);
    }
  }
}

export const registerAuthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/auth/github", async (_request, reply) => {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) {
      return reply.code(400).send({
        error: "oauth_not_configured",
        message: "GitHub OAuth is not configured"
      });
    }

    cleanExpiredStates();
    const state = crypto.randomBytes(16).toString("hex");
    pendingStates.set(state, { expiresAt: Date.now() + 10 * 60 * 1000 });

    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("scope", "repo,project");
    url.searchParams.set("state", state);

    return reply.code(200).send({ url: url.toString() });
  });

  app.get("/auth/github/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string };
    const { code, state } = query;

    if (!state || !pendingStates.has(state)) {
      return reply.code(400).send({
        error: "invalid_state",
        message: "Invalid or expired OAuth state"
      });
    }

    const entry = pendingStates.get(state)!;
    if (entry.expiresAt < Date.now()) {
      pendingStates.delete(state);
      return reply.code(400).send({
        error: "expired_state",
        message: "OAuth state has expired"
      });
    }

    pendingStates.delete(state);

    if (!code) {
      return reply.code(400).send({
        error: "missing_code",
        message: "Missing OAuth code"
      });
    }

    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return reply.code(400).send({
        error: "oauth_not_configured",
        message: "GitHub OAuth is not configured"
      });
    }

    try {
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
      });

      if (!tokenResponse.ok) {
        app.log.error({ status: tokenResponse.status }, "GitHub token exchange failed");
        return reply.code(502).send({
          error: "token_exchange_failed",
          message: "Failed to exchange OAuth code for token"
        });
      }

      const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

      if (tokenData.error || !tokenData.access_token) {
        app.log.error({ githubError: tokenData.error }, "GitHub OAuth error response");
        return reply.code(400).send({
          error: "oauth_error",
          message: tokenData.error || "GitHub did not return an access token"
        });
      }

      await setSetting("github_token", tokenData.access_token);
      return reply.code(200).send({ ok: true });
    } catch (error) {
      app.log.error(error, "OAuth token exchange error");
      return reply.code(500).send({
        error: "internal_error",
        message: "Internal error during OAuth token exchange"
      });
    }
  });
};
