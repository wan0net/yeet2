<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Approvals</span>
    <div>
      <h1>Approvals</h1>
      <p>Review human-gated approvals that were raised as blockers.</p>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">Approval queue</div>
  <div class="card-body">
    {#if data.approvals.length === 0}
      <div class="empty-state">No approvals are open right now.</div>
    {:else}
      <div class="stack">
        {#each data.approvals as approval}
          <article class="hero-card">
            <div class="page-header">
              <div class="stack">
                <div class="token-row">
                  <span class="pill {approval.blockerStatus === 'open' ? 'warn' : 'success'}">{approval.blockerStatus}</span>
                </div>
                <div>
                  <h2>{approval.blockerTitle}</h2>
                  <p>{approval.projectName} · {approval.taskTitle}</p>
                </div>
              </div>
              <a class="btn secondary" href={`/projects/${approval.projectId}`}>Open project</a>
            </div>
            <p>{approval.blockerContext}</p>
          </article>
        {/each}
      </div>
    {/if}
  </div>
</section>
