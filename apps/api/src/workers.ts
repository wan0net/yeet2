import { hostname } from "node:os";

import type {
  WorkerFleetSummary,
  WorkerHealthState,
  WorkerHeartbeatInput,
  WorkerLeaseSummary,
  WorkerMatchRequest,
  WorkerRegistrationInput,
  WorkerStatus,
  WorkerSummary
} from "@yeet2/domain";

import { prisma } from "./db";

type DbWorker = Awaited<ReturnType<typeof prisma.worker.findMany>>[number];

export class WorkerRegistryError extends Error {
  constructor(
    public readonly code: "worker_not_found" | "validation_error",
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "WorkerRegistryError";
  }
}

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

function normalizeText(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function normalizeCapabilities(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function normalizeWorkerStatus(value: unknown): WorkerStatus | null {
  if (value === "online" || value === "busy" || value === "offline") {
    return value;
  }

  return null;
}

function resolveWorkerHeartbeatStaleMs(): number {
  const raw = envText("YEET2_WORKER_STALE_MS");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 120_000;
  }

  return Math.max(10_000, Math.trunc(parsed));
}

function deriveWorkerHealth(worker: Pick<DbWorker, "status" | "lastHeartbeatAt" | "leaseExpiresAt" | "currentJobId">): {
  healthState: WorkerHealthState;
  healthReason: string | null;
  available: boolean;
} {
  if (worker.status === "offline") {
    return {
      healthState: "offline",
      healthReason: "Worker is marked offline.",
      available: false
    };
  }

  const now = Date.now();
  const staleMs = resolveWorkerHeartbeatStaleMs();
  const lastHeartbeatMs = worker.lastHeartbeatAt?.getTime() ?? 0;
  if (!lastHeartbeatMs || now - lastHeartbeatMs > staleMs) {
    return {
      healthState: "stale",
      healthReason: "Worker heartbeat is stale.",
      available: false
    };
  }

  const leaseExpiresMs = worker.leaseExpiresAt?.getTime() ?? 0;
  if (worker.currentJobId && leaseExpiresMs && leaseExpiresMs < now) {
    return {
      healthState: "expired_lease",
      healthReason: "Worker lease expired while a job is still attached.",
      available: false
    };
  }

  return {
    healthState: "healthy",
    healthReason: null,
    available: worker.status === "online" && !worker.currentJobId
  };
}

async function loadWorkerLeaseSummary(currentJobId: string | null): Promise<{
  currentJobTitle: string | null;
  currentJobStatus: string | null;
  projectName: string | null;
  taskTitle: string | null;
  lease: WorkerLeaseSummary | null;
}> {
  if (!currentJobId) {
    return {
      currentJobTitle: null,
      currentJobStatus: null,
      projectName: null,
      taskTitle: null,
      lease: null
    };
  }

  const job = await prisma.job.findUnique({
    where: { id: currentJobId },
    include: {
      task: {
        include: {
          mission: {
            include: {
              project: true
            }
          }
        }
      }
    }
  });

  if (!job) {
    return {
      currentJobTitle: null,
      currentJobStatus: null,
      projectName: null,
      taskTitle: null,
      lease: {
        projectId: null,
        projectName: null,
        jobId: currentJobId,
        jobTitle: null,
        taskId: null,
        taskTitle: null,
        acquiredAt: null,
        expiresAt: null
      }
    };
  }

  const projectName = job.task.mission.project.name ?? null;
  const taskTitle = job.task.title ?? null;
  const currentJobTitle = job.githubPrTitle ?? taskTitle ?? null;
  const lease: WorkerLeaseSummary = {
    projectId: job.task.mission.project.id,
    projectName,
    jobId: job.id,
    jobTitle: currentJobTitle,
    taskId: job.taskId,
    taskTitle,
    acquiredAt: job.startedAt?.toISOString() ?? null,
    expiresAt: job.completedAt?.toISOString() ?? null
  };

  return {
    currentJobTitle,
    currentJobStatus: job.status,
    projectName,
    taskTitle,
    lease
  };
}

export async function toWorkerSummary(worker: DbWorker): Promise<WorkerSummary> {
  const leaseContext = await loadWorkerLeaseSummary(worker.currentJobId ?? null);
  const health = deriveWorkerHealth(worker);

  return {
    id: worker.id,
    name: worker.name,
    executorType: worker.executorType,
    status: worker.status,
    healthState: health.healthState,
    healthReason: health.healthReason,
    available: health.available,
    capabilities: normalizeCapabilities(worker.capabilities),
    lastHeartbeatAt: worker.lastHeartbeatAt?.toISOString() ?? null,
    leaseExpiresAt: worker.leaseExpiresAt?.toISOString() ?? null,
    currentJobId: worker.currentJobId ?? null,
    currentJobTitle: leaseContext.currentJobTitle,
    currentJobStatus: leaseContext.currentJobStatus,
    projectName: leaseContext.projectName,
    taskTitle: leaseContext.taskTitle,
    lease: worker.currentJobId ? { ...leaseContext.lease, expiresAt: worker.leaseExpiresAt?.toISOString() ?? null } : null,
    host: worker.host ?? null,
    endpoint: worker.endpoint ?? null,
    createdAt: worker.createdAt.toISOString(),
    updatedAt: worker.updatedAt.toISOString()
  };
}

/** Hard cap on the worker registry response so a runaway fleet can't blow
 * up the API memory or the JSON serializer. */
const MAX_WORKER_REGISTRY = 500;

export async function listWorkers(): Promise<WorkerSummary[]> {
  const workers = await prisma.worker.findMany({
    orderBy: [
      {
        lastHeartbeatAt: "desc"
      },
      {
        updatedAt: "desc"
      }
    ],
    take: MAX_WORKER_REGISTRY
  });

  return Promise.all(workers.map((worker) => toWorkerSummary(worker)));
}

export async function summarizeWorkerFleet(): Promise<WorkerFleetSummary> {
  const workers = await listWorkers();
  const capabilityCounts = workers.reduce<Record<string, number>>((counts, worker) => {
    for (const capability of worker.capabilities) {
      counts[capability] = (counts[capability] ?? 0) + 1;
    }

    return counts;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    totalWorkers: workers.length,
    healthyWorkers: workers.filter((worker) => worker.healthState === "healthy").length,
    staleWorkers: workers.filter((worker) => worker.healthState === "stale").length,
    offlineWorkers: workers.filter((worker) => worker.healthState === "offline").length,
    busyWorkers: workers.filter((worker) => worker.status === "busy" || Boolean(worker.currentJobId)).length,
    availableWorkers: workers.filter((worker) => worker.available).length,
    expiredLeaseWorkers: workers.filter((worker) => worker.healthState === "expired_lease").length,
    capabilityCounts
  };
}

function normalizeCapabilityList(capabilities: string[] | undefined): string[] {
  return [...new Set((capabilities ?? []).map((value) => value.trim()).filter(Boolean))];
}

function workerMatchesCapabilities(worker: WorkerSummary, requiredCapabilities: string[]): boolean {
  if (requiredCapabilities.length === 0) {
    return true;
  }

  const available = new Set(worker.capabilities.map((capability) => capability.trim().toLowerCase()));
  return requiredCapabilities.every((capability) => available.has(capability.trim().toLowerCase()));
}

export async function matchWorkers(input: WorkerMatchRequest): Promise<WorkerSummary[]> {
  const executorType = normalizeText(input.executorType)?.toLowerCase() ?? null;
  const requiredCapabilities = normalizeCapabilityList(input.capabilities).map((value) => value.toLowerCase());
  const includeBusy = input.includeBusy === true;
  const workers = await listWorkers();

  return workers
    .filter((worker) => {
      if (executorType && worker.executorType.trim().toLowerCase() !== executorType) {
        return false;
      }

      if (!includeBusy && !worker.available) {
        return false;
      }

      return workerMatchesCapabilities(worker, requiredCapabilities);
    })
    .sort((left, right) => {
      const leftScore = Number(Boolean(left.available)) + Number(left.healthState === "healthy");
      const rightScore = Number(Boolean(right.available)) + Number(right.healthState === "healthy");
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return (right.lastHeartbeatAt ?? "").localeCompare(left.lastHeartbeatAt ?? "");
    });
}

async function persistWorker(data: {
  id?: string | null;
  name: string;
  executorType: string;
  status?: WorkerStatus | null;
  capabilities?: string[];
  lastHeartbeatAt?: string | null;
  leaseExpiresAt?: string | null;
  currentJobId?: string | null;
  host?: string | null;
  endpoint?: string | null;
}): Promise<WorkerSummary> {
  const now = new Date();
  const record = data.id
    ? await prisma.worker.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          name: data.name,
          executorType: data.executorType,
          status: data.status ?? "online",
          capabilities: data.capabilities ?? [],
          lastHeartbeatAt: data.lastHeartbeatAt ? new Date(data.lastHeartbeatAt) : now,
          leaseExpiresAt: data.leaseExpiresAt ? new Date(data.leaseExpiresAt) : null,
          currentJobId: data.currentJobId ?? null,
          host: data.host ?? null,
          endpoint: data.endpoint ?? null
        },
        update: {
          name: data.name,
          executorType: data.executorType,
          ...(data.status ? { status: data.status } : {}),
          ...(data.capabilities ? { capabilities: data.capabilities } : {}),
          ...(data.lastHeartbeatAt ? { lastHeartbeatAt: new Date(data.lastHeartbeatAt) } : { lastHeartbeatAt: now }),
          ...(typeof data.leaseExpiresAt !== "undefined"
            ? { leaseExpiresAt: data.leaseExpiresAt ? new Date(data.leaseExpiresAt) : null }
            : {}),
          ...(typeof data.currentJobId !== "undefined" ? { currentJobId: data.currentJobId } : {}),
          ...(typeof data.host !== "undefined" ? { host: data.host } : {}),
          ...(typeof data.endpoint !== "undefined" ? { endpoint: data.endpoint } : {})
        }
      })
    : await prisma.worker.upsert({
        where: {
          name_executorType: {
            name: data.name,
            executorType: data.executorType
          }
        },
        create: {
          name: data.name,
          executorType: data.executorType,
          status: data.status ?? "online",
          capabilities: data.capabilities ?? [],
          lastHeartbeatAt: data.lastHeartbeatAt ? new Date(data.lastHeartbeatAt) : now,
          leaseExpiresAt: data.leaseExpiresAt ? new Date(data.leaseExpiresAt) : null,
          currentJobId: data.currentJobId ?? null,
          host: data.host ?? null,
          endpoint: data.endpoint ?? null
        },
        update: {
          ...(data.status ? { status: data.status } : {}),
          ...(data.capabilities ? { capabilities: data.capabilities } : {}),
          ...(data.lastHeartbeatAt ? { lastHeartbeatAt: new Date(data.lastHeartbeatAt) } : { lastHeartbeatAt: now }),
          ...(typeof data.leaseExpiresAt !== "undefined"
            ? { leaseExpiresAt: data.leaseExpiresAt ? new Date(data.leaseExpiresAt) : null }
            : {}),
          ...(typeof data.currentJobId !== "undefined" ? { currentJobId: data.currentJobId } : {}),
          ...(typeof data.host !== "undefined" ? { host: data.host } : {}),
          ...(typeof data.endpoint !== "undefined" ? { endpoint: data.endpoint } : {})
        }
      });

  return toWorkerSummary(record);
}

