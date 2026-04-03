<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
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
            </tr>
          </thead>
          <tbody>
            {#each data.missions as entry}
              <tr>
                <td><a href={`/projects/${entry.projectId}`}>{entry.projectName}</a></td>
                <td><a href={`/missions/${entry.mission.id}`}>{entry.mission.title}</a></td>
                <td><span class="pill">{entry.mission.status}</span></td>
                <td>{entry.mission.createdBy || "unknown"}</td>
                <td>{entry.mission.taskCount}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</section>
