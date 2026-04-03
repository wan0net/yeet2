"use client";

import { SectionCard } from "@yeet2/ui";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { formatTimestamp } from "../../../lib/project-detail";
import { autonomyModeLabel, autonomyModeTone, type ProjectAutonomyMode, type ProjectAutonomyState } from "../../../lib/projects";

interface ProjectAutonomyPanelProps {
  projectId: string;
  projectName: string;
  autonomy: ProjectAutonomyState;
}

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

export function ProjectAutonomyPanel({ projectId, projectName, autonomy }: ProjectAutonomyPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ProjectAutonomyMode>(autonomy.mode);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMode(autonomy.mode);
  }, [autonomy.mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/autonomy`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          mode,
          autonomyMode: mode
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; detail?: unknown; message?: string } | null;

      if (!response.ok) {
        throw new Error(detailMessage(payload?.detail ?? payload?.message ?? payload?.error, "Unable to update autonomy mode"));
      }

      setMessage(`Updated autonomy mode for ${projectName}.`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update autonomy mode");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SectionCard title="Autonomy">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Control how {projectName} runs its planning loop and review cycle. Manual keeps the loop paused, supervised keeps approval in the loop, and autonomous allows the loop to run on its own.
            </div>
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Autonomy mode</span>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                onChange={(event) => setMode(event.currentTarget.value as ProjectAutonomyMode)}
                value={mode}
              >
                <option value="unknown">Unknown</option>
                <option value="manual">Manual</option>
                <option value="supervised">Supervised</option>
                <option value="autonomous">Autonomous</option>
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Saving..." : "Save mode"}
              </button>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${autonomyModeTone(autonomy.mode)}`}>
                Current: {autonomyModeLabel(autonomy.mode)}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Last run</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{autonomy.lastRunStatus ?? "Not recorded"}</div>
              <div className="mt-1 text-xs text-slate-500">{autonomy.lastRunAt ? formatTimestamp(autonomy.lastRunAt) : "No run timestamp"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Message</div>
              <div className="mt-1 text-sm text-slate-700">{autonomy.lastRunMessage ?? "No loop message recorded."}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:col-span-2 lg:col-span-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Next run</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{autonomy.nextRunAt ? formatTimestamp(autonomy.nextRunAt) : "Not scheduled"}</div>
            </div>
          </div>
        </div>

        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      </form>
    </SectionCard>
  );
}
