<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Worker registry</span>
    <div>
      <h1>Workers</h1>
      <p>Inspect executors, capability sets, and lease posture from the fabric layer.</p>
    </div>
  </div>
</section>

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Total workers</div>
    <div class="metric-value">{data.summary.totalWorkers}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Healthy workers</div>
    <div class="metric-value">{data.summary.healthyWorkers}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Available workers</div>
    <div class="metric-value">{data.summary.availableWorkers}</div>
  </div>
</section>

<section class="card">
  <div class="card-header">Registered workers</div>
  <div class="card-body">
    {#if data.workers.length === 0}
      <div class="empty-state">No workers are registered yet.</div>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Executor</th>
              <th>Capabilities</th>
            </tr>
          </thead>
          <tbody>
            {#each data.workers as worker}
              <tr>
                <td>{worker.name}</td>
                <td><span class="pill">{worker.status}</span></td>
                <td>{worker.executorType}</td>
                <td>{Array.isArray(worker.capabilities) ? worker.capabilities.join(", ") : ""}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</section>
