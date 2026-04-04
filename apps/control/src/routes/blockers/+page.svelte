<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  import Markdown from "$lib/ui/Markdown.svelte";
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Blocker queue</span>
    <div>
      <h1>Blockers</h1>
      <p>See where work is stuck and jump straight into the project that needs help.</p>
    </div>
  </div>
</section>

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Open now</div>
    <div class="metric-value">{data.blockers.filter((entry) => entry.blocker.status === "open").length}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Tracked blockers</div>
    <div class="metric-value">{data.blockers.length}</div>
  </div>
</section>

{#if form?.actionError}
  <section class="card" style="border-color: var(--color-status-error);">
    <div class="card-body">{form.actionError}</div>
  </section>
{/if}

<section class="card">
  <div class="card-header">All blockers</div>
  <div class="card-body">
    {#if data.blockers.length === 0}
      <div class="empty-state">No blockers are recorded right now.</div>
    {:else}
      <div class="stack">
        {#each data.blockers as entry}
          <article class="hero-card">
            <div class="page-header">
              <div class="stack">
                <div class="token-row">
                  <span class="pill {entry.blocker.status === 'open' ? 'warn' : 'success'}">{entry.blocker.status}</span>
                </div>
                <div>
                  <h2>{entry.blocker.title}</h2>
                  <p>{entry.projectName} · {entry.taskTitle}</p>
                </div>
              </div>
              <a class="btn secondary" href={`/projects/${entry.projectId}`}>Open project</a>
            </div>
            <div class="queue-meta">
              <div>
                <div class="metric-kicker">Task</div>
                <div>{entry.taskTitle}</div>
              </div>
              <div>
                <div class="metric-kicker">Recommendation</div>
                <Markdown content={entry.blocker.recommendation ?? "No recommendation recorded."} inline />
              </div>
            </div>
            <Markdown content={entry.blocker.context ?? ""} />
            {#if entry.blocker.status === "open"}
              <div class="token-row" style="margin-top: var(--space-3);">
                <form method="POST" action="?/resolve">
                  <input type="hidden" name="projectId" value={entry.projectId} />
                  <input type="hidden" name="blockerId" value={entry.blocker.id} />
                  <button class="btn primary" type="submit">Resolve</button>
                </form>
                <form method="POST" action="?/dismiss">
                  <input type="hidden" name="projectId" value={entry.projectId} />
                  <input type="hidden" name="blockerId" value={entry.blocker.id} />
                  <button class="btn secondary" type="submit">Dismiss</button>
                </form>
              </div>
            {/if}
          </article>
        {/each}
      </div>
    {/if}
  </div>
</section>
