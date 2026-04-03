<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Task queue</span>
    <div>
      <h1>Tasks</h1>
      <p>Inspect queued, active, and blocked work across every project.</p>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">Global task queue</div>
  <div class="card-body">
    {#if data.tasks.length === 0}
      <div class="empty-state">No tasks are available yet.</div>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Mission</th>
              <th>Task</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {#each data.tasks as entry}
              <tr>
                <td><a href={`/projects/${entry.projectId}`}>{entry.projectName}</a></td>
                <td>{entry.missionTitle}</td>
                <td>{entry.task.title}</td>
                <td>{entry.task.agentRole}</td>
                <td><span class="pill">{entry.task.status}</span></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</section>
