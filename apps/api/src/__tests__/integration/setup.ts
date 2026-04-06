import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { PrismaClient } from "@yeet2/db";

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://localhost/yeet2_test";

/** Check DB connectivity — returns false if the server is unreachable. */
async function isDbReachable(): Promise<boolean> {
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

export function setupTestDatabase() {
  beforeAll(async () => {
    if (!(await isDbReachable())) {
      throw new Error(`Integration test database unreachable: ${TEST_DB_URL}. Start PostgreSQL or set TEST_DATABASE_URL.`);
    }
    // Push schema to test DB (force-reset drops and recreates all tables)
    const result = spawnSync(
      "pnpm",
      ["--filter", "@yeet2/db", "exec", "prisma", "migrate", "deploy"],
      {
        env: { ...process.env, DATABASE_URL: TEST_DB_URL },
        stdio: "inherit"
      }
    );
    if (result.status !== 0) {
      throw new Error("Prisma migrate deploy failed");
    }
  });
}

export function truncateAllTables() {
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE jobs, blockers, decision_logs, tasks, missions, project_role_definitions, constitutions, projects, workers, settings RESTART IDENTITY CASCADE`
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  return prisma;
}
