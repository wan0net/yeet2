import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { SectionCard, StatusBadge } from "@yeet2/ui";

import { formatTimestamp, jobStatusTone, missionRecentJobs, missionResultSummaries, stageLabel } from "../../../lib/project-detail";
import { fetchMissionDetail } from "../../../lib/project-resource";

export const dynamic = "force-dynamic";

export default async function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await fetchMissionDetail(id);

  if (!detail) {
    notFound();
  }

  const { mission, project } = detail;
  const jobs = missionRecentJobs(mission).slice(0, 8);
  const resultSummaries = missionResultSummaries(mission).slice(0, 6);
  const assignedRoles = Array.from(new Set(mission.tasks.map((task) => stageLabel(task.agentRole))));
  const completedTasks = mission.tasks.filter((task) => ["complete", "completed", "done"].includes(task.status.toLowerCase())).length;

  return (
    <main className="mt-10 space-y-6">
      <section className="max-w-4xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <StatusBadge>mission detail</StatusBadge>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{mission.title}</h1>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                {mission.status}
              </span>
            </div>
            <p className="max-w-3xl text-sm text-slate-600">
              {mission.objective || "No mission objective recorded yet."}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                Project:{" "}
                <Link className="font-medium text-slate-700 underline-offset-4 hover:underline" href={`/projects/${project.id}` as Route}>
                  {project.name}
                </Link>
              </span>
              <span>Created by: <span className="font-medium text-slate-700">{mission.createdBy ?? "unknown"}</span></span>
              <span>Started: <span className="font-medium text-slate-700">{formatTimestamp(mission.startedAt) ?? "Unknown"}</span></span>
            </div>
          </div>
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" href={`/projects/${project.id}` as Route}>
            Back to project
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Tasks</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{mission.tasks.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Completed</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{completedTasks}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Roles</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{assignedRoles.length}</div>
          </div>
        </div>
      </section>

      <SectionCard title="Assigned roles">
        {assignedRoles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No roles are assigned to this mission yet.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assignedRoles.map((role) => (
              <span key={role} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-700">
                {role}
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Task list">
        {mission.tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No tasks are recorded for this mission yet.
          </div>
        ) : (
          <div className="space-y-3">
            {mission.tasks.map((task) => {
              const latestJob = task.jobs[0] ?? null;

              return (
                <article key={task.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-slate-900">{task.title}</h2>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>Status: <span className="font-medium text-slate-700">{task.status}</span></span>
                        <span>Assigned role: <span className="font-medium text-slate-700">{stageLabel(task.agentRole)}</span></span>
                        <span>Priority {task.priority}</span>
                        <span>Attempts {task.attempts}</span>
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
                      {task.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{task.description || "No task description recorded."}</p>
                  {task.acceptanceCriteria.length > 0 ? (
                    <div className="mt-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Acceptance criteria</div>
                      <ul className="mt-2 space-y-1 text-sm text-slate-600">
                        {task.acceptanceCriteria.map((criterion, index) => (
                          <li key={`${task.id}-${index}`}>{criterion}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {task.blockerReason ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {task.blockerReason}
                    </div>
                  ) : null}
                  {latestJob ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Latest job</div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${jobStatusTone(latestJob.status)}`}>
                          {latestJob.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span>Started: <span className="font-medium text-slate-700">{formatTimestamp(latestJob.startedAt) ?? "Unknown"}</span></span>
                        <span>Completed: <span className="font-medium text-slate-700">{formatTimestamp(latestJob.completedAt) ?? "Not completed"}</span></span>
                        <span>Branch: <span className="font-medium text-slate-700">{latestJob.branchName || "—"}</span></span>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent job runs">
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No jobs have been recorded for this mission yet.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(({ job, task }) => (
              <article key={job.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">{task.title}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${jobStatusTone(job.status)}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Assigned role: <span className="font-medium text-slate-700">{stageLabel(task.agentRole)}</span></span>
                      <span>Executor: <span className="font-medium text-slate-700">{job.executorType}</span></span>
                      <span>Branch: <span className="font-medium text-slate-700">{job.branchName || "—"}</span></span>
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

      <SectionCard title="Result summaries">
        {resultSummaries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No artifact or result summaries are recorded for this mission yet.
          </div>
        ) : (
          <div className="space-y-3">
            {resultSummaries.map(({ job, task, summary }) => (
              <article key={`${job.id}-summary`} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-slate-900">{task.title}</h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Assigned role: <span className="font-medium text-slate-700">{stageLabel(task.agentRole)}</span></span>
                      <span>Job: <span className="font-medium text-slate-700">{job.id}</span></span>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${jobStatusTone(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{summary}</p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </main>
  );
}
