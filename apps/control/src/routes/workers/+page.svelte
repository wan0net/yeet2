<script lang="ts">
  import type { PageData } from "./$types";
  import { workerStatusLabel } from "$lib/workers";

  let { data }: { data: PageData } = $props();

  const STALE_THRESHOLD_MS = 120_000; // 2 minutes

  function effectiveStatus(worker: Record<string, unknown>): string {
    const heartbeat = typeof worker.lastHeartbeatAt === "string" ? worker.lastHeartbeatAt : null;
    if (heartbeat && Date.now() - new Date(heartbeat).getTime() > STALE_THRESHOLD_MS) {
      return "stale";
    }
    return typeof worker.status === "string" ? worker.status : "unknown";
  }

  function statusPillClass(status: string): string {
    switch (status) {
      case "stale": return "pill warn";
      case "offline": return "pill muted";
      case "error": return "pill danger";
      case "busy":
      case "working": return "pill info";
      default: return "pill success";
    }
  }

  function statusLabel(status: string): string {
    if (status === "stale") return "Stale";
    return workerStatusLabel(status);
  }
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

{#if data.summary}
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
{/if}

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
              {@const eff = effectiveStatus(worker as Record<string, unknown>)}
              <tr>
                <td>{worker.name}</td>
                <td><span class="{statusPillClass(eff)}">{statusLabel(eff)}</span></td>
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
