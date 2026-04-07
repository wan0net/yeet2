<script lang="ts">
  import type { PageData } from "./$types";
  import { formatTimestamp } from "$lib/project-detail";
  import Markdown from "$lib/ui/Markdown.svelte";
  let { data }: { data: PageData } = $props();

  type TraceEvent = {
    id: number;
    action: string;
    path: string | null;
    content: string | null;
    isError: boolean;
  };

  // Hard limits so an unbounded log file can't freeze the browser. The cap
  // matches what the UI can realistically render in a single view; callers
  // who need more should page through the raw log.
  const MAX_TRACE_EVENTS = 500;
  const MAX_TRACE_LINE_LENGTH = 10_000;

  function parseTraceEvents(logContent: string | null | undefined): TraceEvent[] {
    if (!logContent) return [];
    const events: TraceEvent[] = [];
    let id = 0;
    for (const rawLine of logContent.split("\n")) {
      if (events.length >= MAX_TRACE_EVENTS) break;
      const line = rawLine.trim();
      if (!line.startsWith("{")) continue;
      if (line.length > MAX_TRACE_LINE_LENGTH) continue;
      try {
        const payload = JSON.parse(line);
        if (typeof payload !== "object" || payload === null) continue;
        const action = typeof payload.action === "string" ? payload.action : null;
        if (!action) continue;
        const path =
          typeof payload.path === "string" ? payload.path :
          typeof payload.file === "string" ? payload.file :
          typeof payload.filepath === "string" ? payload.filepath : null;
        const content =
          typeof payload.content === "string" ? payload.content.slice(0, 200) :
          typeof payload.message === "string" ? payload.message.slice(0, 200) : null;
        const isError = payload.type === "error" || action === "error";
        events.push({ id: id++, action, path, content, isError });
      } catch {
        // skip malformed JSON
      }
    }
    return events;
  }

  const traceEvents = $derived(parseTraceEvents(data.log?.content));
  const hasTrace = $derived(traceEvents.length > 0);
  const screenshotSrc = $derived(
    data.job.artifactSummary?.startsWith("data:image/") ? data.job.artifactSummary : null
  );
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Job detail</span>
    <div>
      <h1>Job {data.job.id.slice(0, 8)}</h1>
      <p>{data.projectName} &middot; {data.taskTitle}</p>
    </div>
  </div>
  <a class="btn secondary" href="/jobs">Back to jobs</a>
</section>

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Status</div>
    <div class="metric-value">{data.job.status}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Role</div>
    <div class="metric-value">{data.taskRole}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Executor</div>
    <div class="metric-value">{data.job.executorType}</div>
  </div>
</section>

