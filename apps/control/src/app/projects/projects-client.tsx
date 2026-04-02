"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  emptyConstitutionFiles,
  formatConstitutionFiles,
  type ProjectBlockerRecord,
  type ProjectRecord,
  type ProjectTaskRecord
} from "../../lib/projects";
import {
  blockerLinkedTask,
  blockerStatusLabel,
  blockerStatusTone,
  formatTimestamp,
  jobStatusTone,
  latestJob,
  projectNextDispatchableTask,
  stageLabel,
  statusLabel,
  statusTone,
  taskCanDispatch,
  taskDispatchBlockedReason,
  activeMission,
  sortBlockers
} from "../../lib/project-detail";
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
    return `Dispatching ${stageLabel(task.agentRole)}...`;
  }

  const prefix = task.status === "failed" ? "Re-dispatch" : "Dispatch";
  return `${prefix} ${stageLabel(task.agentRole)}`;
}

interface BlockerGitHubIssueActionProps {
  blocker: ProjectBlockerRecord;
  projectId: string;
  onProjectUpdate?: (project: ProjectRecord) => void;
  onMessage?: (message: string) => void;
}

export function BlockerGitHubIssueAction({
  blocker,
  projectId,
  onProjectUpdate,
  onMessage
}: BlockerGitHubIssueActionProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOpen = blocker.status.toLowerCase() === "open";

  async function handleCreateGitHubIssue() {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/blockers/${blocker.id}/github-issue`, {
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
        throw new Error(detailMessage(payload.detail, payload.error || "Unable to create GitHub issue"));
      }

      onMessage?.(`Filed issue for ${blocker.title}.`);

      if (payload.project && onProjectUpdate) {
        onProjectUpdate(payload.project);
        return;
      }

      router.refresh();
    } catch (createIssueError) {
      setError(createIssueError instanceof Error ? createIssueError.message : "Unable to create GitHub issue");
    } finally {
      setIsCreating(false);
    }
  }

  if (blocker.githubIssueUrl) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900 transition hover:bg-sky-100"
          href={blocker.githubIssueUrl}
          rel="noreferrer"
          target="_blank"
        >
          View GitHub issue
        </a>
        <span className="text-xs text-slate-500">GitHub escalation already exists.</span>
      </div>
    );
  }

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          className="rounded-full border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isCreating}
          onClick={() => void handleCreateGitHubIssue()}
          type="button"
        >
          {isCreating ? "Creating issue..." : "Create GitHub issue"}
        </button>
        <span className="text-xs text-slate-500">Escalate this blocker to GitHub without leaving control.</span>
      </div>

      {error ? <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
    </>
  );
}

export function ProjectsClient() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [advanceErrors, setAdvanceErrors] = useState<Record<string, string>>({});
  const [dispatchErrors, setDispatchErrors] = useState<Record<string, string>>({});
  const [blockerErrors, setBlockerErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planningProjectId, setPlanningProjectId] = useState<string | null>(null);
  const [advancingProjectId, setAdvancingProjectId] = useState<string | null>(null);
  const [dispatchingTaskIds, setDispatchingTaskIds] = useState<Record<string, boolean>>({});
  const [resolvingBlockerIds, setResolvingBlockerIds] = useState<Record<string, boolean>>({});
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

  async function handleAdvanceProject(projectId: string) {
    setAdvancingProjectId(projectId);
    setAdvanceErrors((current) => {
      const next = { ...current };
      delete next[projectId];
      return next;
    });
    setMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/advance`, {
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
        throw new Error(detailMessage(payload.detail, payload.error || "Unable to advance project"));
      }

      if (payload.project) {
        setProjects((current) => current.map((project) => (project.id === payload.project?.id ? payload.project! : project)));
        setMessage(`Advanced ${payload.project.name}. yeet2 will dispatch the next eligible stage automatically.`);
      } else {
        await loadProjects();
        setMessage("Advanced project. yeet2 will dispatch the next eligible stage automatically.");
      }
    } catch (advanceError) {
      const message = advanceError instanceof Error ? advanceError.message : "Unable to advance project";
      setAdvanceErrors((current) => ({ ...current, [projectId]: message }));
    } finally {
      setAdvancingProjectId(null);
    }
  }

  async function handleResolveBlocker(projectId: string, blocker: ProjectBlockerRecord) {
    setResolvingBlockerIds((current) => ({ ...current, [blocker.id]: true }));
    setBlockerErrors((current) => {
      const next = { ...current };
      delete next[blocker.id];
      return next;
    });
    setMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/blockers/${blocker.id}/resolve`, {
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
        throw new Error(detailMessage(payload.detail, payload.error || "Unable to resolve blocker"));
      }

      if (payload.project) {
        setProjects((current) => current.map((project) => (project.id === payload.project?.id ? payload.project! : project)));
        setMessage(`Resolved ${blocker.title}.`);
      } else {
        await loadProjects();
      }
    } catch (resolveError) {
      const message = resolveError instanceof Error ? resolveError.message : "Unable to resolve blocker";
      setBlockerErrors((current) => ({ ...current, [blocker.id]: message }));
    } finally {
      setResolvingBlockerIds((current) => {
        const next = { ...current };
        delete next[blocker.id];
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
              placeholder="/Users/icd/Workspace/forgeyard (optional)"
              value={form.local_path}
            />
            <span className="text-xs leading-5 text-slate-500">
              Leave this blank to let yeet2 clone the repository into its managed projects directory, or set it to attach an existing local checkout.
            </span>
          </label>

          <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
            <button
              className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Registering..." : "Register project"}
            </button>
            <span className="text-sm text-slate-500">
              Register a repo by attaching an existing checkout or by letting yeet2 clone it before indexing the constitution.
            </span>
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
            No projects are attached yet. Register a repository above to attach an existing checkout or let yeet2 clone it into the managed projects directory.
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
              const currentMission = activeMission(project);
              const nextDispatchableTask = projectNextDispatchableTask(project);
              const nextDispatchableRole = project.nextDispatchableTaskRole ?? nextDispatchableTask?.agentRole ?? null;
              const blockers = sortBlockers(project.blockers);

              return (
                <article key={project.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                          <Link className="transition hover:text-teal-700" href={`/projects/${project.id}` as Route}>
                            {project.name}
                          </Link>
                        </h2>
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

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      className="rounded-full border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={advancingProjectId === project.id}
                      onClick={() => void handleAdvanceProject(project.id)}
                      type="button"
                    >
                      {advancingProjectId === project.id ? "Advancing..." : "Advance project"}
                    </button>
                    <span className="text-sm text-slate-500">
                      Ask yeet2 to advance this project and dispatch the next eligible stage automatically.
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

                  {nextDispatchableRole ? (
                    <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                      <span className="font-medium text-sky-900">Next up:</span>{" "}
                      {nextDispatchableTask?.title
                        ? `${nextDispatchableTask.title} is queued for ${stageLabel(nextDispatchableRole)} and yeet2 can dispatch it automatically when you advance the project.`
                        : `${stageLabel(nextDispatchableRole)} is the next dispatchable stage and yeet2 can dispatch it automatically when you advance the project.`}
                    </div>
                  ) : null}

                  {advanceErrors[project.id] ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{advanceErrors[project.id]}</div>
                  ) : null}

                  {blockers.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-700">Blockers</div>
                        <div className="text-xs text-amber-800">
                          {blockers.filter((blocker) => blocker.status.toLowerCase() === "open").length} open / {blockers.length} total
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {blockers.map((blocker) => {
                          const linkedTask = blockerLinkedTask(project, blocker);
                          const isOpen = blocker.status.toLowerCase() === "open";
                          const timestamp = isOpen ? formatTimestamp(blocker.createdAt) : formatTimestamp(blocker.resolvedAt ?? blocker.createdAt);

                          return (
                            <div key={blocker.id} className="rounded-2xl border border-amber-100 bg-white/90 px-3 py-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0 space-y-1">
                                  <div className="font-medium text-slate-900">{blocker.title}</div>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                    {linkedTask ? (
                                      <span>
                                        Task: <span className="font-medium text-slate-700">{linkedTask.title}</span>
                                      </span>
                                    ) : null}
                                    {timestamp ? <span>{isOpen ? "Raised" : "Updated"} {timestamp}</span> : null}
                                  </div>
                                </div>
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${blockerStatusTone(
                                    blocker.status
                                  )}`}
                                >
                                  {blockerStatusLabel(blocker.status)}
                                </span>
                              </div>

                              {blocker.context ? <p className="mt-2 text-sm leading-6 text-slate-600">{blocker.context}</p> : null}
                              {blocker.recommendation ? (
                                <div className="mt-2 text-sm text-slate-600">
                                  <span className="font-medium text-slate-800">Recommendation:</span> {blocker.recommendation}
                                </div>
                              ) : null}

                              <BlockerGitHubIssueAction
                                blocker={blocker}
                                onMessage={setMessage}
                                onProjectUpdate={(updatedProject) =>
                                  setProjects((current) => current.map((entry) => (entry.id === updatedProject.id ? updatedProject : entry)))
                                }
                                projectId={project.id}
                              />

                              {isOpen ? (
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                  <button
                                    className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={Boolean(resolvingBlockerIds[blocker.id])}
                                    onClick={() => void handleResolveBlocker(project.id, blocker)}
                                    type="button"
                                  >
                                    {resolvingBlockerIds[blocker.id] ? "Resolving..." : "Resolve blocker"}
                                  </button>
                                  <span className="text-xs text-slate-500">Mark this blocker resolved and refresh the project state.</span>
                                </div>
                              ) : null}

                              {blockerErrors[blocker.id] ? (
                                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                  {blockerErrors[blocker.id]}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Active mission</div>
                        <div className="text-lg font-semibold text-slate-900">
                          {currentMission ? currentMission.title : "No mission planned yet"}
                        </div>
                      </div>
                      {currentMission ? (
                        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                          {currentMission.status}
                        </div>
                      ) : null}
                    </div>

                    {currentMission ? (
                      <div className="mt-3 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="space-y-3">
                          <p className="text-sm leading-6 text-slate-600">{currentMission.objective || "No mission objective recorded yet."}</p>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                            <span className="font-medium text-slate-800">Created by:</span> {currentMission.createdBy ?? "unknown"}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                            Tasks {currentMission.tasks.length > 0 ? `(${currentMission.tasks.length})` : ""}
                          </div>
                          {currentMission.tasks.length > 0 ? (
                            <div className="space-y-3">
                              {currentMission.tasks.map((task) => {
                                const canDispatch = taskCanDispatch(project, task);
                                const blockedReason = taskDispatchBlockedReason(project, task);
                                const latest = latestJob(task);

                                return (
                                  <div
                                    key={task.id}
                                    className={`rounded-2xl border px-4 py-3 transition ${
                                      latest ? "border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-sm" : "border-slate-200 bg-white"
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
                                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                                      Stage: {stageLabel(task.agentRole)}
                                    </div>
                                    {task.blockerReason ? (
                                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                        {task.blockerReason}
                                      </div>
                                    ) : null}
                                    {canDispatch ? (
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
                                          Send this {stageLabel(task.agentRole)} task to the executor and refresh the latest job state inline.
                                        </span>
                                      </div>
                                    ) : null}
                                    {blockedReason ? (
                                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                        {blockedReason}
                                      </div>
                                    ) : null}
                                    {dispatchErrors[task.id] ? (
                                      <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                        {dispatchErrors[task.id]}
                                      </div>
                                    ) : null}
                                    {latest ? (
                                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Latest job</div>
                                          <span
                                            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${jobStatusTone(
                                              latest.status ?? "unknown"
                                            )}`}
                                          >
                                            {latest.status ?? "unknown"}
                                          </span>
                                        </div>
                                        <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                                            <span>
                                              <span className="font-medium text-slate-800">Branch:</span> {latest.branchName || "—"}
                                            </span>
                                            <span>
                                              <span className="font-medium text-slate-800">Workspace:</span> {latest.workspacePath || "—"}
                                            </span>
                                          </div>
                                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                                            {formatTimestamp(latest.startedAt ?? null) ? (
                                              <span>
                                                <span className="font-medium text-slate-800">Started:</span> {formatTimestamp(latest.startedAt ?? null)}
                                              </span>
                                            ) : null}
                                            {formatTimestamp(latest.completedAt ?? null) ? (
                                              <span>
                                                <span className="font-medium text-slate-800">Completed:</span> {formatTimestamp(latest.completedAt ?? null)}
                                              </span>
                                            ) : null}
                                          </div>
                                          {latest.artifactSummary ? (
                                            <div>
                                              <span className="font-medium text-slate-800">Artifacts:</span> {latest.artifactSummary}
                                            </div>
                                          ) : null}
                                          {latest.logPath ? (
                                            <div className="break-all">
                                              <span className="font-medium text-slate-800">Log:</span> {latest.logPath}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
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