export async function registerWorker(input: WorkerRegistrationInput): Promise<WorkerSummary> {
  const name = input.name.trim();
  const executorType = input.executorType.trim();
  const capabilities = input.capabilities ?? [];

  return persistWorker({
    id: normalizeText(input.id),
    name,
    executorType,
    status: normalizeWorkerStatus(input.status) ?? "online",
    capabilities,
    lastHeartbeatAt: input.lastHeartbeatAt,
    leaseExpiresAt: input.leaseExpiresAt,
    currentJobId: normalizeText(input.currentJobId),
    host: normalizeText(input.host),
    endpoint: normalizeText(input.endpoint)
  });
}

export async function heartbeatWorker(workerId: string, input: WorkerHeartbeatInput): Promise<WorkerSummary> {
  const existing = await prisma.worker.findUnique({
    where: { id: workerId }
  });

  const name = normalizeText(input.name) ?? existing?.name ?? `worker-${workerId.slice(0, 8)}`;
  const executorType = normalizeText(input.executorType) ?? existing?.executorType ?? "local";

  return persistWorker({
    id: workerId,
    name,
    executorType,
    status: normalizeWorkerStatus(input.status) ?? existing?.status ?? "online",
    capabilities: input.capabilities ?? (existing ? normalizeCapabilities(existing.capabilities) : []),
    leaseExpiresAt: input.leaseExpiresAt ?? existing?.leaseExpiresAt?.toISOString() ?? null,
    currentJobId: normalizeText(input.currentJobId) ?? existing?.currentJobId ?? null,
    host: normalizeText(input.host) ?? existing?.host ?? null,
    endpoint: normalizeText(input.endpoint) ?? existing?.endpoint ?? null
  });
}

