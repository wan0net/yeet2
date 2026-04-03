import Fastify from "fastify";

import { createAutonomyLoopManager } from "./autonomy-loop";
import { describeApiAuth, requireApiAuth } from "./auth";
import { registerProjectRoutes } from "./routes/projects";
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
