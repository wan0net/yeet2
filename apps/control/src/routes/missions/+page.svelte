<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();

  const activeMissions = $derived(data.missions.filter((e) => e.mission.status === "active").length);
  const completedMissions = $derived(data.missions.filter((e) => e.mission.status === "complete").length);
  const totalTasks = $derived(data.missions.reduce((sum, e) => sum + e.mission.taskCount, 0));
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Mission queue</span>
    <div>
      <h1>Missions</h1>
      <p>Review planned, active, and completed missions across the control plane.</p>
    </div>
  </div>
</section>

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Active missions</div>
    <div class="metric-value">{activeMissions}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Completed missions</div>
    <div class="metric-value">{completedMissions}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Total tasks</div>
    <div class="metric-value">{totalTasks}</div>
  </div>
</section>

<section class="card">
  <div class="card-header">Global missions</div>
  <div class="card-body">
    {#if data.missions.length === 0}
      <div class="empty-state">No missions are available yet.</div>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Mission</th>
              <th>Status</th>
              <th>Created by</th>
              <th>Task count</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each data.missions as entry}
              <tr>
                <td><a href={`/projects/${entry.projectId}`}>{entry.projectName}</a></td>
                <td><a href={`/missions/${entry.mission.id}`}>{entry.mission.title}</a></td>
                <td><span class="pill {entry.mission.status === 'active' ? 'info' : entry.mission.status === 'complete' ? 'success' : ''}">{entry.mission.status}</span></td>
                <td>{entry.mission.createdBy || "unknown"}</td>
                <td>{entry.mission.taskCount}</td>
                <td><a class="btn secondary" href={`/missions/${entry.mission.id}`}>View</a></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</section>
