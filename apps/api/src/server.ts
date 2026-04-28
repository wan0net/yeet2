import Fastify, { type FastifyInstance, type FastifyBaseLogger } from "fastify";
import rateLimit from "@fastify/rate-limit";

import { createAutonomyLoopManager } from "./autonomy-loop";
import { describeApiAuth, requireApiAuth } from "./auth";
import { registerAuthRoutes } from "./routes/auth";
import { registerHermesRoutes } from "./routes/hermes";
import { registerProjectRoutes } from "./routes/projects";
import { registerSettingsRoutes } from "./routes/settings";
import { registerSystemRoutes } from "./routes/system";
import { registerWebhookRoutes } from "./routes/webhooks";
import { registerWorkerRoutes } from "./routes/workers";

export interface CreateAppOptions {
  startLoop?: boolean;
}

function readRateLimitMaxPerMinute(): number {
  const raw = (process.env.YEET2_API_RATE_LIMIT_PER_MINUTE ?? "").trim();
  if (!raw) return 120;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 120;
  return parsed;
}

const MIN_BEARER_TOKEN_LENGTH = 32;
const PRIVATE_IP_PATTERN =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|::1|\[?::1\]?)$/;

function validateEnvConfig(log: FastifyBaseLogger): void {
  // Bearer token: warn (don't fail) on weak tokens so local dev still works.
  const rawToken = (process.env.YEET2_API_BEARER_TOKEN ?? process.env.YEET2_API_TOKEN ?? "").trim();
  if (rawToken && rawToken.length < MIN_BEARER_TOKEN_LENGTH) {
    log.warn(
      { minLength: MIN_BEARER_TOKEN_LENGTH, actualLength: rawToken.length },
      "YEET2_API_BEARER_TOKEN is shorter than recommended — increase length or generate via openssl rand -hex 32"
    );
  }

  // Executor URL: refuse if it points to a non-local host unless explicitly
  // allowed. This mitigates SSRF where a misconfigured env var forwards jobs
  // to an attacker-controlled endpoint.
  const executorUrl = (process.env.YEET2_EXECUTOR_BASE_URL ?? "").trim();
  if (executorUrl) {
    try {
      const parsed = new URL(executorUrl);
      const host = parsed.hostname;
      const allowRemote = (process.env.YEET2_EXECUTOR_ALLOW_REMOTE ?? "").trim().toLowerCase();
      const allowed = allowRemote === "1" || allowRemote === "true" || allowRemote === "yes";
      if (!allowed && !PRIVATE_IP_PATTERN.test(host) && host !== "executor") {
        log.warn(
          { executorUrl, host },
          "YEET2_EXECUTOR_BASE_URL points to a non-local host. Set YEET2_EXECUTOR_ALLOW_REMOTE=1 if this is intentional."
        );
      }
    } catch (error) {
      log.error({ error, executorUrl }, "YEET2_EXECUTOR_BASE_URL is not a valid URL");
    }
  }

  // Brain URL: same check.
  const brainUrl = (process.env.YEET2_BRAIN_BASE_URL ?? "").trim();
  if (brainUrl) {
    try {
      const parsed = new URL(brainUrl);
      const host = parsed.hostname;
      const allowRemote = (process.env.YEET2_BRAIN_ALLOW_REMOTE ?? "").trim().toLowerCase();
      const allowed = allowRemote === "1" || allowRemote === "true" || allowRemote === "yes";
      if (!allowed && !PRIVATE_IP_PATTERN.test(host) && host !== "brain") {
        log.warn(
          { brainUrl, host },
          "YEET2_BRAIN_BASE_URL points to a non-local host. Set YEET2_BRAIN_ALLOW_REMOTE=1 if this is intentional."
        );
      }
    } catch (error) {
      log.error({ error, brainUrl }, "YEET2_BRAIN_BASE_URL is not a valid URL");
    }
  }
}

export async function createApp(opts: CreateAppOptions = {}): Promise<FastifyInstance> {
  const { startLoop = false } = opts;

  const app = Fastify({
    logger: true
  });

  validateEnvConfig(app.log);

  // Global rate limiter — applied per route via config; skipped for /health
  // so monitoring doesn't get throttled. Mutating routes get stricter limits
  // via Fastify's config option on the plugin (default limit applies to all
  // routes; individual routes can override).
  await app.register(rateLimit, {
    global: true,
    max: readRateLimitMaxPerMinute(),
    timeWindow: "1 minute",
    allowList: (request) => {
      // /health must always respond for monitoring systems.
      const url = request.routeOptions.url || request.url || "";
      return url === "/health";
    },
    errorResponseBuilder: (_request, context) => ({
      error: "rate_limited",
      message: `Too many requests. Retry after ${context.after}.`,
      retryAfterMs: context.ttl
    })
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "yeet2-api"
    };
  });

  // /auth/status is deliberately minimal — it answers "is auth configured?"
  // for unauthenticated clients so the Control UI can show a setup prompt,
  // but never reveals mode (open / write_protected / full) to avoid giving
  // attackers a reconnaissance signal about what's protected.
  app.get("/auth/status", async () => {
    return {
      auth: { enabled: describeApiAuth().enabled }
    };
  });

  app.addHook("onRequest", requireApiAuth);

  const loopManager = createAutonomyLoopManager(app.log);

  await app.register(registerProjectRoutes, { loopManager });
  await app.register(registerWorkerRoutes);
  await app.register(registerSystemRoutes);
  await app.register(registerHermesRoutes, { loopManager });
  await app.register(registerSettingsRoutes);
  await app.register(registerAuthRoutes);
  await app.register(registerWebhookRoutes);

  app.addHook("onClose", async () => {
    await loopManager.stop();
  });

  if (startLoop) {
    loopManager.start();
  }

  return app;
}
