import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SectionCard, StatusBadge } from "@yeet2/ui";

import { flattenProjectJobs } from "../../lib/jobs";
import {
  branchCleanupLifecycleLabel,
  branchCleanupLifecycleTone,
  jobGitHubCompareUrl,
  jobGitHubPullRequestLabel,
  jobGitHubPullRequestLifecycleLabel,
  jobGitHubPullRequestLifecycleTone,
  parseGitHubRepoUrl,
  projectGitHubRepoInfo
} from "../../lib/projects";
import type { ProjectRecord } from "../../lib/projects";
import { controlBaseUrl } from "../../lib/project-resource";
import { JobLogViewer } from "./job-log-viewer";

export const dynamic = "force-dynamic";

function jobStatusTone(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === "complete" || normalized === "completed" || normalized === "success" || normalized === "succeeded") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (normalized === "failed" || normalized === "error" || normalized === "cancelled") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (normalized === "running" || normalized === "in_progress" || normalized === "started") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function summarizeLogPath(logPath: string | null): string {
  if (!logPath) {
    return "No log path recorded";
  }

  const segments = logPath.split("/").filter(Boolean);
  return segments.at(-1) ?? logPath;
}

async function createProjectJobPullRequest(projectId: string, jobId: string): Promise<void> {
  "use server";

  const baseUrl = await controlBaseUrl();
  const response = await fetch(`${baseUrl}/api/projects/${projectId}/jobs/${jobId}/pull-request`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Unable to create pull request");
  }

  redirect("/jobs");
}

async function fetchProjects(): Promise<ProjectRecord[]> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const baseUrl = host ? `${protocol}://${host}` : "http://127.0.0.1:3000";
  const response = await fetch(`${baseUrl}/api/projects`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Unable to load jobs");
  }

  const payload = (await response.json()) as { projects?: ProjectRecord[] };
  return Array.isArray(payload.projects) ? payload.projects : [];
}

