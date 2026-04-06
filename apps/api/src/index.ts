import { createApp } from "./server";
import { seedLocalWorkerFromEnv } from "./workers";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

let shuttingDown = false;

async function shutdown(app: Awaited<ReturnType<typeof createApp>>): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  try {
    await app.close();
  } catch (error) {
    app.log.error(error);
  }
}

async function main() {
  const app = await createApp({ startLoop: true });

  process.once("SIGINT", () => {
    void shutdown(app);
  });

  process.once("SIGTERM", () => {
    void shutdown(app);
  });

  try {
    await seedLocalWorkerFromEnv();
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    await app.close();
    process.exit(1);
  }
}

void main();
