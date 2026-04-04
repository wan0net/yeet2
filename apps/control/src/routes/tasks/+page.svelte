<script lang="ts">
  import type { PageData } from "./$types";
  import Markdown from "$lib/ui/Markdown.svelte";
  let { data }: { data: PageData } = $props();

  function entryDispatchable(entry: PageData["tasks"][number]): boolean {
    return entry.task.dispatchable ?? false;
  }

  const blockedTasks = $derived(data.tasks.filter((entry) => entry.task.status === "blocked"));
  const activeTasks = $derived(data.tasks.filter((entry) => entry.task.status === "running" || entry.task.status === "in_progress"));
  const readyTasks = $derived(data.tasks.filter((entry) => entryDispatchable(entry)));
</script>

{#if data.error}
  <section class="card" style="border-color: var(--color-status-error);">
    <div class="card-body">{data.error}</div>
  </section>
{/if}

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Task queue</span>
    <div>
      <h1>Tasks</h1>
      <p>Scan the global work queue and jump to the projects where work is ready, running, or blocked.</p>
    </div>
  </div>
</section>

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Ready</div>
    <div class="metric-value">{readyTasks.length}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Running</div>
    <div class="metric-value">{activeTasks.length}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Blocked</div>
    <div class="metric-value">{blockedTasks.length}</div>
  </div>
</section>

<section class="card">
  <div class="card-header">Global task queue</div>
  <div class="card-body">
    {#if data.tasks.length === 0}
      <div class="empty-state">No tasks are available yet.</div>
    {:else}
      <div class="stack">
        {#each data.tasks as entry}
          <article class="hero-card">
            <div class="page-header">
              <div class="stack">
                <div class="token-row">
                  <span class={`pill ${entry.task.status === "blocked" ? "danger" : entry.task.status === "running" || entry.task.status === "in_progress" ? "info" : entryDispatchable(entry) ? "success" : "warn"}`}>{entry.task.status}</span>
                  <span class="pill">{entry.task.agentRole}</span>
                </div>
                <div>
                  <h2>{entry.task.title}</h2>
                  <p>{entry.projectName} · {entry.missionTitle}</p>
                </div>
              </div>
              <a class="btn secondary" href={`/projects/${entry.projectId}`}>Open project</a>
            </div>
            <div class="queue-meta">
              <div>
                <div class="metric-kicker">Priority</div>
                <div>{entry.task.priority}</div>
              </div>
              <div>
                <div class="metric-kicker">Attempts</div>
                <div>{entry.task.attempts}</div>
              </div>
              <div>
                <div class="metric-kicker">Dispatch</div>
                <div>{entry.task.dispatchable ? "Ready to dispatch" : entry.task.dispatchBlockedReason || "Waiting on previous step"}</div>
              </div>
            </div>
            <Markdown content={entry.task.description} />
          </article>
        {/each}
      </div>
    {/if}
  </div>
</section>
