import type { ProjectDecisionLogSummary, DecisionLogKind, OperatorGuidanceSummary } from "@yeet2/domain";

import { prisma } from "./db";

type DbDecisionLog = Awaited<ReturnType<typeof prisma.decisionLog.findMany>>[number];

export interface DecisionLogInput {
  projectId: string;
  kind: DecisionLogKind | string;
  actor: string;
  summary: string;
  detail?: unknown;
  missionId?: string | null;
  taskId?: string | null;
  jobId?: string | null;
  blockerId?: string | null;
}

function toDecisionLogSummary(log: DbDecisionLog): ProjectDecisionLogSummary {
  return {
    id: log.id,
    projectId: log.projectId,
    missionId: log.missionId,
    taskId: log.taskId,
    jobId: log.jobId,
    blockerId: log.blockerId,
    kind: log.kind,
    actor: log.actor,
    summary: log.summary,
    detail: log.detail,
    createdAt: log.createdAt.toISOString()
  };
}

export async function recordDecisionLog(input: DecisionLogInput): Promise<ProjectDecisionLogSummary> {
  const log = await prisma.decisionLog.create({
    data: {
      projectId: input.projectId,
      ...(typeof input.missionId !== "undefined" ? { missionId: input.missionId } : {}),
      ...(typeof input.taskId !== "undefined" ? { taskId: input.taskId } : {}),
      ...(typeof input.jobId !== "undefined" ? { jobId: input.jobId } : {}),
      ...(typeof input.blockerId !== "undefined" ? { blockerId: input.blockerId } : {}),
      kind: input.kind,
      actor: input.actor,
      summary: input.summary,
      ...(typeof input.detail !== "undefined" ? { detail: input.detail as never } : {})
    }
  });

  return toDecisionLogSummary(log);
}

/** Hard ceiling for any decision log query to prevent runaway result sets. */
const MAX_DECISION_LOG_TAKE = 500;

function clampTake(value: number, defaultValue: number): number {
  if (!Number.isFinite(value)) return defaultValue;
  return Math.max(1, Math.min(MAX_DECISION_LOG_TAKE, Math.trunc(value)));
}

export async function loadRecentDecisionLogs(projectId: string, take = 5): Promise<ProjectDecisionLogSummary[]> {
  const logs = await prisma.decisionLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: clampTake(take, 5)
  });

  return logs.map(toDecisionLogSummary);
}

export interface DecisionLogQuery {
  take?: number;
  kind?: string | null;
  actor?: string | null;
  mention?: string | null;
  replyToId?: string | null;
}

function normalizeFilterText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function decisionLogMatchesQuery(log: ProjectDecisionLogSummary, query: DecisionLogQuery): boolean {
  const kind = normalizeFilterText(query.kind)?.toLowerCase();
  if (kind && log.kind.trim().toLowerCase() !== kind) {
    return false;
  }

  const actor = normalizeFilterText(query.actor)?.toLowerCase();
  if (actor && log.actor.trim().toLowerCase() !== actor) {
    return false;
  }

  const detail = typeof log.detail === "object" && log.detail !== null ? (log.detail as Record<string, unknown>) : {};
  const mention = normalizeFilterText(query.mention)?.toLowerCase();
  if (mention) {
    const mentions = Array.isArray(detail.mentions)
      ? detail.mentions.filter((value): value is string => typeof value === "string").map((value) => value.trim().toLowerCase()).filter(Boolean)
      : [];

    if (!mentions.includes(mention)) {
      return false;
    }
  }

  const replyToId = normalizeFilterText(query.replyToId);
  if (replyToId) {
    const logReplyToId = typeof detail.replyToId === "string" ? detail.replyToId.trim() : "";
    if (logReplyToId !== replyToId) {
      return false;
    }
  }

  return true;
}

export interface GlobalDecisionLogQuery {
  take?: number;
  projectId?: string | null;
  kind?: string | null;
  actor?: string | null;
  search?: string | null;
}

