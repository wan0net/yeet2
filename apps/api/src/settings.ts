import { prisma } from "./db";

export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}

export async function deleteSetting(key: string): Promise<void> {
  await prisma.setting.deleteMany({ where: { key } });
}

export async function getGitHubToken(): Promise<string | null> {
  const dbToken = await getSetting("github_token");
  if (dbToken) return dbToken;
  const envToken = process.env.GITHUB_TOKEN?.trim();
  return envToken || null;
}
