import type { PropsWithChildren } from "react";

export function TopBar() {
  return (
    <header className="border-b border-[var(--border)] pb-5">
      <div className="flex flex-wrap items-center gap-6">
        <a className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--foreground)]" href="/projects">
          yeet2
        </a>
        <nav className="flex flex-wrap gap-4 text-[13px]">
          {([
            ["/projects", "Projects"],
            ["/jobs", "Jobs"],
            ["/approvals", "Approvals"],
            ["/workers", "Workers"],
            ["/blockers", "Blockers"]
          ] as ReadonlyArray<readonly [string, string]>).map(([href, label]) => (
            <a
              key={href}
              className="py-1 text-[var(--muted)] transition hover:text-[var(--foreground)]"
              href={href}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          <span className="yeet-mono uppercase tracking-[0.12em] text-[var(--muted-dim)]">autonomous software factory</span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            10.42.10.101
          </span>
        </div>
      </div>
    </header>
  );
}

export function StatusBadge({ children }: PropsWithChildren) {
  return (
    <span className="yeet-mono inline-flex rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  children
}: PropsWithChildren<{ title: string }>) {
  return (
    <section className="yeet-shell-panel rounded-[18px] p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
        <div className="yeet-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{title}</div>
      </div>
      {children}
    </section>
  );
}
