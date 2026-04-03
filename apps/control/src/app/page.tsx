import Link from "next/link";
import type { Route } from "next";
import { StatusBadge, SectionCard } from "@yeet2/ui";

export default function HomePage() {
  return (
    <main className="mt-8 space-y-6">
      <section className="yeet-shell-panel overflow-hidden rounded-[34px] px-6 py-7 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <StatusBadge>control plane</StatusBadge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] sm:text-5xl">
                The operator view for a self-hosted autonomous software factory.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--muted)]">
                yeet2 turns a repo constitution into durable missions, dispatchable work, hosted execution, and human-visible review trails.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90" href="/projects">
                Open projects
              </Link>
              <Link className="rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]" href={"/jobs" as Route}>
                Inspect jobs
              </Link>
              <Link className="rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]" href={"/approvals" as Route}>
                Review approvals
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[24px] border border-[var(--signal-indigo-border)] bg-[var(--signal-indigo)] px-4 py-4">
              <div className="yeet-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Mission posture</div>
              <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">CrewAI planning, hosted execution, reviewable state</div>
            </div>
            <div className="rounded-[24px] border border-[var(--signal-amber-border)] bg-[var(--signal-amber)] px-4 py-4">
              <div className="yeet-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Current stage</div>
              <div className="mt-2 text-sm leading-6 text-[var(--foreground)]">Dogfooding on the deployed forgeyard instance while tightening autonomy and UI quality.</div>
            </div>
            <div className="rounded-[24px] border border-[var(--signal-rose-border)] bg-[var(--signal-rose)] px-4 py-4">
              <div className="yeet-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Operator promise</div>
              <div className="mt-2 text-sm leading-6 text-[var(--foreground)]">Durable missions, isolated work, explicit blockers, and visible agent activity.</div>
            </div>
          </div>
        </div>
      </section>

      <SectionCard title="What is online">
        <ul className="grid gap-3 sm:grid-cols-3">
          <li className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4">Hosted project registration and constitution ingest</li>
          <li className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4">CrewAI planning through the Brain service</li>
          <li className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4">OpenHands-backed executor with isolated worktrees</li>
          <li className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4">Human approvals, blockers, PR policy, and workers</li>
        </ul>
      </SectionCard>
    </main>
  );
}