function parseCapabilitiesEnv(raw: string): string[] {
  if (!raw) {
    return [];
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeCapabilities(parsed);
    } catch {
      return trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
}

export async function seedLocalWorkerFromEnv(): Promise<WorkerSummary | null> {
  if (!envFlag("YEET2_LOCAL_WORKER_ENABLED", true)) {
    return null;
  }

  const name = envText("YEET2_LOCAL_WORKER_NAME") || `local-worker@${hostname()}`;
  const executorType = envText("YEET2_LOCAL_WORKER_EXECUTOR_TYPE") || "local";
  const status = normalizeWorkerStatus(envText("YEET2_LOCAL_WORKER_STATUS")) ?? "online";
  const capabilities = parseCapabilitiesEnv(envText("YEET2_LOCAL_WORKER_CAPABILITIES"));
  const host = normalizeText(envText("YEET2_LOCAL_WORKER_HOST")) ?? hostname();
  const endpoint = normalizeText(envText("YEET2_LOCAL_WORKER_ENDPOINT"));
  const id = normalizeText(envText("YEET2_LOCAL_WORKER_ID"));

  return registerWorker({
    id,
    name,
    executorType,
    status,
    capabilities: capabilities.length > 0 ? capabilities : ["local"],
    lastHeartbeatAt: new Date().toISOString(),
    host,
    endpoint
  });
}
