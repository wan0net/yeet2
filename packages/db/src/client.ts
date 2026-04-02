import {
  PrismaClient,
  type Constitution,
  type Mission,
  type Project,
  type Task
} from "@prisma/client";
import type {
  ConstitutionSummary,
  MissionSummary,
  ProjectDetailSummary,
  ProjectMissionTaskSummary,
  ProjectSummary,
  TaskSummary
} from "@yeet2/domain";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function createDbClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }

  return globalForPrisma.prisma;
}

export function toConstitutionSummary(
  constitution: Constitution | null,
  files: ConstitutionSummary["files"],
  status: ConstitutionSummary["status"],
  inspectedAt: string
): ConstitutionSummary {
  return {
    status,
    files,
    inspectedAt,
    lastIndexedAt: constitution?.lastIndexedAt?.toISOString() ?? null
  };
}

export function toProjectSummary(
  project: Project,
  constitution: ConstitutionSummary,
  counts: Pick<ProjectSummary, "activeMissionCount" | "activeTaskCount" | "blockerCount">
): ProjectSummary {
  return {
    project: {
      id: project.id,
      name: project.name,
      repoUrl: project.repoUrl,
      defaultBranch: project.defaultBranch,
      localPath: project.localPath,
      constitutionStatus: project.constitutionStatus,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    },
    constitution,
    ...counts
  };
}

export function toTaskSummary(task: Task): TaskSummary {
  return {
    id: task.id,
    missionId: task.missionId,
    title: task.title,
    description: task.description,
    agentRole: task.agentRole as TaskSummary["agentRole"],
    status: task.status as TaskSummary["status"],
    priority: task.priority,
    acceptanceCriteria: Array.isArray(task.acceptanceCriteria) ? (task.acceptanceCriteria as string[]) : [],
    attempts: task.attempts,
    blockerReason: task.blockerReason
  };
}

export function toMissionSummary(mission: Mission, taskCount: number): MissionSummary {
  return {
    id: mission.id,
    projectId: mission.projectId,
    title: mission.title,
    objective: mission.objective,
    status: mission.status,
    createdBy: mission.createdBy,
    startedAt: mission.startedAt?.toISOString() ?? null,
    completedAt: mission.completedAt?.toISOString() ?? null,
    taskCount
  };
}

export function toProjectDetailSummary(
  project: Project,
  constitution: ConstitutionSummary,
  missions: MissionSummary[],
  tasks: TaskSummary[],
  counts: Pick<ProjectDetailSummary, "activeMissionCount" | "activeTaskCount" | "blockerCount">
): ProjectDetailSummary {
  return {
    project: {
      id: project.id,
      name: project.name,
      repoUrl: project.repoUrl,
      defaultBranch: project.defaultBranch,
      localPath: project.localPath,
      constitutionStatus: project.constitutionStatus,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    },
    constitution,
    missions,
    tasks,
    ...counts
  };
}

export function toProjectMissionTaskSummary(
  project: Project,
  constitution: ConstitutionSummary,
  mission: MissionSummary | null,
  tasks: TaskSummary[]
): ProjectMissionTaskSummary {
  return {
    project: {
      id: project.id,
      name: project.name,
      repoUrl: project.repoUrl,
      defaultBranch: project.defaultBranch,
      localPath: project.localPath,
      constitutionStatus: project.constitutionStatus,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    },
    constitution,
    mission,
    tasks
  };
}
