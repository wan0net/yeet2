import type { PropsWithChildren } from "react";

export function TopBar() {
  return (
    <header className="yeet-shell-panel rounded-[28px] px-5 py-4 backdrop-blur sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="yeet-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-strong)]">yeet2</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">Autonomous software factory</div>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              hosted on 10.42.10.101
            </div>
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">Constitution-driven missions, agent orchestration, and reviewable execution.</div>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          {([
            ["/projects", "Projects"],
            ["/jobs", "Jobs"],
            ["/approvals", "Approvals"],
            ["/workers", "Workers"],
            ["/blockers", "Blockers"]
          ] as ReadonlyArray<readonly [string, string]>).map(([href, label]) => (
            <a
              key={href}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
              href={href}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function StatusBadge({ children }: PropsWithChildren) {
  return (
    <span className="yeet-mono inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--accent-strong)]">
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  children
}: PropsWithChildren<{ title: string }>) {
  return (
    <section className="yeet-shell-panel rounded-[30px] p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
        <div className="yeet-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{title}</div>
      </div>
      {children}
    </section>
  );
}
