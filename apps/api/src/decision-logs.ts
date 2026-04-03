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

export async function loadRecentDecisionLogs(projectId: string, take = 5): Promise<ProjectDecisionLogSummary[]> {
  const logs = await prisma.decisionLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take
  });

  return logs.map(toDecisionLogSummary);
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
    take
  });

  return logs.map(toOperatorGuidanceSummary).filter((entry): entry is OperatorGuidanceSummary => entry !== null);
}
