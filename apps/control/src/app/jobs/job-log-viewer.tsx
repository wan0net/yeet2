"use client";

import { useState } from "react";

interface JobLogViewerProps {
  projectId: string;
  jobId: string;
}

interface JobLogPayload {
  log?: {
    jobId: string;
    logPath: string | null;
    content: string;
    truncated: boolean;
  };
  message?: string;
  error?: string;
}

export function JobLogViewer({ projectId, jobId }: JobLogViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoad() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/jobs/${jobId}/log`, {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = (await response.json().catch(() => null)) as JobLogPayload | null;

      if (!response.ok || !payload?.log) {
        throw new Error(
          typeof payload?.message === "string"
            ? payload.message
            : typeof payload?.error === "string"
              ? payload.error
              : "Unable to load log"
        );
      }

      setContent(payload.log.content);
      setLogPath(payload.log.logPath ?? null);
      setTruncated(Boolean(payload.log.truncated));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load log");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <details className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-slate-800" onClick={() => void handleLoad()}>
        View log tail
      </summary>
      <div className="mt-3 space-y-2">
        {logPath ? <div className="text-[11px] text-slate-500">Source: {logPath}</div> : null}
        {truncated ? <div className="text-[11px] text-amber-700">Showing the most recent portion of the log.</div> : null}
        {isLoading ? <div className="text-sm text-slate-500">Loading log...</div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        {content ? (
          <pre className="max-h-96 overflow-auto rounded-xl border border-slate-200 bg-slate-950 px-3 py-3 text-xs leading-6 text-slate-100 whitespace-pre-wrap">
            {content}
          </pre>
        ) : null}
      </div>
    </details>
  );
}
