<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Job activity</span>
    <div>
      <h1>Jobs</h1>
      <p>Track executor activity across all attached projects.</p>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">All jobs</div>
  <div class="card-body">
    {#if data.jobs.length === 0}
      <div class="empty-state">No jobs have been recorded yet.</div>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Mission</th>
              <th>Task</th>
              <th>Status</th>
              <th>Branch</th>
            </tr>
          </thead>
          <tbody>
            {#each data.jobs as entry}
              <tr>
                <td><a href={`/projects/${entry.projectId}`}>{entry.projectName}</a></td>
                <td>{entry.missionTitle}</td>
                <td>{entry.taskTitle}</td>
                <td><span class="pill">{entry.job.status}</span></td>
                <td class="mono">{entry.job.branchName}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</section>
