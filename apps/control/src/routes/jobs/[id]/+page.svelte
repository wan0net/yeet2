<script lang="ts">
  import type { PageData } from "./$types";
  import { formatTimestamp } from "$lib/project-detail";
  import Markdown from "$lib/ui/Markdown.svelte";
  let { data }: { data: PageData } = $props();
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

{#if data.job.artifactSummary}
<section class="card">
  <div class="card-header">Artifact summary</div>
  <div class="card-body">
    <Markdown content={data.job.artifactSummary} />
  </div>
</section>
{/if}

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

<style>
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
</style>
