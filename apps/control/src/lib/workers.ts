import { controlBaseUrl } from "./project-resource";

export type WorkerStatus = "idle" | "busy" | "offline" | "error" | "unknown";

export interface WorkerLeaseInfo {
  projectId: string | null;
  projectName: string | null;
  jobId: string | null;
  jobTitle: string | null;
  taskId: string | null;
  taskTitle: string | null;
  acquiredAt: string | null;
  expiresAt: string | null;
}

export interface WorkerRecord {
  id: string;
  name: string;
  status: string;
  kind: string | null;
  executorType: string | null;
  capabilities: string[];
  lastHeartbeatAt: string | null;
  lease: WorkerLeaseInfo | null;
  currentJobId: string | null;
  currentJobTitle: string | null;
  currentJobStatus: string | null;
}

export interface WorkerRegistrySnapshot {
  workers: WorkerRecord[];
  registryAvailable: boolean;
  status: number | null;
  error: string | null;
  detail: unknown | null;
}

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  return value as RawRecord;
}

function stringValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return "";
}

function stringOrNull(...values: unknown[]): string | null {
  const value = stringValue(...values);
  return value.length > 0 ? value : null;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }

      if (typeof entry === "object" && entry !== null) {
        const raw = asRecord(entry);
        return stringValue(raw.name, raw.label, raw.value, raw.id, raw.capability, raw.kind);
      }

      return "";
    })
    .filter(Boolean);
}

function normalizeWorkerStatus(value: unknown): WorkerStatus {
  const normalized = stringValue(value).toLowerCase();

  switch (normalized) {
    case "idle":
    case "available":
      return "idle";
    case "busy":
    case "working":
    case "active":
    case "leased":
    case "running":
      return "busy";
    case "offline":
    case "stopped":
    case "inactive":
      return "offline";
    case "error":
    case "failed":
      return "error";
    default:
      return "unknown";
  }
}

function normalizeLease(value: unknown): WorkerLeaseInfo | null {
  const raw = asRecord(value);
  const project = asRecord(raw.project ?? raw.currentProject ?? raw.current_project);
  const job = asRecord(raw.job ?? raw.currentJob ?? raw.current_job);
  const task = asRecord(raw.task ?? raw.currentTask ?? raw.current_task);
  const hasMeaningfulValue =
    stringValue(raw.projectId, raw.project_id, project.id) ||
    stringValue(raw.projectName, raw.project_name, project.name) ||
    stringValue(raw.jobId, raw.job_id, job.id) ||
    stringValue(raw.jobTitle, raw.job_title, job.title) ||
    stringValue(raw.taskId, raw.task_id, task.id) ||
    stringValue(raw.taskTitle, raw.task_title, task.title) ||
    stringValue(raw.acquiredAt, raw.acquired_at) ||
    stringValue(raw.expiresAt, raw.expires_at);

  if (!hasMeaningfulValue) {
    return null;
  }

  return {
    projectId: stringOrNull(raw.projectId, raw.project_id, project.id),
    projectName: stringOrNull(raw.projectName, raw.project_name, project.name),
    jobId: stringOrNull(raw.jobId, raw.job_id, job.id),
    jobTitle: stringOrNull(raw.jobTitle, raw.job_title, job.title),
    taskId: stringOrNull(raw.taskId, raw.task_id, task.id),
    taskTitle: stringOrNull(raw.taskTitle, raw.task_title, task.title),
    acquiredAt: stringOrNull(raw.acquiredAt, raw.acquired_at),
    expiresAt: stringOrNull(raw.expiresAt, raw.expires_at)
  };
}

export function normalizeWorkerRecord(value: unknown): WorkerRecord | null {
  const raw = asRecord(value);
  const id = stringValue(raw.id, raw.workerId, raw.worker_id, raw.name, raw.label);
  const name = stringValue(raw.name, raw.label, raw.workerName, raw.worker_name);
  const status = stringValue(raw.status, raw.state, raw.health);

  if (!id && !name && !status) {
    return null;
  }

  const currentJob = asRecord(raw.currentJob ?? raw.current_job ?? raw.job ?? raw.activeJob ?? raw.active_job);
  const lease = normalizeLease(raw.lease ?? raw.currentLease ?? raw.current_lease ?? raw.assignment ?? raw.currentAssignment ?? raw.current_assignment);

  return {
    id: id || name || `worker-${Math.random().toString(36).slice(2, 8)}`,
    name: name || id || "Worker",
    status: status || "unknown",
    kind: stringOrNull(raw.kind, raw.workerKind, raw.worker_kind, raw.type) || null,
    executorType: stringOrNull(raw.executorType, raw.executor_type, raw.executor, raw.executorName, raw.executor_name) || null,
    capabilities: [...new Set(stringArrayValue(raw.capabilities ?? raw.capability ?? raw.skills ?? raw.abilities))].sort((left, right) =>
      left.localeCompare(right)
    ),
    lastHeartbeatAt: stringOrNull(raw.lastHeartbeatAt, raw.last_heartbeat_at, raw.heartbeatAt, raw.heartbeat_at, raw.lastSeenAt, raw.last_seen_at) || null,
    lease,
    currentJobId: stringOrNull(raw.currentJobId, raw.current_job_id, currentJob.id, lease?.jobId) || null,
    currentJobTitle: stringOrNull(raw.currentJobTitle, raw.current_job_title, currentJob.title, lease?.jobTitle) || null,
    currentJobStatus: stringOrNull(raw.currentJobStatus, raw.current_job_status, currentJob.status) || null
  };
}

export function normalizeWorkerList(payload: unknown): WorkerRecord[] {
  const raw = asRecord(payload);
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.workers)
      ? raw.workers
      : Array.isArray(raw.items)
        ? raw.items
        : Array.isArray(raw.data)
          ? raw.data
          : [];

  return candidates.map(normalizeWorkerRecord).filter((entry): entry is WorkerRecord => entry !== null);
}

export function workerStatusLabel(value: string): string {
  switch (normalizeWorkerStatus(value)) {
    case "idle":
      return "Idle";
    case "busy":
      return "Busy";
    case "offline":
      return "Offline";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}

export function workerStatusTone(value: string): string {
  switch (normalizeWorkerStatus(value)) {
    case "idle":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "busy":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "offline":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export async function fetchWorkerRegistry(): Promise<WorkerRegistrySnapshot> {
  const baseUrl = await controlBaseUrl();
  const response = await fetch(`${baseUrl}/api/workers`, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });
  const payload = (await readJsonResponse(response)) as Record<string, unknown> | null;
  const workers = normalizeWorkerList(payload?.workers ?? payload);
  const registryAvailable = payload?.registryAvailable === false ? false : response.ok;

  return {
    workers,
    registryAvailable,
    status: response.status,
    error: typeof payload?.error === "string" ? payload.error : null,
    detail: payload?.detail ?? (registryAvailable ? null : payload)
  };
}
