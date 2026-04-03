"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import type { ProjectDecisionLogRecord } from "../../../lib/projects";
import { decisionLogLabel, decisionLogTone } from "../../../lib/projects";
import { formatTimestamp } from "../../../lib/project-detail";

interface ProjectTeamChatProps {
  projectId: string;
  entries: ProjectDecisionLogRecord[];
}

function mentionParts(content: string): Array<{ text: string; mention: boolean }> {
  const matches = [...content.matchAll(/@([a-z0-9][a-z0-9._-]{1,63})/gi)];
  if (matches.length === 0) {
    return [{ text: content, mention: false }];
  }

  const parts: Array<{ text: string; mention: boolean }> = [];
  let cursor = 0;
  for (const match of matches) {
    if (typeof match.index !== "number") {
      continue;
    }

    if (match.index > cursor) {
      parts.push({ text: content.slice(cursor, match.index), mention: false });
    }

    parts.push({ text: match[0], mention: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) {
    parts.push({ text: content.slice(cursor), mention: false });
  }

  return parts;
}

export function ProjectTeamChat({ projectId, entries }: ProjectTeamChatProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replyTarget = useMemo(
    () => entries.find((entry) => entry.id === replyToId) ?? null,
    [entries, replyToId]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          content,
          replyToId
        })
      });
      const payload = (await response.json().catch(() => null)) as { detail?: unknown; message?: string; error?: string } | null;

      if (!response.ok) {
        const message =
          typeof payload?.detail === "string"
            ? payload.detail
            : typeof payload?.message === "string"
              ? payload.message
              : typeof payload?.error === "string"
                ? payload.error
                : "Unable to post message";
        throw new Error(message);
      }

      setContent("");
      setReplyToId(null);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to post message");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <form className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleSubmit}>
        {replyTarget ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
            Replying to <span className="font-medium">{replyTarget.actor ?? replyTarget.title}</span>
            <button
              className="ml-3 rounded-full border border-violet-300 px-2 py-0.5 text-[11px] font-medium text-violet-700 transition hover:bg-violet-100"
              onClick={() => setReplyToId(null)}
              type="button"
            >
              Clear
            </button>
          </div>
        ) : null}

        <textarea
          className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
          onChange={(event) => setContent(event.currentTarget.value)}
          placeholder="Add operator guidance, ask a question, or @reply to a teammate."
          value={content}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">Use `@name` mentions to call out a teammate or reply inline to a workflow message.</div>
          <button
            className="rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || !content.trim()}
            type="submit"
          >
            {isSubmitting ? "Posting..." : "Post to team chat"}
          </button>
        </div>
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      </form>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No workflow chat yet.
          </div>
        ) : (
          entries.map((entry) => {
            const replyToIdValue = typeof entry.detail?.replyToId === "string" ? entry.detail.replyToId : null;
            const replyTargetEntry = replyToIdValue ? entries.find((candidate) => candidate.id === replyToIdValue) ?? null : null;
            const contentToShow = entry.summary ?? entry.title;
            const actor = entry.actor ?? "system";
            return (
              <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{actor}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${decisionLogTone(entry.eventType)}`}>
                        {decisionLogLabel(entry.eventType)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{formatTimestamp(entry.createdAt) ?? "Unknown time"}</div>
                  </div>
                  <button
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    onClick={() => {
                      setReplyToId(entry.id);
                      setContent((current) => (current.trim().length > 0 ? current : `@${actor.replace(/\s+/g, "-").toLowerCase()} `));
                    }}
                    type="button"
                  >
                    Reply
                  </button>
                </div>

                {replyTargetEntry ? (
                  <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
                    Replying to <span className="font-medium">{replyTargetEntry.actor ?? replyTargetEntry.title}</span>: {replyTargetEntry.summary ?? replyTargetEntry.title}
                  </div>
                ) : null}

                <div className="mt-3 text-sm leading-6 text-slate-700">
                  {mentionParts(contentToShow).map((part, index) =>
                    part.mention ? (
                      <span key={`${entry.id}-${index}`} className="font-medium text-violet-700">
                        {part.text}
                      </span>
                    ) : (
                      <span key={`${entry.id}-${index}`}>{part.text}</span>
                    )
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
