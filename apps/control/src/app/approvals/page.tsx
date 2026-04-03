import Link from "next/link";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SectionCard, StatusBadge } from "@yeet2/ui";

import { flattenProjectApprovals } from "../../lib/approvals";
import { blockerStatusLabel, blockerStatusTone, formatTimestamp } from "../../lib/project-detail";
import type { ProjectRecord } from "../../lib/projects";
import { controlBaseUrl } from "../../lib/project-resource";

export const dynamic = "force-dynamic";

function isOpenApproval(status: string): boolean {
  return status.trim().toLowerCase() === "open";
}

function readSearchParam(searchParams: Record<string, string | string[] | undefined> | undefined, key: string): string | null {
  const value = searchParams?.[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim());
    return first?.trim() ?? null;
  }

  return null;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

async function submitBlockerApproval(projectId: string, blockerId: string, action: "approve" | "reject"): Promise<void> {
  "use server";

  const baseUrl = await controlBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/projects/${projectId}/blockers/${blockerId}/approval`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action })
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload !== null && "message" in payload
          ? String((payload as Record<string, unknown>).message ?? "Unable to update approval")
          : "Unable to update approval";
      throw new Error(message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : `Unable to ${action} approval`;
    const searchParams = new URLSearchParams({
      approval_error: message,
      approval_blocker: blockerId,
      approval_action: action
    });
    redirect(`/approvals?${searchParams.toString()}` as Route);
  }

  redirect("/approvals" as Route);
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
    throw new Error("Unable to load approvals");
  }

  const payload = (await response.json()) as { projects?: ProjectRecord[] };
  return Array.isArray(payload.projects) ? payload.projects : [];
}

export default async function ApprovalsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const projects = await fetchProjects();
  const approvals = flattenProjectApprovals(projects);
  const openApprovals = approvals.filter((entry) => isOpenApproval(entry.blocker.status));
  const resolvedApprovals = approvals.filter((entry) => !isOpenApproval(entry.blocker.status));
  const projectsWithApprovals = new Set(approvals.map((entry) => entry.projectId)).size;
  const approvalError = readSearchParam(resolvedSearchParams, "approval_error");
  const approvalErrorBlocker = readSearchParam(resolvedSearchParams, "approval_blocker");
  const approvalErrorAction = readSearchParam(resolvedSearchParams, "approval_action");

  return (
    <main className="mt-10 space-y-6">
      <section className="max-w-4xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <StatusBadge>approvals</StatusBadge>
            <h1 className="text-3xl font-semibold tracking-tight">Approvals</h1>
            <p className="max-w-3xl text-sm text-slate-600">
              Review human-gated pull request requests that were surfaced as blockers, with open items at the top and resolved approvals kept for context.
            </p>
          </div>
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" href={"/projects" as Route}>
            Back to projects
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Open approvals</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{openApprovals.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Total approvals</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{approvals.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Projects affected</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{projectsWithApprovals}</div>
          </div>
        </div>
      </section>

      <SectionCard title="Open approvals">
        {openApprovals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No human review approvals are open right now.
          </div>
        ) : (
          <div className="space-y-3">
            {openApprovals.map(({ blocker, projectId, projectName, projectGitHubWebUrl, taskTitle }) => {
              const createdAt = formatTimestamp(blocker.createdAt);
              const isErrored = approvalError && approvalErrorBlocker === blocker.id;
              const approveAction = submitBlockerApproval.bind(null, projectId, blocker.id, "approve");
              const rejectAction = submitBlockerApproval.bind(null, projectId, blocker.id, "reject");
              return (
                <article key={blocker.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900">{blocker.title}</h2>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${blockerStatusTone(blocker.status)}`}>
                          {blockerStatusLabel(blocker.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>
                          Project:{" "}
                          <Link className="font-medium text-slate-700 underline-offset-4 hover:underline" href={`/projects/${projectId}` as Route}>
                            {projectName}
                          </Link>
                        </span>
                        {taskTitle ? (
                          <span>
                            Task: <span className="font-medium text-slate-700">{taskTitle}</span>
                          </span>
                        ) : null}
                        {createdAt ? <span>Raised {createdAt}</span> : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs text-slate-600">
                      <div className="font-medium text-slate-800">Approval ID</div>
                      <div className="mt-1 break-all font-mono">{blocker.id}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr_0.9fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Context</div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{blocker.context ?? "No context captured."}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recommendation</div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{blocker.recommendation ?? "No recommendation recorded."}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">GitHub</div>
                      <div className="mt-2 space-y-2 text-sm text-slate-700">
                        {blocker.githubIssueUrl ? (
                          <a className="inline-flex font-medium text-slate-700 underline-offset-4 hover:underline" href={blocker.githubIssueUrl} rel="noreferrer" target="_blank">
                            View linked issue
                          </a>
                        ) : null}
                        {projectGitHubWebUrl ? (
                          <a className="inline-flex font-medium text-slate-700 underline-offset-4 hover:underline" href={projectGitHubWebUrl} rel="noreferrer" target="_blank">
                            Open repository
                          </a>
                        ) : (
                          <div className="text-slate-500">No GitHub link recorded.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                    <div className="text-sm text-slate-600">
                      Human approval required before the blocker can be cleared.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={approveAction}>
                        <button
                          className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 transition hover:bg-emerald-50"
                          type="submit"
                        >
                          Approve
                        </button>
                      </form>
                      <form action={rejectAction}>
                        <button
                          className="rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-900 transition hover:bg-rose-50"
                          type="submit"
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                  </div>

                  {isErrored ? (
                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {approvalErrorAction ? `${approvalErrorAction[0].toUpperCase()}${approvalErrorAction.slice(1)}` : "Approval"} failed: {approvalError}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Resolved approvals">
        {resolvedApprovals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No resolved approvals have been recorded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {resolvedApprovals.map(({ blocker, projectName, taskTitle }) => {
              const resolvedAt = formatTimestamp(blocker.resolvedAt ?? blocker.createdAt);
              return (
                <article key={blocker.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900">{blocker.title}</h2>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${blockerStatusTone(blocker.status)}`}>
                          {blockerStatusLabel(blocker.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>
                          Project: <span className="font-medium text-slate-700">{projectName}</span>
                        </span>
                        {taskTitle ? (
                          <span>
                            Task: <span className="font-medium text-slate-700">{taskTitle}</span>
                          </span>
                        ) : null}
                        {resolvedAt ? <span>Resolved {resolvedAt}</span> : null}
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
