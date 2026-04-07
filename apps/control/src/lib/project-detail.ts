import type {
  ConstitutionStatus,
  ProjectBlockerRecord,
  ProjectJobRecord,
  ProjectMissionRecord,
  ProjectRecord,
  ProjectRoleDefinition,
  ProjectTaskRecord
} from "./projects";

/**
 * Numeric comparator for ISO-or-otherwise date strings. Falls back to 0
 * (equal) for unparseable values so a malformed timestamp doesn't push a
 * row to the front or back of the list. Returns descending order (newest
 * first) when used as compareDescending(left, right).
 */
export function compareDateDescending(left: string | null | undefined, right: string | null | undefined): number {
  const l = left ? Date.parse(left) : NaN;
  const r = right ? Date.parse(right) : NaN;
  const lValid = Number.isFinite(l);
  const rValid = Number.isFinite(r);
  if (lValid && rValid) return r - l;
  if (lValid) return -1; // valid dates win over invalid
  if (rValid) return 1;
  return 0;
}

export function statusLabel(status: ConstitutionStatus): string {
  switch (status) {
    case "parsed":
      return "parsed";
    case "pending":
      return "pending";
    case "missing":
      return "missing";
    case "stale":
      return "stale";
    case "failed":
      return "failed";
    case "error":
      return "error";
    default:
      return "unknown";
  }
}

