"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface JobRefreshButtonProps {
  projectId: string;
  jobId: string;
}

export function JobRefreshButton({ projectId, jobId }: JobRefreshButtonProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/jobs/${jobId}/refresh`, {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Unable to refresh job");
      }

      router.refresh();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh job");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isRefreshing}
        onClick={() => void handleRefresh()}
        type="button"
      >
        {isRefreshing ? "Refreshing..." : "Refresh status"}
      </button>
      {error ? <div className="text-xs text-rose-700">{error}</div> : null}
    </div>
  );
}
