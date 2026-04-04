<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Approvals</span>
    <div>
      <h1>Approvals</h1>
      <p>Review the human decisions currently holding work at the gate.</p>
    </div>
  </div>
</section>

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Waiting now</div>
    <div class="metric-value">{data.approvals.filter((approval) => approval.blockerStatus === "open").length}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Total tracked</div>
    <div class="metric-value">{data.approvals.length}</div>
  </div>
</section>

{#if form?.actionError}
  <section class="card" style="border-color: var(--color-status-error);">
    <div class="card-body">{form.actionError}</div>
  </section>
{/if}

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
                  <span class="pill">{approval.taskAgentRole}</span>
                </div>
                <div>
                  <h2>{approval.blockerTitle}</h2>
                  <p>{approval.projectName} · {approval.taskTitle}</p>
                </div>
              </div>
              <a class="btn secondary" href={`/projects/${approval.projectId}`}>Open project</a>
            </div>
            <div class="queue-meta">
              <div>
                <div class="metric-kicker">Mission</div>
                <div>{approval.missionTitle}</div>
              </div>
              <div>
                <div class="metric-kicker">Recommendation</div>
                <div>{approval.blockerRecommendation || "No recommendation recorded."}</div>
              </div>
            </div>
            <p>{approval.blockerContext}</p>
            {#if approval.blockerStatus === "open"}
              <div class="token-row" style="margin-top: var(--space-3);">
                <form method="POST" action="?/approve">
                  <input type="hidden" name="projectId" value={approval.projectId} />
                  <input type="hidden" name="blockerId" value={approval.blockerId} />
                  <button class="btn primary" type="submit">Approve</button>
                </form>
                <form method="POST" action="?/reject">
                  <input type="hidden" name="projectId" value={approval.projectId} />
                  <input type="hidden" name="blockerId" value={approval.blockerId} />
                  <button class="btn secondary" type="submit">Reject</button>
                </form>
              </div>
            {/if}
          </article>
        {/each}
      </div>
    {/if}
  </div>
</section>