export function statusTone(status: ConstitutionStatus): string {
  switch (status) {
    case "parsed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "missing":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "stale":
      return "border-orange-200 bg-orange-50 text-orange-800";
    case "failed":
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function stageLabel(agentRole: string): string {
  switch (agentRole.toLowerCase()) {
    case "implementer":
      return "implementation";
    case "qa":
      return "QA";
    case "reviewer":
      return "review";
    default:
      return agentRole;
  }
}

function roleSupportsDispatch(agentRole: string): boolean {
  return ["implementer", "tester", "coder", "qa", "reviewer"].includes(agentRole.toLowerCase());
}

function fallbackTaskCanDispatch(project: ProjectRecord, task: ProjectTaskRecord): boolean {
  if (!roleSupportsDispatch(task.agentRole) || !["ready", "pending", "failed"].includes(task.status)) {
    return false;
  }

  if (project.nextDispatchableTaskId) {
    return project.nextDispatchableTaskId === task.id;
  }

  if ((project.dispatchableRoles?.length ?? 0) > 0) {
    return project.dispatchableRoles?.some((role) => role.toLowerCase() === task.agentRole.toLowerCase()) ?? false;
  }

  return true;
}

export function taskCanDispatch(project: ProjectRecord, task: ProjectTaskRecord): boolean {
  if (typeof task.dispatchable === "boolean") {
    return task.dispatchable;
  }

  return fallbackTaskCanDispatch(project, task);
}

export function taskDispatchBlockedReason(project: ProjectRecord, task: ProjectTaskRecord): string | null {
  if (taskCanDispatch(project, task)) {
    return null;
  }

  return task.dispatchBlockedReason ?? null;
}

export function projectNextDispatchableTask(project: ProjectRecord): ProjectTaskRecord | null {
  if (!project.nextDispatchableTaskId) {
    return null;
  }

  for (const mission of project.missions) {
    const match = mission.tasks.find((task) => task.id === project.nextDispatchableTaskId);
    if (match) {
      return match;
    }
  }

  return null;
}

export function latestJob(task: ProjectTaskRecord): ProjectJobRecord | null {
  return task.jobs[0] ?? null;
}

export function jobStatusTone(status: string): string {
  switch (status) {
    case "complete":
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "running":
    case "in_progress":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "queued":
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "failed":
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function jobStatusPillClass(status: string): string {
  switch (status) {
    case "complete":
    case "completed":
      return "success";
    case "running":
    case "in_progress":
      return "info";
    case "queued":
    case "pending":
      return "warn";
    case "failed":
    case "error":
      return "danger";
    default:
      return "";
  }
}

export function blockerStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "resolved":
      return "resolved";
    case "dismissed":
      return "dismissed";
    case "open":
      return "open";
    default:
      return status || "unknown";
  }
}

export function blockerStatusTone(status: string): string {
  switch (status.toLowerCase()) {
    case "resolved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "dismissed":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "open":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function formatTimestamp(value: string | null, locale?: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function blockerLinkedTask(project: ProjectRecord, blocker: ProjectBlockerRecord): ProjectTaskRecord | null {
  if (!blocker.taskId) {
    return null;
  }

  for (const mission of project.missions) {
    const match = mission.tasks.find((task) => task.id === blocker.taskId);
    if (match) {
      return match;
    }
  }

  return null;
}

export function activeMission(project: ProjectRecord): ProjectMissionRecord | null {
  return project.missions.find((mission) => mission.status === "active" || mission.status === "planned") ?? project.missions[0] ?? null;
}

export function sortBlockers(blockers: ProjectBlockerRecord[]): ProjectBlockerRecord[] {
  return [...blockers].sort((left, right) => {
    const leftOpen = left.status.toLowerCase() === "open";
    const rightOpen = right.status.toLowerCase() === "open";

    if (leftOpen !== rightOpen) {
      return leftOpen ? -1 : 1;
    }

    return compareDateDescending(left.createdAt, right.createdAt);
  });
}

export function recentJobs(project: ProjectRecord): Array<{
  job: ProjectJobRecord;
  mission: ProjectMissionRecord;
  task: ProjectTaskRecord;
}> {
  return project.missions
    .flatMap((mission) =>
      mission.tasks.flatMap((task) =>
        task.jobs.map((job) => ({
          job,
          mission,
          task
        }))
      )
    )
    .sort((left, right) => {
      const rightTimestamp = right.job.startedAt ?? right.job.completedAt ?? "";
      const leftTimestamp = left.job.startedAt ?? left.job.completedAt ?? "";
      return rightTimestamp.localeCompare(leftTimestamp);
    });
}

export function missionRecentJobs(
  mission: ProjectMissionRecord
): Array<{
  job: ProjectJobRecord;
  task: ProjectTaskRecord;
}> {
  return mission.tasks
    .flatMap((task) =>
      task.jobs.map((job) => ({
        job,
        task
      }))
    )
    .sort((left, right) => {
      const rightTimestamp = right.job.startedAt ?? right.job.completedAt ?? "";
      const leftTimestamp = left.job.startedAt ?? left.job.completedAt ?? "";
      return rightTimestamp.localeCompare(leftTimestamp);
    });
}

export function missionResultSummaries(mission: ProjectMissionRecord): Array<{
  job: ProjectJobRecord;
  task: ProjectTaskRecord;
  summary: string;
}> {
  return missionRecentJobs(mission)
    .filter(({ job }) => Boolean(job.artifactSummary))
    .map(({ job, task }) => ({
      job,
      task,
      summary: job.artifactSummary ?? ""
    }));
}

export function groupTasksByState(project: ProjectRecord): Array<{
  state: string;
  tasks: Array<{
    mission: ProjectMissionRecord;
    task: ProjectTaskRecord;
  }>;
}> {
  const grouped = new Map<string, Array<{ mission: ProjectMissionRecord; task: ProjectTaskRecord }>>();

  for (const mission of project.missions) {
    for (const task of mission.tasks) {
      const state = task.status || "unknown";
      const bucket = grouped.get(state) ?? [];
      bucket.push({ mission, task });
      grouped.set(state, bucket);
    }
  }

  return [...grouped.entries()]
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .map(([state, tasks]) => ({ state, tasks }));
}

export interface AgentPresenceRoleSnapshot {
  id: string;
  roleKey: string;
  label: string;
  visual: AgentPresenceRoleVisuals;
  currentTask: { mission: ProjectMissionRecord; task: ProjectTaskRecord } | null;
  nextTask: { mission: ProjectMissionRecord; task: ProjectTaskRecord } | null;
  latestJob: { mission: ProjectMissionRecord; task: ProjectTaskRecord; job: ProjectJobRecord } | null;
  blockerCount: number;
  status: "blocked" | "active" | "queued" | "idle";
}

export interface AgentPresenceRoleVisuals {
  accent: string;
  dot: string;
  stage: string;
}

export interface AgentPresenceOverview {
  mission: ProjectMissionRecord | null;
  missionProgress: {
    completed: number;
    total: number;
    percent: number;
  };
  roles: AgentPresenceRoleSnapshot[];
  openBlockerCount: number;
}

const AGENT_ROLE_VISUALS: Record<string, AgentPresenceRoleVisuals> = {
  planner: {
    accent: "border-cyan-200 bg-cyan-50 text-cyan-900",
    dot: "bg-cyan-400",
    stage: "Briefing"
  },
  architect: {
    accent: "border-indigo-200 bg-indigo-50 text-indigo-900",
    dot: "bg-indigo-400",
    stage: "Blueprints"
  },
  implementer: {
    accent: "border-blue-200 bg-blue-50 text-blue-900",
    dot: "bg-blue-400",
    stage: "Planning"
  },
  tester: {
    accent: "border-purple-200 bg-purple-50 text-purple-900",
    dot: "bg-purple-400",
    stage: "Testing"
  },
  coder: {
    accent: "border-emerald-200 bg-emerald-50 text-emerald-900",
    dot: "bg-emerald-400",
    stage: "Build"
  },
  qa: {
    accent: "border-amber-200 bg-amber-50 text-amber-900",
    dot: "bg-amber-400",
    stage: "Proving"
  },
  reviewer: {
    accent: "border-rose-200 bg-rose-50 text-rose-900",
    dot: "bg-rose-400",
    stage: "Gate"
  },
  visual: {
    accent: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
    dot: "bg-fuchsia-400",
    stage: "Polish"
  }
};

function normalizedRole(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function taskSortScore(task: ProjectTaskRecord): number {
  switch (task.status.toLowerCase()) {
    case "running":
    case "in_progress":
    case "active":
      return 0;
    case "queued":
    case "pending":
      return 1;
    case "ready":
      return 2;
    case "review":
      return 3;
    case "blocked":
    case "failed":
      return 4;
    case "completed":
    case "done":
      return 6;
    default:
      return 5;
  }
}

function sortRoleDefinitions(roleDefinitions: ProjectRoleDefinition[]): ProjectRoleDefinition[] {
  return [...roleDefinitions].sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label) || left.roleKey.localeCompare(right.roleKey));
}

function roleMatchesTask(task: ProjectTaskRecord, definition: ProjectRoleDefinition): boolean {
  if (task.assignedRoleDefinitionId && task.assignedRoleDefinitionId === definition.id) {
    return true;
  }

  if (
    task.assignedRoleDefinitionLabel &&
    task.assignedRoleDefinitionLabel.trim().toLowerCase() === definition.label.trim().toLowerCase()
  ) {
    return true;
  }

  const taskRole = normalizedRole(task.agentRole);
  const roleKey = normalizedRole(definition.roleKey);
  const definitionId = normalizedRole(definition.id);
  const definitionLabel = normalizedRole(definition.label);

  return taskRole === roleKey || taskRole === definitionId || taskRole === definitionLabel;
}

function jobTimestamp(job: ProjectJobRecord): string {
  return job.startedAt ?? job.completedAt ?? "";
}

function missionTaskEntries(project: ProjectRecord): Array<{ mission: ProjectMissionRecord; task: ProjectTaskRecord }> {
  return project.missions.flatMap((mission) => mission.tasks.map((task) => ({ mission, task })));
}

function agentRoleVisuals(roleKey: string, label: string): AgentPresenceRoleVisuals {
  return AGENT_ROLE_VISUALS[normalizedRole(roleKey)] ?? {
    accent: "border-slate-200 bg-slate-50 text-slate-800",
    dot: "bg-slate-400",
    stage: label || "General"
  };
}

export function agentPresenceOverview(project: ProjectRecord): AgentPresenceOverview {
  const mission = activeMission(project);
  const missionTasks = mission?.tasks ?? [];
  const completedMissionTasks = missionTasks.filter((task) => ["completed", "done"].includes(task.status.toLowerCase())).length;
  const openBlockers = sortBlockers(project.blockers).filter((blocker) => blocker.status.toLowerCase() === "open");
  const taskEntries = missionTaskEntries(project);
  const configuredRoleDefinitions = sortRoleDefinitions(project.roleDefinitions);

  const roles = configuredRoleDefinitions.map((definition) => {
    const roleKey = normalizedRole(definition.roleKey || definition.id || definition.label);
    const label = definition.label || definition.roleKey || definition.id || "Role";
    const visual = agentRoleVisuals(roleKey, label);
    const roleEntries = taskEntries.filter(({ task }) => roleMatchesTask(task, definition));
    const sortedRoleEntries = [...roleEntries].sort(
      (left, right) =>
        taskSortScore(left.task) - taskSortScore(right.task) ||
        right.task.priority - left.task.priority ||
        left.task.title.localeCompare(right.task.title)
    );
    const currentTask =
      sortedRoleEntries.find(({ task }) => ["running", "in_progress", "active", "blocked"].includes(task.status.toLowerCase())) ??
      sortedRoleEntries.find(({ task }) => ["pending", "queued"].includes(task.status.toLowerCase())) ??
      null;
    const nextTask =
      sortedRoleEntries.find(({ task }) => taskCanDispatch(project, task) && task.id !== currentTask?.task.id) ??
      sortedRoleEntries.find(({ task }) => ["ready", "pending", "queued"].includes(task.status.toLowerCase()) && task.id !== currentTask?.task.id) ??
      null;
    const latestRoleJob = roleEntries
      .flatMap(({ mission: currentMission, task }) => task.jobs.map((job) => ({ mission: currentMission, task, job })))
      .sort((left, right) => jobTimestamp(right.job).localeCompare(jobTimestamp(left.job)))[0] ?? null;

    const blockerCount = openBlockers.filter((blocker) => {
      if (!blocker.taskId) {
        return false;
      }

      return roleEntries.some(({ task }) => task.id === blocker.taskId);
    }).length + roleEntries.filter(({ task }) => Boolean(task.blockerReason)).length;

    let status: AgentPresenceRoleSnapshot["status"] = "idle";
    if (blockerCount > 0) {
      status = "blocked";
    } else if (currentTask) {
      status = "active";
    } else if (nextTask) {
      status = "queued";
    }

    return {
      id: definition.id,
      roleKey,
      label,
      visual,
      currentTask,
      nextTask,
      latestJob: latestRoleJob,
      blockerCount,
      status
    };
  });

  return {
    mission,
    missionProgress: {
      completed: completedMissionTasks,
      total: missionTasks.length,
      percent: missionTasks.length === 0 ? 0 : Math.round((completedMissionTasks / missionTasks.length) * 100)
    },
    roles,
    openBlockerCount: openBlockers.length
  };
}
