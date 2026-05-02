import type { FastifyBaseLogger } from "fastify";

import { logger } from "./logger";
import {
  advanceProject,
  createProjectPullRequest,
  dispatchTask,
  forceFailStuckJob,
  getRegisteredProject,
  listRegisteredProjects,
  mergeProjectPullRequest,
  planProject,
  recordProjectAutonomyRun,
  refreshProjectActiveJobs,
  refreshProjectPullRequestState,
  syncProjectGitHubIssues,
  type ProjectSummary
} from "./projects";
import { decideWorkflowAction } from "./planning";
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

export function resolveStuckJobTimeoutMs(): number {
  const raw = envText("YEET2_STUCK_JOB_TIMEOUT_MS");
  if (!raw) return 3_600_000; // default 1 hour
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(60_000, Math.floor(parsed)) : 3_600_000;
}

async function recoverStuckJobs(project: ProjectSummary, timeoutMs: number): Promise<void> {
  const now = Date.now();
  for (const mission of project.missions) {
    for (const task of mission.tasks) {
      for (const job of task.jobs) {
        if (job.status !== "running" && job.status !== "queued") continue;
        const startedAt = job.startedAt ? Date.parse(job.startedAt) : 0;
        if (!startedAt || now - startedAt < timeoutMs) continue;

        // Job is stuck — mark as failed
        try {
          await forceFailStuckJob(project.id, job.id, task.id, task.attempts);
        } catch (error) {
          logger.bestEffortFailure("force_fail_stuck_job", error, {
            projectId: project.id,
            taskId: task.id,
            jobId: job.id
          });
        }
      }
    }
  }
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
  if (project.githubProjectSync) {
    return false;
  }
  const firstMission = project.missions[0] ?? null;
  return project.missions.length === 0 || firstMission?.tasks.length === 0;
}

function hasInFlightJobs(project: ProjectSummary): boolean {
  return project.missions.some((mission) =>
    mission.tasks.some((task) => task.jobs.some((job) => job.status === "queued" || job.status === "running"))
  );
}

function missionHasActionableWork(project: ProjectSummary, missionId: string): boolean {
  const mission = project.missions.find((candidate) => candidate.id === missionId) ?? null;
  if (!mission) {
    return false;
  }

  return mission.tasks.some((task) => ["queued", "pending", "ready", "running", "in_progress", "blocked", "failed"].includes(task.status));
}

function hasQueuedBacklogMission(project: ProjectSummary): boolean {
  return project.missions.some((mission) => mission.status === "planned" && mission.startedAt === null && missionHasActionableWork(project, mission.id));
}

