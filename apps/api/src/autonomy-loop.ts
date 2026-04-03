import type { FastifyBaseLogger } from "fastify";

import {
  advanceProject,
  createProjectPullRequest,
  listRegisteredProjects,
  mergeProjectPullRequest,
  planProject,
  recordProjectAutonomyRun,
  type ProjectSummary
} from "./projects";
import { recordDecisionLog } from "./decision-logs";

export type AutonomyLoopMode = "manual" | "supervised" | "autonomous";

export interface AutonomyLoopTelemetry {
  projectId: string;
  mode: AutonomyLoopMode;
  lastRunAt: string;
  lastAction: "plan" | "advance" | "pull_request" | "merge" | "skip" | "error";
  lastOutcome: "planned" | "advanced" | "created_pr" | "merged" | "merge_skipped" | "pr_skipped" | "skipped" | "idle" | "error";
  lastMissionId: string | null;
  lastTaskId: string | null;
  nextDispatchableTaskId: string | null;
  nextDispatchableTaskRole: string | null;
  activeMissionCount: number;
  activeTaskCount: number;
  message: string | null;
}

const telemetryByProjectId = new Map<string, AutonomyLoopTelemetry>();

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

export function resolveAutonomyLoopEnabled(): boolean {
  return envFlag("YEET2_AUTONOMY_LOOP_ENABLED", true);
}

export function resolveAutonomyLoopIntervalMs(): number {
  const raw = envText("YEET2_AUTONOMY_LOOP_INTERVAL_MS");
  if (!raw) {
    return 60_000;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 60_000;
  }

  return Math.max(5_000, Math.floor(parsed));
}

function resolveAutonomyLoopActor(): string {
  return envText("YEET2_AUTONOMY_LOOP_ACTOR") || "autonomy-loop";
}

export function getAutonomyLoopTelemetry(projectId: string): AutonomyLoopTelemetry | null {
  return telemetryByProjectId.get(projectId) ?? null;
}

export function listAutonomyLoopTelemetry(): AutonomyLoopTelemetry[] {
  return [...telemetryByProjectId.values()];
}

export function recordAutonomyLoopTelemetry(telemetry: AutonomyLoopTelemetry): AutonomyLoopTelemetry {
  telemetryByProjectId.set(telemetry.projectId, telemetry);
  return telemetry;
}

function hasEnabledRoleDefinitions(project: ProjectSummary): boolean {
  return project.roleDefinitions.some((definition) => definition.enabled);
}

function needsInitialPlanning(project: ProjectSummary): boolean {
  const firstMission = project.missions[0] ?? null;
  return project.missions.length === 0 || firstMission?.tasks.length === 0;
}

