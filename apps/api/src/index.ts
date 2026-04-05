import Fastify from "fastify";

import { createAutonomyLoopManager } from "./autonomy-loop";
import { describeApiAuth, requireApiAuth } from "./auth";
import { registerAuthRoutes } from "./routes/auth";
import { registerProjectRoutes } from "./routes/projects";
import { registerSettingsRoutes } from "./routes/settings";
import { registerSystemRoutes } from "./routes/system";
import { registerWebhookRoutes } from "./routes/webhooks";
import { registerWorkerRoutes } from "./routes/workers";
import { seedLocalWorkerFromEnv } from "./workers";

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

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";
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

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  try {
    await app.close();
  } catch (error) {
    app.log.error(error);
    await loopManager.stop();
  }
}

process.once("SIGINT", () => {
  void shutdown();
});

process.once("SIGTERM", () => {
  void shutdown();
});

async function main() {
  try {
    await seedLocalWorkerFromEnv();
    loopManager.start();
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    await loopManager.stop();
    process.exit(1);
  }
}

void main();
