<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Blocker queue</span>
    <div>
      <h1>Blockers</h1>
      <p>Review blockers across attached projects with open items at the top.</p>
    </div>
  </div>
</section>

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
            </div>
            <p>{entry.blocker.context}</p>
          </article>
        {/each}
      </div>
    {/if}
  </div>
</section>
