import Link from "next/link";
import type { Route } from "next";
import { StatusBadge, SectionCard } from "@yeet2/ui";

export default function HomePage() {
  return (
    <main className="mt-10 space-y-6">
      <section className="max-w-3xl space-y-4">
        <StatusBadge>control plane</StatusBadge>
        <h1 className="text-4xl font-semibold tracking-tight">yeet2</h1>
        <p className="max-w-2xl text-base text-slate-700">
          Self-hosted autonomous software-team orchestration for constitution-driven projects.
        </p>
        <div className="flex gap-3">
          <Link className="rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white" href="/projects">
            View projects
          </Link>
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" href={"/jobs" as Route}>
            View jobs
          </Link>
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" href={"/approvals" as Route}>
            View approvals
          </Link>
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" href={"/workers" as Route}>
            View workers
          </Link>
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" href={"/blockers" as Route}>
            View blockers
          </Link>
          <span className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700">API and worker skeleton only</span>
        </div>
      </section>

      <SectionCard title="What is online">
        <ul className="grid gap-3 sm:grid-cols-3">
          <li className="rounded-xl border border-slate-200 bg-white p-4">Project registration shell</li>
          <li className="rounded-xl border border-slate-200 bg-white p-4">Health-first API skeleton</li>
          <li className="rounded-xl border border-slate-200 bg-white p-4">Human review approvals queue</li>
          <li className="rounded-xl border border-slate-200 bg-white p-4">Shared domain model package</li>
        </ul>
      </SectionCard>
    </main>
  );
}
