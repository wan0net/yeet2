import type { FastifyBaseLogger } from "fastify";

import {
  advanceProject,
  listRegisteredProjects,
  planProject,
  recordProjectAutonomyRun,
  type ProjectSummary
} from "./projects";

export type AutonomyLoopMode = "manual" | "supervised" | "autonomous";

export interface AutonomyLoopTelemetry {
  projectId: string;
  mode: AutonomyLoopMode;
  lastRunAt: string;
  lastAction: "plan" | "advance" | "skip" | "error";
  lastOutcome: "planned" | "advanced" | "skipped" | "idle" | "error";
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
      await this.persistTelemetry(currentProject, "skip", "idle", "No dispatchable task was available");
      return;
    }

    try {
      const dispatched = await advanceProject(project.id);
      await this.persistTelemetry(dispatched.project, "advance", "advanced", `Dispatched task ${dispatched.job.taskId}`);
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
