import Fastify, { type FastifyInstance } from "fastify";

import { createAutonomyLoopManager } from "./autonomy-loop";
import { describeApiAuth, requireApiAuth } from "./auth";
import { registerAuthRoutes } from "./routes/auth";
import { registerProjectRoutes } from "./routes/projects";
import { registerSettingsRoutes } from "./routes/settings";
import { registerSystemRoutes } from "./routes/system";
import { registerWebhookRoutes } from "./routes/webhooks";
import { registerWorkerRoutes } from "./routes/workers";

export interface CreateAppOptions {
  startLoop?: boolean;
}

export async function createApp(opts: CreateAppOptions = {}): Promise<FastifyInstance> {
  const { startLoop = false } = opts;

  const app = Fastify({
    logger: true
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "yeet2-api"
    };
  });

  app.get("/auth/status", async () => {
    return {
      auth: describeApiAuth()
    };
  });

  app.addHook("onRequest", requireApiAuth);

  const loopManager = createAutonomyLoopManager(app.log);

  await app.register(registerProjectRoutes, { loopManager });
  await app.register(registerWorkerRoutes);
  await app.register(registerSystemRoutes);
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
