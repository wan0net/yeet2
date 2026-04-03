import Link from "next/link";
import type { Route } from "next";
import { SectionCard, StatusBadge } from "@yeet2/ui";

import { fetchWorkerRegistry, workerStatusLabel, workerStatusTone } from "../../lib/workers";

export const dynamic = "force-dynamic";

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

function summarizeWorkerKind(kind: string | null, executorType: string | null): string {
  if (kind && executorType) {
    return `${kind} / ${executorType}`;
  }

  return kind ?? executorType ?? "Unknown";
}

export default async function WorkersPage() {
  const { workers, registryAvailable, error, detail } = await fetchWorkerRegistry();
  const busyWorkers = workers.filter((worker) => worker.status.toLowerCase() === "busy").length;
  const leasedWorkers = workers.filter((worker) => Boolean(worker.lease)).length;

  return (
    <main className="mt-10 space-y-6">
      <section className="max-w-4xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <StatusBadge>{registryAvailable ? "worker registry" : "worker registry unavailable"}</StatusBadge>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Workers</h1>
            <p className="max-w-3xl text-sm text-slate-600">
              Inspect registered executors, their capability sets, and any live lease or current job assignment without leaving the control plane.
            </p>
          </div>
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" href={"/projects" as Route}>
            Back to projects
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Registered workers</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{workers.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Busy workers</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{busyWorkers}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Leased workers</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{leasedWorkers}</div>
          </div>
        </div>
      </section>

      <SectionCard title="Registry status">
        {registryAvailable ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            The worker catalog is available and {workers.length === 0 ? "currently empty." : `showing ${workers.length} worker${workers.length === 1 ? "" : "s"}.`}
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-medium">Worker registry is not available yet.</div>
            <div>
              The control proxy could not reach the backend <span className="font-mono">/workers</span> endpoint{error ? ` (${error}).` : "."}
            </div>
            {detail ? <div className="break-all font-mono text-xs text-amber-800">{JSON.stringify(detail)}</div> : null}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Registered workers">
        {workers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            {registryAvailable ? "No workers have been registered yet." : "No worker records could be loaded from the backend registry."}
          </div>
        ) : (
          <div className="space-y-3">
            {workers.map((worker) => {
              const leaseJobTitle = worker.lease?.jobTitle ?? worker.currentJobTitle ?? worker.currentJobId ?? null;
              const leaseProject = worker.lease?.projectName ?? null;
              const leaseTask = worker.lease?.taskTitle ?? null;

              return (
                <article key={worker.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900">{worker.name}</h2>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${workerStatusTone(worker.status)}`}>
                          {workerStatusLabel(worker.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>
                          Kind: <span className="font-medium text-slate-700">{summarizeWorkerKind(worker.kind, worker.executorType)}</span>
                        </span>
                        <span>
                          Executor: <span className="font-medium text-slate-700">{worker.executorType ?? "Unknown"}</span>
                        </span>
                        <span>
                          Last heartbeat: <span className="font-medium text-slate-700">{formatTimestamp(worker.lastHeartbeatAt)}</span>
                        </span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs text-slate-600">
                      <div className="font-medium text-slate-800">Worker ID</div>
                      <div className="mt-1 break-all font-mono">{worker.id}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Capabilities</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {worker.capabilities.length > 0 ? (
                          worker.capabilities.map((capability) => (
                            <span key={capability} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                              {capability}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">No capabilities recorded.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Lease / current job</div>
                      {worker.lease ? (
                        <dl className="mt-2 space-y-2 text-sm text-slate-700">
                          <div>
                            <dt className="font-medium text-slate-800">Project</dt>
                            <dd>{leaseProject ?? "Unknown"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-800">Job</dt>
                            <dd>{leaseJobTitle ?? "Unknown"}</dd>
                          </div>
                          {leaseTask ? (
                            <div>
                              <dt className="font-medium text-slate-800">Task</dt>
                              <dd>{leaseTask}</dd>
                            </div>
                          ) : null}
                          <div>
                            <dt className="font-medium text-slate-800">Acquired</dt>
                            <dd>{formatTimestamp(worker.lease.acquiredAt)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-800">Expires</dt>
                            <dd>{formatTimestamp(worker.lease.expiresAt)}</dd>
                          </div>
                        </dl>
                      ) : worker.currentJobId || worker.currentJobTitle ? (
                        <dl className="mt-2 space-y-2 text-sm text-slate-700">
                          <div>
                            <dt className="font-medium text-slate-800">Current job</dt>
                            <dd>{leaseJobTitle ?? "Unknown"}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-slate-800">Status</dt>
                            <dd>{worker.currentJobStatus ?? "Unknown"}</dd>
                          </div>
                        </dl>
                      ) : (
                        <div className="mt-2 text-sm text-slate-500">No active lease or current job recorded.</div>
                      )}
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