function needsBacklogPlanning(project: ProjectSummary): boolean {
  if (project.githubProjectSync) {
    return false;
  }

  if (hasQueuedBacklogMission(project)) {
    return false;
  }

  const liveMissionCount = project.missions.filter((mission) => {
    if (mission.status !== "active" && mission.status !== "planned") {
      return false;
    }

    return missionHasActionableWork(project, mission.id);
  }).length;

  return liveMissionCount === 1;
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
      if (task.agentRole !== "implementer" && task.agentRole !== "coder") {
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

function findCompletedImplementerJobById(
  project: ProjectSummary,
  jobId: string
): ReturnType<typeof findLatestCompletedImplementerJob> {
  const normalizedJobId = jobId.trim();
  if (!normalizedJobId) {
    return null;
  }

  for (const mission of project.missions) {
    const reviewerComplete = mission.tasks.some((task) => task.agentRole === "reviewer" && task.status === "complete");
    for (const task of mission.tasks) {
      if (task.agentRole !== "implementer" && task.agentRole !== "coder") {
        continue;
      }

      const job = task.jobs.find((candidate) => candidate.id === normalizedJobId && candidate.status === "complete");
      if (!job) {
        continue;
      }

      return {
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
      };
    }
  }

  return null;
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
    .filter((task) => task.agentRole === "implementer" || task.agentRole === "tester" || task.agentRole === "coder" || task.agentRole === "qa" || task.agentRole === "reviewer")
    .every((task) => task.status === "complete");
}

export function hasRemainingDispatchableTasks(project: ProjectSummary): boolean {
  return project.missions.some((mission) =>
    mission.tasks.some(
      (task) =>
        (task.agentRole === "architect" || task.agentRole === "implementer" || task.agentRole === "tester" || task.agentRole === "coder" || task.agentRole === "qa" || task.agentRole === "reviewer") &&
        (task.status === "ready" || task.status === "pending")
    )
  );
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

interface WorkflowDecisionCandidate {
  dispatchableTasks: Array<{
    id: string;
    title: string;
    agentRole: string;
    priority: number;
    attempts: number;
    missionId: string;
    missionTitle: string;
  }>;
  latestCompletedJobId: string | null;
  latestCompletedTaskId: string | null;
  latestCompletedTaskTitle: string | null;
  latestCompletedJobHasPullRequest: boolean;
  latestCompletedReviewerComplete: boolean;
  latestCompletedDispatchableTasksComplete: boolean;
}

async function processProjectPullRequestAutomation(
  project: ProjectSummary,
  targetJobId: string | null = null,
  requestedAction: "pull_request" | "merge" | null = null
): Promise<PullRequestAutomationResult | null> {
  const candidate = targetJobId ? findCompletedImplementerJobById(project, targetJobId) : findLatestCompletedImplementerJob(project);
  if (!candidate) {
    return null;
  }

  let currentProject = project;
  if (candidate.jobHasPullRequest) {
    const refreshed = await refreshProjectPullRequestState(project.id, candidate.jobId);
    currentProject = refreshed.project;
    if (refreshed.merged) {
      return {
        project: refreshed.project,
        lastAction: "merge",
        lastOutcome: "merged",
        message: `Detected externally merged pull request for implementer job ${candidate.jobId} on branch ${candidate.jobBranchName}`
      };
    }
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

  if (!candidate.jobHasPullRequest) {
    const created = await createProjectPullRequest(project.id, candidate.jobId);
    currentProject = created.project;
    if (requestedAction === "pull_request") {
      return {
        project: created.project,
        lastAction: "pull_request",
        lastOutcome: "created_pr",
        message: `Created pull request for implementer job ${candidate.jobId} on branch ${candidate.jobBranchName}`
      };
    }
  } else if (project.mergeApprovalMode === "human_approval" && project.pullRequestDraftMode === "ready") {
    try {
      await createProjectPullRequest(project.id, candidate.jobId);
    } catch (error) {
      // Best-effort blocker refresh only.
      logger.bestEffortFailure("create_pull_request_blocker_refresh", error, {
        projectId: project.id,
        jobId: candidate.jobId
      });
    }
  }

  if (requestedAction === "pull_request") {
    return {
      project: currentProject,
      lastAction: "pull_request",
      lastOutcome: "created_pr",
      message: `Pull request is ready for implementer job ${candidate.jobId} on branch ${candidate.jobBranchName}`
    };
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

function buildWorkflowDecisionCandidate(project: ProjectSummary): WorkflowDecisionCandidate {
  const candidate = findLatestCompletedImplementerJob(project);
  const dispatchableTasks = project.missions.flatMap((mission) =>
    mission.tasks
      .filter((task) => task.dispatchable)
      .map((task) => ({
        id: task.id,
        title: task.title,
        agentRole: task.agentRole,
        priority: task.priority,
        attempts: task.attempts,
        missionId: mission.id,
        missionTitle: mission.title
      }))
  );
  return {
    dispatchableTasks,
    latestCompletedJobId: candidate?.jobId ?? null,
    latestCompletedTaskId: candidate?.taskId ?? null,
    latestCompletedTaskTitle: candidate?.taskTitle ?? null,
    latestCompletedJobHasPullRequest: candidate?.jobHasPullRequest ?? false,
    latestCompletedReviewerComplete: candidate?.reviewerComplete ?? false,
    latestCompletedDispatchableTasksComplete: candidate ? missionHasAllDispatchableTasksComplete(project, candidate.missionId) : false
  };
}

async function requestWorkflowDecision(project: ProjectSummary) {
  const candidate = buildWorkflowDecisionCandidate(project);
  return decideWorkflowAction({
    projectId: project.id,
    projectName: project.name,
    autonomyMode: project.autonomyMode,
    hasInFlightJobs: hasInFlightJobs(project),
    needsInitialPlanning: needsInitialPlanning(project),
    needsBacklogPlanning: needsBacklogPlanning(project),
    dispatchableTasks: candidate.dispatchableTasks,
    nextDispatchableTaskId: project.nextDispatchableTaskId ?? null,
    nextDispatchableTaskRole: project.nextDispatchableTaskRole ?? null,
    pullRequestMode: project.pullRequestMode,
    pullRequestDraftMode: project.pullRequestDraftMode,
    mergeApprovalMode: project.mergeApprovalMode,
    latestCompletedJobId: candidate.latestCompletedJobId,
    latestCompletedTaskId: candidate.latestCompletedTaskId,
    latestCompletedTaskTitle: candidate.latestCompletedTaskTitle,
    latestCompletedJobHasPullRequest: candidate.latestCompletedJobHasPullRequest,
    latestCompletedReviewerComplete: candidate.latestCompletedReviewerComplete,
    latestCompletedDispatchableTasksComplete: candidate.latestCompletedDispatchableTasksComplete
  });
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

export class AutonomyLoopManager {
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

  async triggerProject(projectId: string): Promise<AutonomyLoopTelemetry> {
    if (this.currentSweep) {
      await this.currentSweep.catch(() => undefined);
    }

    const loaded = await getRegisteredProject(projectId);
    if (!loaded.project) {
      throw new Error("Project not found");
    }

    await this.processProject(loaded.project);
    return getAutonomyLoopTelemetry(projectId) ?? buildTelemetry(loaded.project, new Date(), "skip", "idle", "Project run completed");
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
      let projects: Awaited<ReturnType<typeof listRegisteredProjects>>;
      try {
        projects = await listRegisteredProjects();
      } catch (error) {
        this.logger.error({ error }, "Autonomy loop failed to list projects");
        return;
      }

      for (const project of projects.projects) {
        if (this.stopping || !this.running) {
          break;
        }

        // Each project is processed in its own try/catch so a single failure
        // never aborts the sweep — otherwise one broken project would
        // silently halt autonomy across the whole fleet.
        try {
          await this.processProject(project);
        } catch (error) {
          this.logger.error(
            { error, projectId: project.id, projectName: project.name },
            "Autonomy loop project iteration threw"
          );
          // Best-effort: record telemetry so the operator can see what broke.
          try {
            const message = error instanceof Error ? error.message : "Unknown autonomy loop error";
            await this.persistTelemetry(project, "skip", "error", message);
          } catch (telemetryError) {
            this.logger.error(
              { error: telemetryError, projectId: project.id },
              "Failed to persist autonomy error telemetry"
            );
          }
        }
      }
    })();

    this.currentSweep = sweep;
    try {
      await sweep;
    } catch (error) {
      // sweep() never rejects internally, but defence in depth.
      this.logger.error({ error }, "Autonomy loop sweep rejected unexpectedly");
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

    let currentProject = project;
    if (currentProject.githubProjectSync) {
      try {
        const synced = await syncProjectGitHubIssues(currentProject.id);
        if (synced.project) {
          currentProject = synced.project;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "GitHub issue sync failed";
        this.logger.error({ error, projectId: currentProject.id }, "Autonomy loop GitHub issue sync failed");
        await this.persistTelemetry(currentProject, "skip", "error", message);
        return;
      }
    }

    if (hasInFlightJobs(currentProject)) {
      try {
        const refreshed = await refreshProjectActiveJobs(currentProject.id);
        currentProject = refreshed.project;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Active job refresh failed";
        this.logger.error({ error, projectId: project.id }, "Autonomy loop active job refresh failed");
        await this.persistTelemetry(currentProject, "advance", "error", message);
        return;
      }
    }

    // After refreshing active jobs, check for stuck ones
    const stuckTimeoutMs = resolveStuckJobTimeoutMs();
    if (stuckTimeoutMs > 0) {
      await recoverStuckJobs(currentProject, stuckTimeoutMs);
    }

    let decision;
    try {
      decision = await requestWorkflowDecision(currentProject);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Brain workflow decision failed";
      this.logger.error({ error, projectId: currentProject.id }, "Autonomy loop brain decision failed");
      await this.persistTelemetry(currentProject, "skip", "error", message);
      return;
    }

    if (decision.action === "plan") {
      try {
        const plannedProject = await planProject(currentProject.id);
        if (!plannedProject) {
          await this.persistTelemetry(currentProject, "plan", "error", "Project disappeared while planning");
          return;
        }

        currentProject = plannedProject;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Planning failed";
        this.logger.error({ error, projectId: currentProject.id }, "Autonomy loop planning failed");
        await this.persistTelemetry(currentProject, "plan", "error", message);
        return;
      }

      if (currentProject.autonomyMode === "supervised") {
        await this.persistTelemetry(
          currentProject,
          "plan",
          "planned",
          decision.reason
        );
        return;
      }

      try {
        decision = await requestWorkflowDecision(currentProject);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Brain workflow decision failed";
        this.logger.error({ error, projectId: currentProject.id }, "Autonomy loop brain decision failed");
        await this.persistTelemetry(currentProject, "skip", "error", message);
        return;
      }
    }

    if (currentProject.autonomyMode === "supervised") {
      await this.persistTelemetry(currentProject, "skip", "idle", decision.reason);
      return;
    }

    if (decision.action === "idle") {
      await this.persistTelemetry(currentProject, "skip", "idle", decision.reason);
      return;
    }

    if (decision.action === "pull_request" || decision.action === "merge") {
      try {
        const automation = await processProjectPullRequestAutomation(currentProject, decision.targetJobId ?? null, decision.action);
        if (!automation) {
          await this.persistTelemetry(currentProject, "skip", "idle", decision.reason);
          return;
        }

        await this.persistTelemetry(automation.project, automation.lastAction, automation.lastOutcome, automation.message);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pull request automation failed";
        this.logger.error({ error, projectId: currentProject.id }, "Autonomy loop pull request automation failed");
        await this.persistTelemetry(currentProject, "merge", "error", message);
      }
      return;
    }

    if (decision.action !== "advance") {
      await this.persistTelemetry(currentProject, "skip", "idle", decision.reason);
      return;
    }

    try {
      const dispatched = decision.targetTaskId
        ? await dispatchTask(currentProject.id, decision.targetTaskId)
        : await advanceProject(currentProject.id);
      await this.persistTelemetry(dispatched.project, "advance", "advanced", decision.reason);

      if (decision.targetTaskRole) {
        try {
          await recordDecisionLog({
            projectId: currentProject.id,
            missionId: latestMissionId(currentProject),
            taskId: decision.targetTaskId ?? null,
            kind: "workflow",
            actor: resolveAutonomyLoopActor(),
            summary: `Stage dispatch: ${decision.targetTaskRole}`,
            detail: {
              stage: decision.targetTaskRole,
              taskId: decision.targetTaskId,
              reason: decision.reason
            }
          });
        } catch (error) {
          // Best-effort stage log only.
          logger.bestEffortFailure("stage_dispatch_decision_log", error, {
            projectId: currentProject.id,
            taskId: decision.targetTaskId ?? null
          });
        }
      }

      if (!hasRemainingDispatchableTasks(dispatched.project)) {
        const candidate = findLatestCompletedImplementerJob(dispatched.project);
        if (candidate) {
          try {
            const automation = await processProjectPullRequestAutomation(dispatched.project, null, null);
            if (automation) {
              await this.persistTelemetry(automation.project, automation.lastAction, automation.lastOutcome, automation.message);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "Pull request automation failed";
            this.logger.error({ error, projectId: currentProject.id }, "Autonomy loop pull request automation failed");
            await this.persistTelemetry(dispatched.project, "merge", "error", message);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dispatch failed";
      this.logger.error({ error, projectId: currentProject.id }, "Autonomy loop dispatch failed");
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
