import type { PropsWithChildren } from "react";

export function TopBar() {
  return (
    <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">yeet2</div>
        <div className="text-sm text-slate-600">Autonomous software-team control plane</div>
      </div>
      <div className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500">internal</div>
    </header>
  );
}

export function StatusBadge({ children }: PropsWithChildren) {
  return (
    <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-teal-800">
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  children
}: PropsWithChildren<{ title: string }>) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm">
      <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
      {children}
    </section>
  );
}