<section class="card">
  <div class="card-header">Details</div>
  <div class="card-body stack">
    <div><strong>Branch:</strong> {data.job.branchName || "—"}</div>
    <div><strong>Worker:</strong> {data.job.workerId || "—"}</div>
    <div><strong>Workspace:</strong> {data.job.workspacePath || "—"}</div>
    <div><strong>Started:</strong> {formatTimestamp(data.job.startedAt) || "—"}</div>
    <div><strong>Completed:</strong> {formatTimestamp(data.job.completedAt) || "—"}</div>
    {#if data.job.assignedRoleDefinitionLabel}
      <div><strong>Assigned staff:</strong> {data.job.assignedRoleDefinitionLabel}</div>
    {/if}
    {#if data.job.assignedRoleDefinitionModel}
      <div><strong>Model:</strong> {data.job.assignedRoleDefinitionModel}</div>
    {/if}
    {#if data.job.githubPrUrl}
      <div><strong>Pull request:</strong> <a href={data.job.githubPrUrl} target="_blank" rel="noopener">{data.job.githubPrTitle || `#${data.job.githubPrNumber}`}</a></div>
    {/if}
    {#if data.job.githubCompareUrl}
      <div><strong>Compare:</strong> <a href={data.job.githubCompareUrl} target="_blank" rel="noopener">View diff</a></div>
    {/if}
  </div>
</section>

{#if data.job.artifactData}
<section class="card">
  <div class="card-header">Artifacts</div>
  <div class="card-body stack">
    {#if data.job.artifactData.buildStatus != null}
      <div class="artifact-row">
        <span class="artifact-label">Build</span>
        {#if data.job.artifactData.buildStatus === "pass"}
          <span class="pill success">&#10003; pass</span>
        {:else if data.job.artifactData.buildStatus === "fail"}
          <span class="pill danger">&#10007; fail</span>
        {:else}
          <span class="pill">unknown</span>
        {/if}
      </div>
    {/if}
    {#if data.job.artifactData.testOutput != null}
      <div class="artifact-row">
        <span class="artifact-label">Tests</span>
        <div class="artifact-metrics">
          <span class="artifact-metric success">{data.job.artifactData.testOutput.passed} passed</span>
          {#if data.job.artifactData.testOutput.failed > 0}
            <span class="artifact-metric danger">{data.job.artifactData.testOutput.failed} failed</span>
          {:else}
            <span class="artifact-metric">{data.job.artifactData.testOutput.failed} failed</span>
          {/if}
          <span class="artifact-metric muted">{data.job.artifactData.testOutput.total} total</span>
        </div>
      </div>
    {/if}
    {#if data.job.artifactData.diffSummary.length > 0}
      <div class="artifact-section">
        <div class="artifact-label">Changed files</div>
        <ul class="diff-list">
          {#each data.job.artifactData.diffSummary as file}
            <li class="diff-file">{file}</li>
          {/each}
        </ul>
      </div>
    {/if}
    {#if data.job.artifactData.handoffNote}
      <div class="artifact-section">
        <div class="artifact-label">Handoff note</div>
        <div class="artifact-text">{data.job.artifactData.handoffNote}</div>
      </div>
    {/if}
    {#if data.job.artifactData.summary}
      <div class="artifact-section">
        <div class="artifact-label">Summary</div>
        <Markdown content={data.job.artifactData.summary} />
      </div>
    {/if}
  </div>
</section>
{:else if data.job.artifactSummary}
<section class="card">
  <div class="card-header">Artifact summary</div>
  <div class="card-body">
    {#if screenshotSrc}
      <img src={screenshotSrc} alt="Visual artifact" style="max-width:100%;border-radius:var(--radius-md,0.5rem);">
    {:else}
      <Markdown content={data.job.artifactSummary} />
    {/if}
  </div>
</section>
{/if}

{#if hasTrace}
<section class="card">
  <div class="card-header">
    Execution trace
    <span class="pill">{traceEvents.length} events</span>
    {#if data.log?.truncated}
      <span class="pill warn">Truncated</span>
    {/if}
  </div>
  <div class="card-body">
    <div class="trace-timeline">
      {#each traceEvents as event}
        <div class="trace-event {event.isError ? 'trace-event--error' : ''}">
          <div class="trace-action">
            <span class="trace-badge {event.isError ? 'danger' : 'info'}">{event.action}</span>
            {#if event.path}
              <span class="trace-path">{event.path}</span>
            {/if}
          </div>
          {#if event.content}
            <div class="trace-content">{event.content}</div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</section>
{:else}
<section class="card">
  <div class="card-header">
    Execution log
    {#if data.log?.truncated}
      <span class="pill warn">Truncated</span>
    {/if}
  </div>
  <div class="card-body">
    {#if data.log?.content}
      <pre class="log-output">{data.log.content}</pre>
    {:else}
      <div class="empty-state">No log content available.</div>
    {/if}
  </div>
</section>
{/if}

<style>
  .artifact-row {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
  }
  .artifact-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }
  .artifact-label {
    font-size: var(--font-size-sm, 0.8125rem);
    color: var(--color-text-secondary, #888);
    font-weight: 500;
    min-width: 6rem;
  }
  .artifact-metrics {
    display: flex;
    gap: var(--space-3, 0.75rem);
  }
  .artifact-metric {
    font-size: var(--font-size-sm, 0.8125rem);
    font-variant-numeric: tabular-nums;
    color: var(--color-text-secondary, #888);
  }
  .artifact-metric.success {
    color: var(--color-status-success, #22c55e);
  }
  .artifact-metric.danger {
    color: var(--color-status-error, #ef4444);
  }
  .artifact-metric.muted {
    color: var(--color-text-secondary, #888);
  }
  .diff-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }
  .diff-file {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-sm, 0.8125rem);
    color: var(--color-text-secondary, #aaa);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    background: var(--color-surface-raised, #1a1a1a);
    border-radius: var(--radius-sm, 0.375rem);
    border: 1px solid var(--color-border, #333);
  }
  .artifact-text {
    font-size: var(--font-size-sm, 0.8125rem);
    color: var(--color-text-primary, #eee);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    padding: var(--space-3, 0.75rem);
    background: var(--color-surface-raised, #1a1a1a);
    border-radius: var(--radius-md, 0.5rem);
    border: 1px solid var(--color-border, #333);
  }
  .log-output {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-sm, 0.8125rem);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    background: var(--color-surface-sunken, #111);
    color: var(--color-text-secondary, #ccc);
    padding: var(--space-4, 1rem);
    border-radius: var(--radius-md, 0.5rem);
    max-height: 600px;
    overflow-y: auto;
  }
  .trace-timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
    max-height: 600px;
    overflow-y: auto;
  }
  .trace-event {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border-left: 2px solid var(--color-border, #333);
    margin-left: var(--space-2, 0.5rem);
  }
  .trace-event + .trace-event {
    border-top: 1px solid color-mix(in srgb, var(--color-border, #333) 40%, transparent);
  }
  .trace-event--error {
    border-left-color: var(--color-status-error, #ef4444);
  }
  .trace-action {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }
  .trace-badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-family: var(--font-mono, monospace);
    padding: 0.1rem 0.35rem;
    border-radius: var(--radius-sm, 0.375rem);
    background: var(--color-surface-sunken, #111);
    color: var(--color-text-secondary, #aaa);
    white-space: nowrap;
  }
  .trace-badge.info {
    background: color-mix(in srgb, var(--color-accent, #60a5fa) 15%, transparent);
    color: var(--color-accent, #60a5fa);
  }
  .trace-badge.danger {
    background: color-mix(in srgb, var(--color-status-error, #ef4444) 15%, transparent);
    color: var(--color-status-error, #ef4444);
  }
  .trace-path {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-sm, 0.8125rem);
    color: var(--color-text-secondary, #888);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .trace-content {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    color: var(--color-text-secondary, #999);
    white-space: pre-wrap;
    word-break: break-all;
    padding-left: var(--space-2, 0.5rem);
  }
</style>
