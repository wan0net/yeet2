import Link from "next/link";
import type { Route } from "next";
import { headers } from "next/headers";
import { SectionCard, StatusBadge } from "@yeet2/ui";

import { flattenProjectBlockers, isOpenBlocker } from "../../lib/blockers";
import type { ProjectRecord } from "../../lib/projects";

export const dynamic = "force-dynamic";

function blockerStatusTone(status: string): string {
  return isOpenBlocker(status)
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function formatTimestamp(value: string | null): string | null {
  if (!value) {
    return null;
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

async function fetchProjects(): Promise<ProjectRecord[]> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const baseUrl = host ? `${protocol}://${host}` : "http://127.0.0.1:3000";
  const response = await fetch(`${baseUrl}/api/projects`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Unable to load blockers");
  }

  const payload = (await response.json()) as { projects?: ProjectRecord[] };
  return Array.isArray(payload.projects) ? payload.projects : [];
}

export default async function BlockersPage() {
  const projects = await fetchProjects();
  const blockers = flattenProjectBlockers(projects);
  const openCount = blockers.filter((entry) => isOpenBlocker(entry.blocker.status)).length;

  return (
    <main className="mt-10 space-y-6">
      <section className="max-w-3xl space-y-4">
        <StatusBadge>project blockers</StatusBadge>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Blockers</h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Review every blocker across attached projects in one queue, with open items sorted to the top for faster triage.
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
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Open blockers</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{openCount}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Total blockers</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{blockers.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Projects affected</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{projects.filter((project) => project.blockers.length > 0).length}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="All blockers">
        {blockers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No blockers are currently recorded across attached projects.
          </div>
        ) : (
          <div className="space-y-3">
            {blockers.map(({ blocker, projectId, projectName, taskTitle }) => {
              const open = isOpenBlocker(blocker.status);
              const raisedAt = formatTimestamp(blocker.createdAt);
              const resolvedAt = formatTimestamp(blocker.resolvedAt);

              return (
                <article key={blocker.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900">{blocker.title}</h2>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${blockerStatusTone(blocker.status)}`}>
                          {blocker.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>
                          Project:{" "}
                          <Link className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2" href={"/projects" as Route}>
                            {projectName}
                          </Link>
                        </span>
                        {taskTitle ? (
                          <span>
                            Task: <span className="font-medium text-slate-700">{taskTitle}</span>
                          </span>
                        ) : null}
                        {raisedAt ? <span>Raised {raisedAt}</span> : null}
                        {!open && resolvedAt ? <span>Resolved {resolvedAt}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr_0.75fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Context</div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{blocker.context ?? "No context captured."}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recommendation</div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{blocker.recommendation ?? "No recommendation recorded."}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Timestamps</div>
                      <dl className="mt-2 space-y-2 text-sm text-slate-700">
                        <div>
                          <dt className="font-medium text-slate-800">Created</dt>
                          <dd>{raisedAt ?? "Unknown"}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-800">Resolved</dt>
                          <dd>{resolvedAt ?? "Open"}</dd>
                        </div>
                      </dl>
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
