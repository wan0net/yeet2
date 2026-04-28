import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { WorkerRegistryError, heartbeatWorker, listWorkers, matchWorkers, registerWorker, summarizeWorkerFleet } from "../workers";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalNullableString(candidate: Record<string, unknown>, ...keys: string[]): string | null | undefined {
  for (const key of keys) {
    if (!(key in candidate)) {
      continue;
    }

    const value = candidate[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed || null;
    }

    return null;
  }

  return undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function parseWorkerStatus(value: unknown) {
  const normalized = readString(value).toLowerCase();
  return normalized === "online" || normalized === "busy" || normalized === "offline" ? normalized : null;
}

function parseWorkerRegistrationBody(body: unknown): {
  input: {
    id?: string | null;
    name: string;
    executorType: string;
    status?: "online" | "busy" | "offline" | null;
    capabilities?: string[];
    lastHeartbeatAt?: string | null;
    leaseExpiresAt?: string | null;
    currentJobId?: string | null;
    host?: string | null;
    endpoint?: string | null;
  } | null;
  error: string | null;
} {
  if (typeof body !== "object" || body === null) {
    return { input: null, error: "Request body must be an object" };
  }

  const candidate = body as Record<string, unknown>;
  const name = readString(candidate.name ?? candidate.workerName);
  const executorType = readString(candidate.executorType ?? candidate.kind);

  if (!name) {
    return { input: null, error: "name is required" };
  }

  if (!executorType) {
    return { input: null, error: "executorType is required" };
  }

  return {
    input: {
      id: readString(candidate.id) || null,
      name,
      executorType,
      status: parseWorkerStatus(candidate.status),
      capabilities: readStringArray(candidate.capabilities ?? candidate.capabilityList),
      lastHeartbeatAt: readString(candidate.lastHeartbeatAt ?? candidate.last_heartbeat_at) || null,
      leaseExpiresAt: readString(candidate.leaseExpiresAt ?? candidate.lease_expires_at) || null,
      currentJobId: readString(candidate.currentJobId ?? candidate.current_job_id) || null,
      host: readString(candidate.host) || null,
      endpoint: readString(candidate.endpoint) || null
    },
    error: null
  };
}

function parseWorkerHeartbeatBody(body: unknown): {
  input: {
    name?: string | null;
    executorType?: string | null;
    status?: "online" | "busy" | "offline" | null;
    capabilities?: string[];
    leaseExpiresAt?: string | null;
    currentJobId?: string | null;
    host?: string | null;
    endpoint?: string | null;
  } | null;
  error: string | null;
} {
  if (typeof body !== "object" || body === null) {
    return { input: null, error: "Request body must be an object" };
  }

  const candidate = body as Record<string, unknown>;
  return {
    input: {
      name: readOptionalNullableString(candidate, "name"),
      executorType: readOptionalNullableString(candidate, "executorType", "kind"),
      status: "status" in candidate ? parseWorkerStatus(candidate.status) : undefined,
      capabilities: "capabilities" in candidate ? readStringArray(candidate.capabilities) : undefined,
      leaseExpiresAt: readOptionalNullableString(candidate, "leaseExpiresAt", "lease_expires_at"),
      currentJobId: readOptionalNullableString(candidate, "currentJobId", "current_job_id"),
      host: readOptionalNullableString(candidate, "host"),
      endpoint: readOptionalNullableString(candidate, "endpoint")
    },
    error: null
  };
}

function parseWorkerMatchQuery(query: unknown): {
  input: { executorType?: string | null; capabilities?: string[]; includeBusy?: boolean } | null;
  error: string | null;
} {
  if (typeof query !== "object" || query === null) {
    return {
      input: {
        executorType: null,
        capabilities: [],
        includeBusy: false
      },
      error: null
    };
  }

  const candidate = query as Record<string, unknown>;
  const rawCapabilities = candidate.capabilities ?? candidate.capability ?? candidate.requires;
  const capabilities = Array.isArray(rawCapabilities)
    ? readStringArray(rawCapabilities)
    : typeof rawCapabilities === "string"
      ? rawCapabilities.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  const rawIncludeBusy = candidate.includeBusy ?? candidate.include_busy;
  const includeBusy =
    rawIncludeBusy === true ||
    rawIncludeBusy === "true" ||
    rawIncludeBusy === "1" ||
    rawIncludeBusy === "yes";

  return {
    input: {
      executorType: readString(candidate.executorType ?? candidate.executor_type) || null,
      capabilities,
      includeBusy
    },
    error: null
  };
}

export const registerWorkerRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/workers", async () => {
    return { workers: await listWorkers() };
  });

  app.get("/workers/summary", async () => {
    return { summary: await summarizeWorkerFleet() };
  });

  app.get("/workers/match", async (request, reply) => {
    const parsedQuery = parseWorkerMatchQuery(request.query);
    if (!parsedQuery.input) {
      return reply.code(400).send({
        error: "validation_error",
        message: parsedQuery.error ?? "Invalid worker match query"
      });
    }

    return reply.code(200).send({
      workers: await matchWorkers(parsedQuery.input)
    });
  });

  app.post("/workers/register", async (request, reply) => {
    const parsedBody = parseWorkerRegistrationBody(request.body);
    if (!parsedBody.input) {
      return reply.code(400).send({
        error: "validation_error",
        message: parsedBody.error ?? "Invalid worker registration body"
      });
    }

    try {
      const worker = await registerWorker(parsedBody.input);
      return reply.code(200).send({ worker });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to register worker"
      });
    }
  });

  app.post("/workers/:workerId/heartbeat", async (request, reply) => {
    const { workerId } = request.params as { workerId?: string };
    if (!workerId) {
      return reply.code(400).send({
        error: "validation_error",
        message: "workerId is required"
      });
    }

    const parsedBody = parseWorkerHeartbeatBody(request.body);
    if (!parsedBody.input) {
      return reply.code(400).send({
        error: "validation_error",
        message: parsedBody.error ?? "Invalid worker heartbeat body"
      });
    }

    try {
      const worker = await heartbeatWorker(workerId, parsedBody.input);
      return reply.code(200).send({ worker });
    } catch (error) {
      if (error instanceof WorkerRegistryError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        error: "internal_error",
        message: "Unable to record worker heartbeat"
      });
    }
  });
};