export default async function JobsPage() {
  const projects = await fetchProjects();
  const jobs = flattenProjectJobs(projects);
  const activeJobs = jobs.filter(({ job }) => {
    const normalized = job.status.toLowerCase();
    return normalized === "running" || normalized === "in_progress" || normalized === "started";
  }).length;
  const completedJobs = jobs.filter(({ job }) => {
    const normalized = job.status.toLowerCase();
    return normalized === "complete" || normalized === "completed" || normalized === "success" || normalized === "succeeded";
  }).length;

  return (
    <main className="mt-10 space-y-6">
      <section className="max-w-3xl space-y-4">
        <StatusBadge>job activity</StatusBadge>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Jobs</h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Track executor activity across every attached project, newest first, with the workspace, branch, and output trail kept together.
            </p>
          </div>
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" href={"/projects" as Route}>
            Back to projects
          </Link>
        </div>
      </section>

      <SectionCard title="Queue overview">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Total jobs</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{jobs.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Active jobs</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{activeJobs}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Completed jobs</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{completedJobs}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="All jobs">
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No jobs have been recorded across attached projects yet.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(({ job, project, mission, task }) => {
              const githubRepo = projectGitHubRepoInfo(project) ?? parseGitHubRepoUrl(project.repoUrl);
              const githubBranchLink = jobGitHubCompareUrl(job, project.repoUrl, job.branchName);
              const canCreatePullRequest = Boolean(githubRepo && job.branchName && !job.githubPrUrl);

              return (
                <article key={job.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900">{task?.title ?? mission?.title ?? job.id}</h2>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${jobStatusTone(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>
                          Project: <span className="font-medium text-slate-700">{project.name}</span>
                        </span>
                        <span>
                          Repo:{" "}
                          {githubRepo ? (
                            <a className="font-medium text-slate-700 underline-offset-4 hover:underline" href={githubRepo.webUrl} rel="noreferrer" target="_blank">
                              {githubRepo.owner && githubRepo.repo ? `${githubRepo.owner}/${githubRepo.repo}` : project.repoUrl || "Unknown"}
                            </a>
                          ) : (
                            <span className="font-medium text-slate-700">{project.repoUrl || "Unknown"}</span>
                          )}
                        </span>
                        {task?.agentRole ? (
                          <span>
                            Role: <span className="font-medium text-slate-700">{task.agentRole}</span>
                          </span>
                        ) : null}
                        {job.assignedRoleDefinitionLabel ? (
                          <span>
                            Staff: <span className="font-medium text-slate-700">{job.assignedRoleDefinitionLabel}</span>
                          </span>
                        ) : null}
                        {job.assignedRoleDefinitionModel ? (
                          <span>
                            Model: <span className="font-medium text-slate-700">{job.assignedRoleDefinitionModel}</span>
                          </span>
                        ) : null}
                        <span>
                          Executor: <span className="font-medium text-slate-700">{job.executorType}</span>
                        </span>
                        {job.workerId ? (
                          <span>
                            Worker:{" "}
                            <Link className="font-medium text-slate-700 underline-offset-4 hover:underline" href={"/workers" as Route}>
                              {job.workerId}
                            </Link>
                          </span>
                        ) : null}
                        <span>
                          Branch:{" "}
                          {githubBranchLink ? (
                            <a className="font-medium text-slate-700 underline-offset-4 hover:underline" href={githubBranchLink} rel="noreferrer" target="_blank">
                              {job.branchName}
                            </a>
                          ) : (
                            <span className="font-medium text-slate-700">{job.branchName || "Unknown"}</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs text-slate-600">
                      <div className="font-medium text-slate-800">Job ID</div>
                      <div className="mt-1 break-all font-mono">{job.id}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_0.95fr_0.9fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Execution</div>
                      <dl className="mt-2 space-y-2 text-sm text-slate-700">
                        <div>
                          <dt className="font-medium text-slate-800">Workspace</dt>
                          <dd className="break-all font-mono text-xs text-slate-600">{job.workspacePath || project.localPath || "Unknown"}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-800">Task</dt>
                          <dd>{task?.title ?? "No task title recorded"}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-800">Mission</dt>
                          <dd>{mission?.title ?? "No mission recorded"}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Timestamps</div>
                      <dl className="mt-2 space-y-2 text-sm text-slate-700">
                        <div>
                          <dt className="font-medium text-slate-800">Started</dt>
                          <dd>{formatTimestamp(job.startedAt)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-800">Completed</dt>
                          <dd>{formatTimestamp(job.completedAt)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-800">Task status</dt>
                          <dd>{task?.status ?? "Unknown"}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Outputs</div>
                      <dl className="mt-2 space-y-2 text-sm text-slate-700">
                        <div>
                          <dt className="font-medium text-slate-800">Artifacts</dt>
                          <dd>{job.artifactSummary ?? "No artifact summary recorded"}</dd>
                        </div>
                        {job.workerId ? (
                          <div>
                            <dt className="font-medium text-slate-800">Worker</dt>
                            <dd>
                              <Link className="font-medium text-slate-700 underline-offset-4 hover:underline" href={"/workers" as Route}>
                                {job.workerId}
                              </Link>
                            </dd>
                          </div>
                        ) : null}
                        <div>
                          <dt className="font-medium text-slate-800">Log</dt>
                          <dd className="break-all font-mono text-xs text-slate-600">{summarizeLogPath(job.logPath)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-800">Pull request</dt>
                          <dd className="flex flex-wrap items-center gap-2">
                            {job.githubPrUrl ? (
                              <>
                                <a className="font-medium text-slate-700 underline-offset-4 hover:underline" href={job.githubPrUrl} rel="noreferrer" target="_blank">
                                  {jobGitHubPullRequestLabel(job)}
                                </a>
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${jobGitHubPullRequestLifecycleTone(job)}`}>
                                  {jobGitHubPullRequestLifecycleLabel(job)}
                                </span>
                                {job.githubPrTitle ? <span className="text-slate-500">{job.githubPrTitle}</span> : null}
                              </>
                            ) : canCreatePullRequest ? (
                              <form action={createProjectJobPullRequest.bind(null, project.id, job.id)}>
                                <button className="rounded-full border border-slate-300 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-100" type="submit">
                                  Create PR
                                </button>
                              </form>
                            ) : (
                              <span className="text-slate-500">Not available</span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-800">Branch cleanup</dt>
                          <dd className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${branchCleanupLifecycleTone(job)}`}>
                              {branchCleanupLifecycleLabel(job)}
                            </span>
                            {job.githubBranchCleanupDeletedAt ? <span className="text-slate-500">Deleted {formatTimestamp(job.githubBranchCleanupDeletedAt)}</span> : null}
                          </dd>
                        </div>
                        {job.githubPrMergedAt ? (
                          <div>
                            <dt className="font-medium text-slate-800">Merged</dt>
                            <dd>{formatTimestamp(job.githubPrMergedAt)}</dd>
                          </div>
                        ) : null}
                      </dl>
                      <div className="mt-3">
                        <JobLogViewer jobId={job.id} projectId={project.id} />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </main>
  );
}
