<script lang="ts">
  import type { PageData } from "./$types";
  import { planningProvenanceLabel } from "$lib/projects";

  let { data }: { data: PageData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Mission detail</span>
    <div>
      <h1>{data.mission.title}</h1>
      <p>{data.project.name}</p>
    </div>
  </div>
  <a class="btn secondary" href={`/projects/${data.project.id}`}>Back to project</a>
</section>

<section class="split-grid">
  <div class="card">
    <div class="card-header">Mission</div>
    <div class="card-body stack">
      <div class="token-row">
        <span class="pill">{data.mission.status}</span>
        <span class="pill info">{planningProvenanceLabel(data.mission.planningProvenance)}</span>
      </div>
      <p>{data.mission.objective}</p>
    </div>
  </div>
  <div class="card">
    <div class="card-header">Timing</div>
    <div class="card-body stack">
      <div>Started: {data.mission.startedAt || "Unknown"}</div>
      <div>Completed: {data.mission.completedAt || "Not completed"}</div>
      <div>Created by: {data.mission.createdBy || "unknown"}</div>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">Tasks</div>
  <div class="card-body">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Role</th>
            <th>Status</th>
            <th>Attempts</th>
          </tr>
        </thead>
        <tbody>
          {#each data.mission.tasks as task}
            <tr>
              <td>{task.title}</td>
              <td>{task.agentRole}</td>
              <td><span class="pill">{task.status}</span></td>
              <td>{task.attempts}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>
