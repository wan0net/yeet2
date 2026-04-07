import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";

import { prisma } from "./db";
import { logger } from "./logger";

/**
 * Setting values that contain credentials are encrypted at rest with AES-256-GCM.
 * Encryption is enabled when YEET2_SETTING_ENCRYPTION_KEY is set to any
 * non-empty string. The key is hashed (SHA-256) to derive the 32-byte AES key.
 *
 * Encrypted values are stored as `enc:v1:<iv-base64>:<ciphertext-base64>:<auth-tag-base64>`.
 * Plain values written before encryption was enabled are read as-is and
 * silently re-encrypted on the next write — no migration step required.
 */

const SENSITIVE_SETTING_KEYS = new Set(["github_token"]);
const ENCRYPTED_PREFIX = "enc:v1:";

function deriveKey(): Buffer | null {
  const raw = (process.env.YEET2_SETTING_ENCRYPTION_KEY ?? "").trim();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

function encryptValue(plaintext: string): string {
  const key = deriveKey();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${ciphertext.toString("base64")}:${tag.toString("base64")}`;
}

function decryptValue(stored: string): string {
  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    // Legacy plaintext value — return as-is. The caller can re-write to
    // upgrade to ciphertext.
    return stored;
  }
  const key = deriveKey();
  if (!key) {
    // Encryption is not currently configured but the value was encrypted
    // previously. Surface an error so operators notice the misconfiguration.
    throw new Error(
      "Encrypted setting found but YEET2_SETTING_ENCRYPTION_KEY is not set"
    );
  }
  const parts = stored.slice(ENCRYPTED_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Encrypted setting has invalid format");
  }
  const [ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function shouldEncrypt(key: string): boolean {
  return SENSITIVE_SETTING_KEYS.has(key);
}

export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  if (!setting?.value) return null;
  if (!shouldEncrypt(key)) return setting.value;
  try {
    return decryptValue(setting.value);
  } catch (error) {
    logger.error("Failed to decrypt sensitive setting", {
      key,
      error: error instanceof Error ? { name: error.name, message: error.message } : { value: String(error) }
    });
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const stored = shouldEncrypt(key) ? encryptValue(value) : value;
  await prisma.setting.upsert({
    where: { key },
    update: { value: stored },
    create: { key, value: stored }
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

// Exported for tests only.
export const __internal_encryptValue = encryptValue;
export const __internal_decryptValue = decryptValue;
