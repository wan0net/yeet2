import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { WorkerRegistryError, heartbeatWorker, listWorkers, registerWorker } from "../workers";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
      name: readString(candidate.name) || null,
      executorType: readString(candidate.executorType ?? candidate.kind) || null,
      status: parseWorkerStatus(candidate.status),
      capabilities: readStringArray(candidate.capabilities),
      leaseExpiresAt: readString(candidate.leaseExpiresAt ?? candidate.lease_expires_at) || null,
      currentJobId: readString(candidate.currentJobId ?? candidate.current_job_id) || null,
      host: readString(candidate.host) || null,
      endpoint: readString(candidate.endpoint) || null
    },
    error: null
  };
}

export const registerWorkerRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/workers", async () => {
    return { workers: await listWorkers() };
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
