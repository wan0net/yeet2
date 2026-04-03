import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { SectionCard, StatusBadge } from "@yeet2/ui";

import {
  activeMission,
  agentPresenceOverview,
  blockerLinkedTask,
  blockerStatusLabel,
  blockerStatusTone,
  formatTimestamp,
  jobStatusTone,
  recentJobs,
  sortBlockers,
  stageLabel,
  statusLabel,
  statusTone,
  taskCanDispatch,
  taskDispatchBlockedReason,
  groupTasksByState
} from "../../../lib/project-detail";
import { fetchProject } from "../../../lib/project-resource";
import {
  emptyConstitutionFiles,
  formatConstitutionFiles,
  githubBranchUrl,
  jobGitHubCompareUrl,
  parseGitHubRepoUrl,
  planningProvenanceLabel,
  planningProvenanceTone,
  projectGitHubRepoInfo
} from "../../../lib/projects";
import { ProjectRolesEditor } from "./project-roles-editor";

export const dynamic = "force-dynamic";

const roleVisuals: Record<string, { accent: string; dot: string; stage: string }> = {
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

function roleStatusCopy(status: "blocked" | "active" | "queued" | "idle"): string {
  switch (status) {
    case "blocked":
      return "Needs help";
    case "active":
      return "On stage";
    case "queued":
      return "Queued up";
    default:
      return "Standing by";
  }
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await fetchProject(id);

  if (!project) {
    notFound();
  }

  const files = project.constitution.files ?? emptyConstitutionFiles();
  const blockers = sortBlockers(project.blockers);
  const jobs = recentJobs(project).slice(0, 8);
  const taskGroups = groupTasksByState(project);
  const currentMission = activeMission(project);
  const agentView = agentPresenceOverview(project);
  const githubRepo = projectGitHubRepoInfo(project) ?? parseGitHubRepoUrl(project.repoUrl);
  const githubDefaultBranchLink = githubBranchUrl(project.repoUrl, project.defaultBranch) ?? githubRepo?.webUrl ?? null;
  const openBlockers = blockers.filter((blocker) => blocker.status.toLowerCase() === "open").length;
  const presentRequiredFiles = project.constitution.presentRequiredFiles ?? [];
  const missingRequiredFiles = project.constitution.missingRequiredFiles ?? [];

  return (
    <main className="mt-10 space-y-6">
      <section className="max-w-4xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <StatusBadge>project detail</StatusBadge>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{project.name}</h1>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${statusTone(project.constitutionStatus)}`}>
                {statusLabel(project.constitutionStatus)}
              </span>
            </div>
            <p className="max-w-3xl text-sm text-slate-600">
              Review constitution coverage, the active mission, task queues, recent execution history, and any blockers for this project.
            </p>
          </div>
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" href={"/projects" as Route}>
            Back to projects
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Missions</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{project.activeMissionCount ?? project.missions.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Tasks</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{project.activeTaskCount ?? taskGroups.reduce((sum, group) => sum + group.tasks.length, 0)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Open blockers</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{openBlockers}</div>
          </div>
        </div>
      </section>

      <SectionCard title="Repository">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3 text-sm text-slate-600">
            <div className="break-all">
              <span className="font-medium text-slate-800">Repo:</span>{" "}
              {githubRepo ? (
                <a className="font-medium text-slate-700 underline-offset-4 hover:underline" href={githubRepo.webUrl} rel="noreferrer" target="_blank">
                  {githubRepo.owner && githubRepo.repo ? `${githubRepo.owner}/${githubRepo.repo}` : project.repoUrl || "—"}
                </a>
              ) : (
                project.repoUrl || "—"
              )}
            </div>
            <div className="break-all">
              <span className="font-medium text-slate-800">Local path:</span> {project.localPath || "—"}
            </div>
            <div className="break-all">
              <span className="font-medium text-slate-800">Default branch:</span>{" "}
              {githubDefaultBranchLink ? (
                <a className="font-medium text-slate-700 underline-offset-4 hover:underline" href={githubDefaultBranchLink} rel="noreferrer" target="_blank">
                  {project.defaultBranch}
                </a>
              ) : (
                project.defaultBranch || "—"
              )}
            </div>
            <div>
              <span className="font-medium text-slate-800">Constitution summary:</span> {formatConstitutionFiles(files)}
            </div>
            {project.constitution.lastIndexedAt ? (
              <div>
                <span className="font-medium text-slate-800">Last indexed:</span> {formatTimestamp(project.constitution.lastIndexedAt)}
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Constitution files</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(files).map(([key, present]) => (
                <span
                  key={key}
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                    present ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-500"
                  }`}
                >
                  {key} {present ? "yes" : "no"}
                </span>
              ))}
            </div>
            {presentRequiredFiles.length > 0 ? (
              <div className="mt-4 text-sm text-slate-600">
                <span className="font-medium text-slate-800">Present required:</span> {presentRequiredFiles.join(", ")}
              </div>
            ) : null}
            {missingRequiredFiles.length > 0 ? (
              <div className="mt-2 text-sm text-amber-800">
                <span className="font-medium text-amber-900">Missing required:</span> {missingRequiredFiles.join(", ")}
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <ProjectRolesEditor projectId={project.id} projectName={project.name} roleDefinitions={project.roleDefinitions} />

      <SectionCard title="Active mission">
        {currentMission ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link className="text-lg font-semibold text-slate-900 transition hover:text-slate-700" href={`/missions/${currentMission.id}` as Route}>
                  {currentMission.title}
                </Link>
                <div className="mt-1 text-sm text-slate-600">{currentMission.objective || "No mission objective recorded yet."}</div>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                {currentMission.status}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Created by</div>
                <div className="mt-1 font-medium text-slate-900">{currentMission.createdBy ?? "unknown"}</div>
                <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-slate-500">Planning provenance</div>
                <div className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${planningProvenanceTone(currentMission.planningProvenance)}`}>
                  {planningProvenanceLabel(currentMission.planningProvenance)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Started</div>
                <div className="mt-1 font-medium text-slate-900">{formatTimestamp(currentMission.startedAt) ?? "Unknown"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Completed</div>
                <div className="mt-1 font-medium text-slate-900">{formatTimestamp(currentMission.completedAt) ?? "Not completed"}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No mission has been generated for this project yet.
          </div>
        )}
      </SectionCard>

      <SectionCard title="Agent board">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Live stage map</div>
                <p className="mt-2 text-sm text-slate-600">
                  Agents mirror the project’s real queue: active work, next dispatchable handoff, latest run signal, and blockers.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-right">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Mission progress</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{agentView.missionProgress.percent}%</div>
                <div className="text-xs text-slate-500">
                  {agentView.missionProgress.completed}/{agentView.missionProgress.total || 0} tasks complete
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {agentView.roles.map((role) => {
                const visual = roleVisuals[role.role] ?? roleVisuals.implementer;
                const latestJob = role.latestJob?.job ?? null;
                const currentTask = role.currentTask?.task ?? null;
                const nextTask = role.nextTask?.task ?? null;
                const latestJobLink = latestJob ? jobGitHubCompareUrl(latestJob, project.repoUrl, latestJob.branchName) ?? githubRepo?.webUrl ?? null : null;

                return (
                  <article key={role.role} className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm shadow-slate-200/70">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${visual.accent}`}>
                          <span className={`h-3 w-3 rounded-full ${visual.dot}`} />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{role.label}</div>
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{visual.stage}</div>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${visual.accent}`}>
                        {roleStatusCopy(role.status)}
                      </span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Now handling</div>
                      <div className="mt-2 text-sm font-medium text-slate-900">{currentTask?.title || "No active handoff"}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {currentTask ? `${stageLabel(currentTask.agentRole)} · ${currentTask.status}` : "Waiting for this lane to light up"}
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-200 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Up next</div>
                      <div className="mt-2 text-sm font-medium text-slate-800">{nextTask?.title || "Queue is clear"}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {nextTask ? `${nextTask.status} · priority ${nextTask.priority}` : "Nothing dispatchable for this role right now"}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className={`rounded-full border px-2.5 py-1 ${latestJob ? jobStatusTone(latestJob.status) : "border-slate-200 bg-slate-100 text-slate-500"}`}>
                        Latest run {latestJob?.status || "none"}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 ${role.blockerCount > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                        {role.blockerCount > 0 ? `${role.blockerCount} blocker${role.blockerCount === 1 ? "" : "s"}` : "No blockers"}
                      </span>
                    </div>
                    {latestJob ? (
                      <div className="mt-3 text-xs text-slate-500">
                        Last signal {formatTimestamp(latestJob.startedAt ?? latestJob.completedAt) ?? "Unknown"} on{" "}
                        {latestJobLink && latestJob.branchName ? (
                          <a
                            className="font-medium text-slate-700 underline-offset-4 hover:underline"
                            href={latestJobLink}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {latestJob.branchName}
                          </a>
                        ) : (
                          latestJob.branchName || "no branch"
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Floor pulse</div>
                  <div className="mt-1 text-sm text-slate-600">A quick read on the room before diving into the task list.</div>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
                  {agentView.mission?.status || "idle"}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {agentView.roles.map((role, index) => {
                  const visual = roleVisuals[role.role] ?? roleVisuals.implementer;
                  return (
                    <div key={role.role} className="flex items-center gap-3">
                      <div className="flex w-7 flex-col items-center">
                        <span className={`h-3 w-3 rounded-full ${visual.dot}`} />
                        {index < agentView.roles.length - 1 ? <span className="mt-1 h-8 w-px bg-slate-200" /> : null}
                      </div>
                      <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">{role.label}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${visual.accent}`}>
                            {roleStatusCopy(role.status)}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {(role.currentTask?.task.title || role.nextTask?.task.title || "No assignment staged yet")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Control notes</div>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <span className="font-medium text-slate-900">Current mission:</span> {agentView.mission?.title || "No mission generated yet"}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <span className="font-medium text-slate-900">Active lanes:</span>{" "}
                  {agentView.roles.filter((role) => role.status === "active").map((role) => role.label).join(", ") || "None"}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <span className="font-medium text-slate-900">Watchouts:</span>{" "}
                  {agentView.openBlockerCount > 0 ? `${agentView.openBlockerCount} open blocker${agentView.openBlockerCount === 1 ? "" : "s"} on the board.` : "No open blockers right now."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Tasks by state">
        {taskGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No tasks are recorded for this project yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {taskGroups.map((group) => (
              <div key={group.state} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">{group.state}</div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
                    {group.tasks.length}
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {group.tasks.map(({ mission, task }) => {
                    const latest = task.jobs[0] ?? null;
                    const dispatchBlockedReason = taskDispatchBlockedReason(project, task);
                    const canDispatch = taskCanDispatch(project, task);
                    const latestBranchLink = latest ? jobGitHubCompareUrl(latest, project.repoUrl, latest.branchName) ?? githubRepo?.webUrl ?? null : null;

                    return (
                      <article key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="font-medium text-slate-900">{task.title}</div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span>
                                Mission:{" "}
                                <Link className="font-medium text-slate-700 underline-offset-4 hover:underline" href={`/missions/${mission.id}` as Route}>
                                  {mission.title}
                                </Link>
                              </span>
                              <span>Role: <span className="font-medium text-slate-700">{stageLabel(task.agentRole)}</span></span>
                              <span>Priority {task.priority}</span>
                            </div>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
                            {task.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{task.description || "No task description recorded."}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>Attempts {task.attempts}</span>
                          <span>Acceptance {task.acceptanceCriteria.length}</span>
                          <span>{canDispatch ? "Dispatchable now" : "Not dispatchable"}</span>
                        </div>
                        {task.blockerReason ? (
                          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            {task.blockerReason}
                          </div>
                        ) : null}
                        {dispatchBlockedReason ? (
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                            {dispatchBlockedReason}
                          </div>
                        ) : null}
                        {latest ? (
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Latest job</div>
                              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${jobStatusTone(latest.status ?? "unknown")}`}>
                                {latest.status ?? "unknown"}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                              <span>
                                Branch:{" "}
                                {latestBranchLink && latest.branchName ? (
                                  <a
                                    className="font-medium text-slate-700 underline-offset-4 hover:underline"
                                    href={latestBranchLink}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    {latest.branchName}
                                  </a>
                                ) : (
                                  <span className="font-medium text-slate-700">{latest.branchName || "—"}</span>
                                )}
                              </span>
                              <span>Started: <span className="font-medium text-slate-700">{formatTimestamp(latest.startedAt) ?? "Unknown"}</span></span>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent jobs">
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No jobs have been recorded for this project yet.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(({ job, mission, task }) => (
              <article key={job.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">{task.title}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${jobStatusTone(job.status)}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>
                        Mission:{" "}
                        <Link className="font-medium text-slate-700 underline-offset-4 hover:underline" href={`/missions/${mission.id}` as Route}>
                          {mission.title}
                        </Link>
                      </span>
                      <span>Role: <span className="font-medium text-slate-700">{task.agentRole}</span></span>
                      <span>Executor: <span className="font-medium text-slate-700">{job.executorType}</span></span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs text-slate-600">
                    <div className="font-medium text-slate-800">Job ID</div>
                    <div className="mt-1 break-all font-mono">{job.id}</div>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Execution</div>
                    <div className="mt-2 break-all font-mono text-xs text-slate-600">{job.workspacePath || project.localPath || "Unknown"}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      Branch{" "}
                      {job.branchName && (jobGitHubCompareUrl(job, project.repoUrl, job.branchName) ?? githubRepo?.webUrl) ? (
                        <a
                          className="font-medium text-slate-700 underline-offset-4 hover:underline"
                          href={jobGitHubCompareUrl(job, project.repoUrl, job.branchName) ?? githubRepo?.webUrl ?? ""}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {job.branchName}
                        </a>
                      ) : (
                        job.branchName || "—"
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Timestamps</div>
                    <div className="mt-2 text-xs text-slate-600">Started {formatTimestamp(job.startedAt) ?? "Unknown"}</div>
                    <div className="mt-1 text-xs text-slate-600">Completed {formatTimestamp(job.completedAt) ?? "Not completed"}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Outputs</div>
                    <div className="mt-2 text-xs text-slate-600">{job.artifactSummary ?? "No artifact summary recorded"}</div>
                    {job.logPath ? <div className="mt-1 break-all font-mono text-xs text-slate-600">{job.logPath}</div> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Blockers">
        {blockers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No blockers are recorded for this project.
          </div>
        ) : (
          <div className="space-y-3">
            {blockers.map((blocker) => {
              const linkedTask = blockerLinkedTask(project, blocker);
              const isOpen = blocker.status.toLowerCase() === "open";
              const timestamp = isOpen ? formatTimestamp(blocker.createdAt) : formatTimestamp(blocker.resolvedAt ?? blocker.createdAt);

              return (
                <article key={blocker.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-slate-900">{blocker.title}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {linkedTask ? <span>Task: <span className="font-medium text-slate-700">{linkedTask.title}</span></span> : null}
                        {timestamp ? <span>{isOpen ? "Raised" : "Updated"} {timestamp}</span> : null}
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${blockerStatusTone(blocker.status)}`}>
                      {blockerStatusLabel(blocker.status)}
                    </span>
                  </div>
                  {blocker.context ? <p className="mt-2 text-sm leading-6 text-slate-600">{blocker.context}</p> : null}
                  {blocker.recommendation ? (
                    <div className="mt-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-800">Recommendation:</span> {blocker.recommendation}
                    </div>
                  ) : null}
                  {blocker.options.length > 0 ? (
                    <div className="mt-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-800">Options:</span> {blocker.options.join(", ")}
                    </div>
                  ) : null}
                  {blocker.githubIssueUrl ? (
                    <div className="mt-3">
                      <a
                        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-100"
                        href={blocker.githubIssueUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        GitHub issue
                      </a>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </main>
  );
}
