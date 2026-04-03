import type { FastifyReply, FastifyRequest } from "fastify";

function envText(name: string): string {
  return (process.env[name] ?? "").trim();
}

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = envText(name).toLowerCase();
  if (!raw) {
    return defaultValue;
  }

  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
    return true;
  }

  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }

  return defaultValue;
}

function normalizeBearerToken(value: string): string {
  return value.replace(/^bearer\s+/i, "").trim();
}

function readConfiguredApiToken(): string | null {
  const token = envText("YEET2_API_BEARER_TOKEN") || envText("YEET2_API_TOKEN");
  return token || null;
}

function readRequireAuthForReads(): boolean {
  return envFlag("YEET2_API_REQUIRE_AUTH_FOR_READS", false);
}

function isReadMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function isPublicPath(pathname: string): boolean {
  return pathname === "/health";
}

function parseAuthorizationHeader(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string" || !authorization.trim()) {
    return null;
  }

  return normalizeBearerToken(authorization);
}

export function shouldRequireApiAuth(request: FastifyRequest): boolean {
  const configuredToken = readConfiguredApiToken();
  if (!configuredToken) {
    return false;
  }

  const pathname = request.routeOptions.url || request.url || "";
  if (isPublicPath(pathname)) {
    return false;
  }

  if (!readRequireAuthForReads() && isReadMethod(request.method)) {
    return false;
  }

  return true;
}

export function describeApiAuth(): {
  enabled: boolean;
  requireAuthForReads: boolean;
  mode: "open" | "write_protected" | "full";
} {
  const enabled = Boolean(readConfiguredApiToken());
  const requireAuthForReads = readRequireAuthForReads();

  return {
    enabled,
    requireAuthForReads,
    mode: !enabled ? "open" : requireAuthForReads ? "full" : "write_protected"
  };
}

export async function requireApiAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const configuredToken = readConfiguredApiToken();
  if (!configuredToken || !shouldRequireApiAuth(request)) {
    return;
  }

  const receivedToken = parseAuthorizationHeader(request);
  if (receivedToken && receivedToken === normalizeBearerToken(configuredToken)) {
    return;
  }

  await reply.code(401).send({
    error: "unauthorized",
    message: "A valid bearer token is required for this API route."
  });
}
