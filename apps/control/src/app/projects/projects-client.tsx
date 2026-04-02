"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  emptyConstitutionFiles,
  formatConstitutionFiles,
  type ConstitutionStatus,
  type ProjectJobRecord,
  type ProjectRecord,
  type ProjectTaskRecord
} from "../../lib/projects";
import { SectionCard } from "@yeet2/ui";

interface ProjectFormState {
  name: string;
  repo_url: string;
  default_branch: string;
  local_path: string;
}

const emptyForm = (): ProjectFormState => ({
  name: "",
  repo_url: "",
  default_branch: "main",
  local_path: ""
});

function statusLabel(status: ConstitutionStatus): string {
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

function statusTone(status: ConstitutionStatus): string {
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

function taskCanDispatch(task: ProjectTaskRecord): boolean {
  return task.agentRole === "implementer" && ["ready", "pending", "failed"].includes(task.status);
}

function latestJob(task: ProjectTaskRecord): ProjectJobRecord | null {
  return task.jobs[0] ?? null;
}

function jobStatusTone(status: string): string {
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

function formatTimestamp(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function detailMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (detail && typeof detail === "object") {
    const record = detail as { detail?: unknown; message?: unknown; error?: unknown };
    for (const candidate of [record.detail, record.message, record.error]) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
  }

  return fallback;
}

function dispatchLabel(task: ProjectTaskRecord, isDispatching: boolean): string {
  if (isDispatching) {
    return "Dispatching...";
  }

  return task.status === "failed" ? "Re-dispatch" : "Dispatch";
}

export function ProjectsClient() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [dispatchErrors, setDispatchErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planningProjectId, setPlanningProjectId] = useState<string | null>(null);
  const [dispatchingTaskIds, setDispatchingTaskIds] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyForm());

  async function loadProjects() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        cache: "no-store"
      });
      const payload = (await response.json()) as { projects?: ProjectRecord[]; error?: string; detail?: string };

      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Unable to load projects");
      }

      setProjects(Array.isArray(payload.projects) ? payload.projects : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load projects");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as {
        project?: ProjectRecord;
        error?: string;
        detail?: string;
        missing?: string[];
      };

      if (!response.ok) {
        const details = payload.missing && payload.missing.length > 0 ? `Missing: ${payload.missing.join(", ")}` : payload.detail || payload.error || "Unable to register project";
        throw new Error(details);
      }

      setMessage(`Registered ${payload.project?.name ?? form.name}.`);
      setForm(emptyForm());
      await loadProjects();
    } catch (submitErr) {
      setSubmitError(submitErr instanceof Error ? submitErr.message : "Unable to register project");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePlanProject(projectId: string) {
    setPlanningProjectId(projectId);
    setPlanError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/plan`, {
        method: "POST",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = (await response.json()) as {
        project?: ProjectRecord;
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Unable to build a plan");
      }

      if (payload.project) {
        setProjects((current) => current.map((project) => (project.id === payload.project?.id ? payload.project! : project)));
        setMessage(`Planned ${payload.project.name}.`);
      } else {
        await loadProjects();
      }
    } catch (planErr) {
      setPlanError(planErr instanceof Error ? planErr.message : "Unable to build a plan");
    } finally {
      setPlanningProjectId(null);
    }
  }

  async function handleDispatchTask(projectId: string, task: ProjectTaskRecord) {
    setDispatchingTaskIds((current) => ({ ...current, [task.id]: true }));
    setDispatchErrors((current) => {
      const next = { ...current };
      delete next[task.id];
      return next;
    });
    setMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${task.id}/dispatch`, {
        method: "POST",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = (await response.json()) as {
        project?: ProjectRecord;
        error?: string;
        detail?: unknown;
      };

      if (!response.ok) {
        throw new Error(detailMessage(payload.detail, payload.error || "Unable to dispatch task"));
      }

      if (payload.project) {
        setProjects((current) => current.map((project) => (project.id === payload.project?.id ? payload.project! : project)));
        setMessage(`Dispatched ${task.title}.`);
      } else {
        await loadProjects();
      }
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : "Unable to dispatch task";
      setDispatchErrors((current) => ({ ...current, [task.id]: message }));
    } finally {
      setDispatchingTaskIds((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
    }
  }

  const fileKeys: Array<keyof NonNullable<ProjectRecord["constitution"]["files"]>> = [
    "vision",
    "spec",
    "roadmap",
    "architecture",
    "decisions",
    "qualityBar"
  ];

  return (
    <div className="space-y-6">
      <SectionCard title="Register local repository">
        <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Project name</span>
            <input
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              name="name"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="forgeyard"
              value={form.name}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Repository URL</span>
            <input
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              name="repo_url"
              onChange={(event) => setForm((current) => ({ ...current, repo_url: event.target.value }))}
              placeholder="https://github.com/example/forgeyard.git"
              value={form.repo_url}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Default branch</span>
            <input
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              name="default_branch"
              onChange={(event) => setForm((current) => ({ ...current, default_branch: event.target.value }))}
              placeholder="main"
              value={form.default_branch}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Local path</span>
            <input
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              name="local_path"
              onChange={(event) => setForm((current) => ({ ...current, local_path: event.target.value }))}
              placeholder="/Users/icd/Workspace/forgeyard"
              value={form.local_path}
            />
          </label>

          <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
            <button
              className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Registering..." : "Register project"}
            </button>
            <span className="text-sm text-slate-500">Attaches an existing local checkout and asks the API to index its constitution.</span>
          </div>

          {submitError ? (
            <div className="lg:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</div>
          ) : null}
          {message ? (
            <div className="lg:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
          ) : null}
        </form>
      </SectionCard>

      <SectionCard title="Attached projects">
        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">Loading projects...</div>
        ) : error ? (
          <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
            <div>Unable to load projects.</div>
            <div className="text-rose-600">{error}</div>
            <button
              className="rounded-full border border-rose-300 px-4 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
              onClick={() => void loadProjects()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No projects are attached yet. Register a local checkout above to start tracking its constitution and work history.
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((project) => {
              const fileSummary = formatConstitutionFiles(project.constitution.files ?? emptyConstitutionFiles());
              const counts = [
                project.activeMissionCount ?? 0,
                project.activeTaskCount ?? 0,
                project.blockerCount ?? 0
              ];
              const activeMission =
                project.missions.find((mission) => mission.status === "active" || mission.status === "planned") ?? project.missions[0] ?? null;

              return (
                <article key={project.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{project.name}</h2>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${statusTone(project.constitutionStatus)}`}>
                          {statusLabel(project.constitutionStatus)}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-slate-600">
                        <div className="break-all">
                          <span className="font-medium text-slate-800">Repo:</span> {project.repoUrl || "—"}
                        </div>
                        <div className="break-all">
                          <span className="font-medium text-slate-800">Local path:</span> {project.localPath || "—"}
                        </div>
                        <div>
                          <span className="font-medium text-slate-800">Constitution:</span> {fileSummary}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[240px]">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Missions</div>
                        <div className="text-lg font-semibold text-slate-900">{counts[0]}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Tasks</div>
                        <div className="text-lg font-semibold text-slate-900">{counts[1]}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Blockers</div>
                        <div className="text-lg font-semibold text-slate-900">{counts[2]}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={planningProjectId === project.id}
                      onClick={() => void handlePlanProject(project.id)}
                      type="button"
                    >
                      {planningProjectId === project.id ? "Planning..." : "Plan project"}
                    </button>
                    <span className="text-sm text-slate-500">
                      Trigger the planner to turn this constitution into an initial mission and task set.
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {fileKeys.map((key) => {
                      const isPresent = project.constitution.files?.[key] ?? false;
                      return (
                        <span
                          key={key}
                          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                            isPresent ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-500"
                          }`}
                        >
                          {key} {isPresent ? "yes" : "no"}
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Active mission</div>
                        <div className="text-lg font-semibold text-slate-900">
                          {activeMission ? activeMission.title : "No mission planned yet"}
                        </div>
                      </div>
                      {activeMission ? (
                        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                          {activeMission.status}
                        </div>
                      ) : null}
                    </div>

                    {activeMission ? (
                      <div className="mt-3 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="space-y-3">
                          <p className="text-sm leading-6 text-slate-600">{activeMission.objective || "No mission objective recorded yet."}</p>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                            <span className="font-medium text-slate-800">Created by:</span> {activeMission.createdBy ?? "unknown"}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                            Tasks {activeMission.tasks.length > 0 ? `(${activeMission.tasks.length})` : ""}
                          </div>
                          {activeMission.tasks.length > 0 ? (
                            <div className="space-y-3">
                              {activeMission.tasks.map((task) => (
                                <div
                                  key={task.id}
                                  className={`rounded-2xl border px-4 py-3 transition ${
                                    latestJob(task)
                                      ? "border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-sm"
                                      : "border-slate-200 bg-white"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <div className="font-medium text-slate-900">{task.title}</div>
                                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{task.agentRole}</div>
                                    </div>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
                                      {task.status}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
                                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                    <span>Priority {task.priority}</span>
                                    <span>Attempts {task.attempts}</span>
                                    <span>Acceptance {task.acceptanceCriteria.length}</span>
                                  </div>
                                  {task.blockerReason ? (
                                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                      {task.blockerReason}
                                    </div>
                                  ) : null}
                                  {taskCanDispatch(task) ? (
                                    <div className="mt-3 flex flex-wrap items-center gap-3">
                                      <button
                                        className="rounded-full bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={Boolean(dispatchingTaskIds[task.id])}
                                        onClick={() => void handleDispatchTask(project.id, task)}
                                        type="button"
                                      >
                                        {dispatchLabel(task, Boolean(dispatchingTaskIds[task.id]))}
                                      </button>
                                      <span className="text-xs text-slate-500">
                                        Send this implementer task to the executor and refresh the latest job state inline.
                                      </span>
                                    </div>
                                  ) : null}
                                  {dispatchErrors[task.id] ? (
                                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                      {dispatchErrors[task.id]}
                                    </div>
                                  ) : null}
                                  {latestJob(task) ? (
                                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Latest job</div>
                                        <span
                                          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${jobStatusTone(
                                            latestJob(task)?.status ?? "unknown"
                                          )}`}
                                        >
                                          {latestJob(task)?.status ?? "unknown"}
                                        </span>
                                      </div>
                                      <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                                          <span>
                                            <span className="font-medium text-slate-800">Branch:</span> {latestJob(task)?.branchName || "—"}
                                          </span>
                                          <span>
                                            <span className="font-medium text-slate-800">Workspace:</span> {latestJob(task)?.workspacePath || "—"}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                                          {formatTimestamp(latestJob(task)?.startedAt ?? null) ? (
                                            <span>
                                              <span className="font-medium text-slate-800">Started:</span> {formatTimestamp(latestJob(task)?.startedAt ?? null)}
                                            </span>
                                          ) : null}
                                          {formatTimestamp(latestJob(task)?.completedAt ?? null) ? (
                                            <span>
                                              <span className="font-medium text-slate-800">Completed:</span> {formatTimestamp(latestJob(task)?.completedAt ?? null)}
                                            </span>
                                          ) : null}
                                        </div>
                                        {latestJob(task)?.artifactSummary ? (
                                          <div>
                                            <span className="font-medium text-slate-800">Artifacts:</span> {latestJob(task)?.artifactSummary}
                                          </div>
                                        ) : null}
                                        {latestJob(task)?.logPath ? (
                                          <div className="break-all">
                                            <span className="font-medium text-slate-800">Log:</span> {latestJob(task)?.logPath}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                              The mission exists, but no tasks have been persisted yet.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                        No mission has been generated for this project yet. Use “Plan project” to create one from the constitution.
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      {planError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{planError}</div> : null}
    </div>
  );
}
