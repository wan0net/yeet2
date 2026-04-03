"use client";

import { SectionCard } from "@yeet2/ui";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { formatTimestamp } from "../../../lib/project-detail";
import {
  autonomyModeLabel,
  autonomyModeTone,
  branchCleanupModeLabel,
  branchCleanupModeTone,
  mergeApprovalModeLabel,
  mergeApprovalModeTone,
  pullRequestDraftModeLabel,
  pullRequestDraftModeTone,
  pullRequestModeLabel,
  pullRequestModeTone,
  type ProjectAutonomyMode,
  type ProjectAutonomyState,
  type ProjectBranchCleanupMode,
  type ProjectMergeApprovalMode,
  type ProjectPullRequestDraftMode,
  type ProjectPullRequestMode
} from "../../../lib/projects";

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
  const [pullRequestMode, setPullRequestMode] = useState<ProjectPullRequestMode>(autonomy.pullRequestMode);
  const [pullRequestDraftMode, setPullRequestDraftMode] = useState<ProjectPullRequestDraftMode>(autonomy.pullRequestDraftMode);
  const [mergeApprovalMode, setMergeApprovalMode] = useState<ProjectMergeApprovalMode>(autonomy.mergeApprovalMode);
  const [branchCleanupMode, setBranchCleanupMode] = useState<ProjectBranchCleanupMode>(autonomy.branchCleanupMode);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMode(autonomy.mode);
    setPullRequestMode(autonomy.pullRequestMode);
    setPullRequestDraftMode(autonomy.pullRequestDraftMode);
    setMergeApprovalMode(autonomy.mergeApprovalMode);
    setBranchCleanupMode(autonomy.branchCleanupMode);
  }, [autonomy.mode, autonomy.pullRequestMode, autonomy.pullRequestDraftMode, autonomy.mergeApprovalMode, autonomy.branchCleanupMode]);

  async function persistAutonomy(nextMode: ProjectAutonomyMode = mode) {
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
          mode: nextMode,
          autonomyMode: nextMode,
          pullRequestMode,
          pullRequestDraftMode,
          mergeApprovalMode,
          branchCleanupMode
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; detail?: unknown; message?: string } | null;

      if (!response.ok) {
        throw new Error(detailMessage(payload?.detail ?? payload?.message ?? payload?.error, "Unable to update autonomy mode"));
      }

      setMode(nextMode);
      setMessage(`Updated autonomy settings for ${projectName}.`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update autonomy mode");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistAutonomy(mode);
  }

  return (
    <SectionCard title="Autonomy">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-3">
            <div className="rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="yeet-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Run control</div>
                  <div className="mt-1 text-base font-semibold text-[var(--foreground)]">
                    {autonomy.mode === "autonomous" ? "Agents are allowed to keep running." : "Agents are paused or gated."}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    Use the quick controls below to start or stop the project loop immediately.
                  </div>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${autonomyModeTone(autonomy.mode)}`}>
                  {autonomyModeLabel(autonomy.mode)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="rounded-full border border-emerald-300 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving || autonomy.mode === "autonomous"}
                  onClick={() => void persistAutonomy("autonomous")}
                  type="button"
                >
                  {isSaving && mode === "autonomous" ? "Starting..." : "Start AI"}
                </button>
                <button
                  className="rounded-full border border-rose-300 bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving || autonomy.mode === "manual"}
                  onClick={() => void persistAutonomy("manual")}
                  type="button"
                >
                  {isSaving && mode === "manual" ? "Stopping..." : "Stop AI"}
                </button>
                <button
                  className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving || autonomy.mode === "supervised"}
                  onClick={() => void persistAutonomy("supervised")}
                  type="button"
                >
                  Supervised mode
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Control how {projectName} runs its planning loop, PR automation, merge gating, and branch cleanup. Manual keeps the loop paused, supervised keeps approval in the loop, and autonomous allows the loop to run on its own. PRs can be opened manually or after a specific role, start as draft or ready, merge approval can stay with a human or be handed off, and branches can be kept or cleaned up after merge.
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">PR timing</span>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  onChange={(event) => setPullRequestMode(event.currentTarget.value as ProjectPullRequestMode)}
                  value={pullRequestMode}
                >
                  <option value="unknown">Unknown</option>
                  <option value="manual">Manual</option>
                  <option value="after_implementer">After implementer</option>
                  <option value="after_reviewer">After reviewer</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">PR draft state</span>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  onChange={(event) => setPullRequestDraftMode(event.currentTarget.value as ProjectPullRequestDraftMode)}
                  value={pullRequestDraftMode}
                >
                  <option value="unknown">Unknown</option>
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Merge approval</span>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  onChange={(event) => setMergeApprovalMode(event.currentTarget.value as ProjectMergeApprovalMode)}
                  value={mergeApprovalMode}
                >
                  <option value="unknown">Unknown</option>
                  <option value="human_approval">Human approval</option>
                  <option value="agent_signoff">Agent signoff</option>
                  <option value="no_approval">No approval</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Branch cleanup</span>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  onChange={(event) => setBranchCleanupMode(event.currentTarget.value as ProjectBranchCleanupMode)}
                  value={branchCleanupMode}
                >
                  <option value="unknown">Unknown</option>
                  <option value="manual">Manual</option>
                  <option value="after_merge">After merge</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Saving..." : "Save settings"}
              </button>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${autonomyModeTone(autonomy.mode)}`}>
                Current: {autonomyModeLabel(autonomy.mode)}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${pullRequestModeTone(autonomy.pullRequestMode)}`}>
                PR timing: {pullRequestModeLabel(autonomy.pullRequestMode)}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${pullRequestDraftModeTone(autonomy.pullRequestDraftMode)}`}>
                PR draft: {pullRequestDraftModeLabel(autonomy.pullRequestDraftMode)}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${mergeApprovalModeTone(autonomy.mergeApprovalMode)}`}>
                Merge: {mergeApprovalModeLabel(autonomy.mergeApprovalMode)}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${branchCleanupModeTone(autonomy.branchCleanupMode)}`}>
                Cleanup: {branchCleanupModeLabel(autonomy.branchCleanupMode)}
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