export async function listGlobalDecisionLogs(query: GlobalDecisionLogQuery = {}): Promise<ProjectDecisionLogSummary[]> {
  const take = Math.max(1, Math.min(200, Math.trunc(query.take ?? 100)));
  const where: Record<string, unknown> = {};
  if (normalizeFilterText(query.projectId)) {
    where.projectId = normalizeFilterText(query.projectId);
  }
  if (normalizeFilterText(query.kind)) {
    where.kind = normalizeFilterText(query.kind);
  }
  if (normalizeFilterText(query.actor)) {
    where.actor = normalizeFilterText(query.actor);
  }

  const logs = await prisma.decisionLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take * 4
  });

  const search = normalizeFilterText(query.search)?.toLowerCase();
  const results = logs.map(toDecisionLogSummary).filter((log) => {
    if (!search) return true;
    return (
      log.summary?.toLowerCase().includes(search) ||
      log.actor?.toLowerCase().includes(search) ||
      log.kind?.toLowerCase().includes(search)
    );
  });

  return results.slice(0, take);
}

export async function listProjectDecisionLogs(projectId: string, query: DecisionLogQuery = {}): Promise<ProjectDecisionLogSummary[]> {
  const take = Math.max(1, Math.min(200, Math.trunc(query.take ?? 50)));
  const logs = await prisma.decisionLog.findMany({
    where: {
      projectId,
      ...(normalizeFilterText(query.kind) ? { kind: normalizeFilterText(query.kind) ?? undefined } : {}),
      ...(normalizeFilterText(query.actor) ? { actor: normalizeFilterText(query.actor) ?? undefined } : {})
    },
    orderBy: { createdAt: "desc" },
    take: take * 4
  });

  return logs.map(toDecisionLogSummary).filter((log) => decisionLogMatchesQuery(log, query)).slice(0, take);
}

function toOperatorGuidanceSummary(log: DbDecisionLog): OperatorGuidanceSummary | null {
  if (log.kind !== "message" || log.actor.trim().toLowerCase() !== "operator") {
    return null;
  }

  const detail = typeof log.detail === "object" && log.detail !== null ? (log.detail as Record<string, unknown>) : {};
  const source = typeof detail.source === "string" ? detail.source.trim().toLowerCase() : "";
  if (source && source !== "operator") {
    return null;
  }

  const content = log.summary.trim();
  if (!content) {
    return null;
  }

  return {
    id: log.id,
    actor: log.actor,
    content,
    mentions: Array.isArray(detail.mentions)
      ? detail.mentions.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean)
      : [],
    replyToId: typeof detail.replyToId === "string" ? detail.replyToId.trim() || null : null,
    createdAt: log.createdAt.toISOString()
  };
}

export async function loadRecentOperatorGuidance(projectId: string, take = 6): Promise<OperatorGuidanceSummary[]> {
  const logs = await prisma.decisionLog.findMany({
    where: {
      projectId,
      kind: "message",
      actor: "operator"
    },
    orderBy: { createdAt: "desc" },
    take: clampTake(take, 6)
  });

  return logs.map(toOperatorGuidanceSummary).filter((entry): entry is OperatorGuidanceSummary => entry !== null);
}

function toActionableGuidanceSummary(log: DbDecisionLog): OperatorGuidanceSummary | null {
  if (log.kind !== "message") {
    return null;
  }

  const detail = typeof log.detail === "object" && log.detail !== null ? (log.detail as Record<string, unknown>) : {};
  const source = typeof detail.source === "string" ? detail.source.trim().toLowerCase() : "";
  if (source !== "operator" && source !== "agent") {
    return null;
  }

  const mentions = Array.isArray(detail.mentions)
    ? detail.mentions.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean)
    : [];

  // Broadcast chat is visible in the project thread, but only targeted messages
  // should steer another role by default.
  if (mentions.length === 0) {
    return null;
  }

  const content = log.summary.trim();
  if (!content) {
    return null;
  }

  return {
    id: log.id,
    actor: log.actor,
    content,
    mentions,
    replyToId: typeof detail.replyToId === "string" ? detail.replyToId.trim() || null : null,
    createdAt: log.createdAt.toISOString()
  };
}

export async function loadRecentActionableGuidance(projectId: string, take = 8): Promise<OperatorGuidanceSummary[]> {
  const clampedTake = clampTake(take, 8);
  const logs = await prisma.decisionLog.findMany({
    where: {
      projectId,
      kind: "message"
    },
    orderBy: { createdAt: "desc" },
    take: clampTake(clampedTake * 3, clampedTake * 3)
  });

  return logs.map(toActionableGuidanceSummary).filter((entry): entry is OperatorGuidanceSummary => entry !== null).slice(0, clampedTake);
}
