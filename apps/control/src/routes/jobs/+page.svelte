<script lang="ts">
  import type { PageData } from "./$types";
  import { formatTimestamp, jobStatusPillClass } from "$lib/project-detail";
  import Markdown from "$lib/ui/Markdown.svelte";
  let { data }: { data: PageData } = $props();

  const runningJobs = $derived(data.jobs.filter((entry) => entry.job.status === "running"));
  const failedJobs = $derived(data.jobs.filter((entry) => entry.job.status === "failed"));
  const queuedJobs = $derived(data.jobs.filter((entry) => entry.job.status === "queued" || entry.job.status === "pending"));
</script>

{#if data.error}
  <section class="card" style="border-color: var(--color-status-error);">
    <div class="card-body">{data.error}</div>
  </section>
{/if}

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Job activity</span>
    <div>
      <h1>Jobs</h1>
      <p>See what is running, what failed, and where executor work needs attention next.</p>
    </div>
  </div>
</section>

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Running now</div>
    <div class="metric-value">{runningJobs.length}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Queued</div>
    <div class="metric-value">{queuedJobs.length}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Failed</div>
    <div class="metric-value">{failedJobs.length}</div>
  </div>
</section>

<section class="card">
  <div class="card-header">Executor queue</div>
  <div class="card-body">
    {#if data.jobs.length === 0}
      <div class="empty-state">No jobs have been recorded yet.</div>
    {:else}
      <div class="stack">
        {#each data.jobs as entry}
          <article class="hero-card">
            <div class="page-header">
              <div class="stack">
                <div class="token-row">
                  <span class="pill {jobStatusPillClass(entry.job.status)}">
                    {entry.job.status}
                  </span>
                  <span class="pill">{entry.job.executorType}</span>
                </div>
                <div>
                  <h2>{entry.taskTitle}</h2>
                  <p>{entry.projectName} · {entry.missionTitle}</p>
                </div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <a class="btn secondary" href={`/jobs/${entry.job.id}`}>View</a>
                <a class="btn secondary" href={`/projects/${entry.projectId}`}>Open project</a>
              </div>
            </div>
            <div class="queue-meta">
              <div>
                <div class="metric-kicker">Branch</div>
                <div class="mono">{entry.job.branchName}</div>
              </div>
              <div>
                <div class="metric-kicker">Started</div>
                <div>{formatTimestamp(entry.job.startedAt) || "Not started"}</div>
              </div>
              <div>
                <div class="metric-kicker">Completed</div>
                <div>{formatTimestamp(entry.job.completedAt) || "Still running"}</div>
              </div>
            </div>
            {#if entry.job.artifactSummary}
              <Markdown content={entry.job.artifactSummary} inline />
            {/if}
          </article>
        {/each}
      </div>
    {/if}
  </div>
</section>