function latestMissionId(project: ProjectSummary): string | null {
  return project.missions[0]?.id ?? null;
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findLatestCompletedImplementerJob(project: ProjectSummary): {
  missionId: string;
  missionTitle: string;
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  jobId: string;
  jobBranchName: string;
  jobHasPullRequest: boolean;
  reviewerComplete: boolean;
  completedAt: string | null;
} | null {
  const candidates = project.missions.flatMap((mission) => {
    const reviewerComplete = mission.tasks.some((task) => task.agentRole === "reviewer" && task.status === "complete");
    return mission.tasks.flatMap((task) => {
      if (task.agentRole !== "implementer") {
        return [];
      }

      return task.jobs
        .filter((job) => job.status === "complete")
        .map((job) => ({
          missionId: mission.id,
          missionTitle: mission.title,
          taskId: task.id,
          taskTitle: task.title,
          taskStatus: task.status,
          jobId: job.id,
          jobBranchName: job.branchName,
          jobHasPullRequest: job.githubPrNumber !== null || job.githubPrUrl !== null || job.githubPrTitle !== null,
          reviewerComplete,
          completedAt: job.completedAt
        }));
    });
  });

  candidates.sort((left, right) => parseTimestamp(right.completedAt) - parseTimestamp(left.completedAt));
  return candidates[0] ?? null;
}

function isPullRequestPolicySatisfied(project: ProjectSummary, candidate: ReturnType<typeof findLatestCompletedImplementerJob>): string | null {
  if (!candidate) {
    return "No completed implementer job is available for pull request automation.";
  }

  if (project.pullRequestMode === "manual") {
    return "Pull request automation is disabled by policy.";
  }

  if (project.pullRequestMode === "after_reviewer" && !candidate.reviewerComplete) {
    return `Reviewer work for mission ${candidate.missionTitle} is not complete yet.`;
  }

  return null;
}

function missionHasAllDispatchableTasksComplete(project: ProjectSummary, missionId: string): boolean {
  const mission = project.missions.find((candidate) => candidate.id === missionId) ?? null;
  if (!mission) {
    return false;
  }

  return mission.tasks
    .filter((task) => task.agentRole === "implementer" || task.agentRole === "qa" || task.agentRole === "reviewer")
    .every((task) => task.status === "complete");
}

function isProjectPullRequestMergeAllowed(
  project: ProjectSummary,
  candidate: ReturnType<typeof findLatestCompletedImplementerJob>
): string | null {
  if (!candidate) {
    return "No completed implementer job is available for pull request merging.";
  }

  if (project.pullRequestDraftMode !== "ready") {
    return "Draft pull requests are never auto-merged.";
  }

  if (project.mergeApprovalMode === "human_approval") {
    return "Human approval is required before merging this pull request.";
  }

  if (project.mergeApprovalMode === "agent_signoff" && !candidate.reviewerComplete) {
    return `Reviewer work for mission ${candidate.missionTitle} is not complete yet.`;
  }

  if (project.mergeApprovalMode === "no_approval" && !missionHasAllDispatchableTasksComplete(project, candidate.missionId)) {
    return `Dispatchable tasks for mission ${candidate.missionTitle} are not complete yet.`;
  }

  return null;
}

interface PullRequestAutomationResult {
  project: ProjectSummary;
  lastAction: AutonomyLoopTelemetry["lastAction"];
  lastOutcome: AutonomyLoopTelemetry["lastOutcome"];
  message: string;
}

async function processProjectPullRequestAutomation(
  project: ProjectSummary
): Promise<PullRequestAutomationResult | null> {
  const candidate = findLatestCompletedImplementerJob(project);
  if (!candidate) {
    return null;
  }

  const creationPolicyMessage = isPullRequestPolicySatisfied(project, candidate);
  if (creationPolicyMessage && !candidate.jobHasPullRequest) {
    return {
      project,
      lastAction: "pull_request",
      lastOutcome: "pr_skipped",
      message: creationPolicyMessage
    };
  }

  let currentProject = project;

  if (!candidate.jobHasPullRequest) {
    const created = await createProjectPullRequest(project.id, candidate.jobId);
    currentProject = created.project;
  } else if (project.mergeApprovalMode === "human_approval" && project.pullRequestDraftMode === "ready") {
    try {
      await createProjectPullRequest(project.id, candidate.jobId);
    } catch {
      // Best-effort blocker refresh only.
    }
  }

  const mergePolicyMessage = isProjectPullRequestMergeAllowed(currentProject, candidate);
  if (mergePolicyMessage) {
    return {
      project: currentProject,
      lastAction: "merge",
      lastOutcome: "merge_skipped",
      message: mergePolicyMessage
    };
  }

  const merged = await mergeProjectPullRequest(currentProject.id, candidate.jobId);
  return {
    project: merged.project,
    lastAction: "merge",
    lastOutcome: "merged",
    message: `Merged pull request for implementer job ${candidate.jobId} on branch ${candidate.jobBranchName}`
  };
}

function buildTelemetry(
  project: ProjectSummary,
  runAt: Date,
  lastAction: AutonomyLoopTelemetry["lastAction"],
  lastOutcome: AutonomyLoopTelemetry["lastOutcome"],
  message: string | null
): AutonomyLoopTelemetry {
  return {
    projectId: project.id,
    mode: project.autonomyMode,
    lastRunAt: runAt.toISOString(),
    lastAction,
    lastOutcome,
    lastMissionId: latestMissionId(project),
    lastTaskId: project.nextDispatchableTaskId ?? project.missions[0]?.tasks[0]?.id ?? null,
    nextDispatchableTaskId: project.nextDispatchableTaskId,
    nextDispatchableTaskRole: project.nextDispatchableTaskRole,
    activeMissionCount: project.activeMissionCount,
    activeTaskCount: project.activeTaskCount,
    message
  };
}

function shouldRecordAutonomyDecisionLog(
  lastAction: AutonomyLoopTelemetry["lastAction"],
  lastOutcome: AutonomyLoopTelemetry["lastOutcome"]
): boolean {
  return (
    lastOutcome === "planned" ||
    lastOutcome === "advanced" ||
    lastOutcome === "created_pr" ||
    lastOutcome === "merged" ||
    lastOutcome === "pr_skipped" ||
    lastOutcome === "merge_skipped" ||
    lastOutcome === "error"
  );
}

class AutonomyLoopManager {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopping = false;
  private currentSweep: Promise<void> | null = null;

  constructor(
    private readonly logger: Pick<FastifyBaseLogger, "info" | "warn" | "error" | "debug">,
    private readonly enabled: boolean,
    private readonly intervalMs: number
  ) {}

  start(): void {
    if (this.running) {
      return;
    }

    if (!this.enabled) {
      this.logger.info("Autonomy loop is disabled");
      return;
    }

    this.running = true;
    this.stopping = false;
    this.logger.info({ intervalMs: this.intervalMs }, "Starting autonomy loop");
    void this.runSweep();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const sweep = this.currentSweep;
    if (sweep) {
      await sweep.catch(() => undefined);
    }
  }

  private scheduleNextSweep(): void {
    if (this.stopping || !this.running) {
      return;
    }

    this.timer = setTimeout(() => {
      void this.runSweep();
    }, this.intervalMs);
  }

  private async runSweep(): Promise<void> {
    if (this.stopping || !this.running || this.currentSweep) {
      return;
    }

    const sweep = (async () => {
      try {
        const projects = await listRegisteredProjects();
        for (const project of projects.projects) {
          if (this.stopping || !this.running) {
            break;
          }

          await this.processProject(project);
        }
      } catch (error) {
        this.logger.error({ error }, "Autonomy loop sweep failed");
      }
    })();

    this.currentSweep = sweep;
    try {
      await sweep;
    } finally {
      this.currentSweep = null;
      if (!this.stopping && this.running) {
        this.scheduleNextSweep();
      }
    }
  }

  private async processProject(project: ProjectSummary): Promise<void> {
    if (project.autonomyMode === "manual") {
      await this.persistTelemetry(project, "skip", "skipped", "Autonomy mode is manual");
      return;
    }

    if (!hasEnabledRoleDefinitions(project)) {
      await this.persistTelemetry(project, "skip", "skipped", "No enabled role definitions are available for the project");
      return;
    }

    const shouldPlan = needsInitialPlanning(project);
    let currentProject = project;

    if (shouldPlan) {
      try {
        const plannedProject = await planProject(project.id);
        if (!plannedProject) {
          await this.persistTelemetry(project, "plan", "error", "Project disappeared while planning");
          return;
        }

        currentProject = plannedProject;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Planning failed";
        this.logger.error({ error, projectId: project.id }, "Autonomy loop planning failed");
        await this.persistTelemetry(project, "plan", "error", message);
        return;
      }
    }

    if (project.autonomyMode === "supervised") {
      if (shouldPlan) {
        await this.persistTelemetry(currentProject, "plan", "planned", "Initial planning completed");
      } else {
        await this.persistTelemetry(currentProject, "skip", "idle", "Supervised mode skipped dispatch");
      }
      return;
    }

    if (!currentProject.nextDispatchableTaskId) {
      try {
        const automation = await processProjectPullRequestAutomation(currentProject);
        if (!automation) {
          return;
        }

        await this.persistTelemetry(automation.project, automation.lastAction, automation.lastOutcome, automation.message);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pull request automation failed";
        this.logger.error({ error, projectId: project.id }, "Autonomy loop pull request automation failed");
        await this.persistTelemetry(currentProject, "merge", "error", message);
      }
      return;
    }

    try {
      const dispatched = await advanceProject(project.id);
      await this.persistTelemetry(dispatched.project, "advance", "advanced", `Dispatched task ${dispatched.job.taskId}`);

      const candidate = findLatestCompletedImplementerJob(dispatched.project);
      if (candidate) {
        try {
          const automation = await processProjectPullRequestAutomation(dispatched.project);
          if (automation) {
            await this.persistTelemetry(automation.project, automation.lastAction, automation.lastOutcome, automation.message);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Pull request automation failed";
          this.logger.error({ error, projectId: project.id }, "Autonomy loop pull request automation failed");
          await this.persistTelemetry(dispatched.project, "merge", "error", message);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dispatch failed";
      this.logger.error({ error, projectId: project.id }, "Autonomy loop dispatch failed");
      await this.persistTelemetry(currentProject, "advance", "error", message);
    }
  }

  private async persistTelemetry(
    project: ProjectSummary,
    lastAction: AutonomyLoopTelemetry["lastAction"],
    lastOutcome: AutonomyLoopTelemetry["lastOutcome"],
    message: string | null
  ): Promise<void> {
    const runAt = new Date();
    const nextRunAt = new Date(runAt.getTime() + this.intervalMs);

    try {
      await recordProjectAutonomyRun(project.id, {
        lastAutonomyRunAt: runAt,
        lastAutonomyStatus: lastOutcome,
        lastAutonomyMessage: message,
        lastAutonomyActor: resolveAutonomyLoopActor(),
        nextAutonomyRunAt: nextRunAt
      });

      if (shouldRecordAutonomyDecisionLog(lastAction, lastOutcome)) {
        try {
          await recordDecisionLog({
            projectId: project.id,
            missionId: project.nextDispatchableTaskId ? null : project.missions[0]?.id ?? null,
            taskId: project.nextDispatchableTaskId ?? project.missions[0]?.tasks[0]?.id ?? null,
            kind: "autonomy",
            actor: resolveAutonomyLoopActor(),
            summary: `Autonomy ${lastAction} ${lastOutcome}`,
            detail: {
              action: lastAction,
              outcome: lastOutcome,
              mode: project.autonomyMode,
              message,
              nextDispatchableTaskId: project.nextDispatchableTaskId,
              nextDispatchableTaskRole: project.nextDispatchableTaskRole
            }
          });
        } catch (error) {
          this.logger.error({ error, projectId: project.id }, "Decision log write failed");
        }
      }

      recordAutonomyLoopTelemetry(buildTelemetry(project, runAt, lastAction, lastOutcome, message));
    } catch (error) {
      this.logger.error({ error, projectId: project.id }, "Autonomy telemetry write failed");
    }
  }
}

export function createAutonomyLoopManager(
  logger: Pick<FastifyBaseLogger, "info" | "warn" | "error" | "debug">
): AutonomyLoopManager {
  return new AutonomyLoopManager(logger, resolveAutonomyLoopEnabled(), resolveAutonomyLoopIntervalMs());
}
