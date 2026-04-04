<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  import { planningProvenanceLabel } from "$lib/projects";
  import { formatTimestamp } from "$lib/project-detail";
  import Markdown from "$lib/ui/Markdown.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Mission detail</span>
    <div>
      <h1>{data.mission.title}</h1>
      <p>{data.project.name}</p>
    </div>
  </div>
  <div class="action-row">
    <form method="POST">
      <button formaction="?/replan" type="submit" class="btn secondary">Re-plan</button>
    </form>
    <a class="btn secondary" href={`/projects/${data.project.id}`}>Back to project</a>
  </div>
</section>

{#if form && 'actionError' in form}
  <section class="card" style="border-color: var(--color-status-error);">
    <div class="card-body">{(form as Record<string, unknown>).actionError}</div>
  </section>
{/if}

<section class="split-grid">
  <div class="card">
    <div class="card-header">Mission</div>
    <div class="card-body stack">
      <div class="token-row">
        <span class="pill">{data.mission.status}</span>
        <span class="pill info">{planningProvenanceLabel(data.mission.planningProvenance)}</span>
      </div>
      <Markdown content={data.mission.objective} />
    </div>
  </div>
  <div class="card">
    <div class="card-header">Timing</div>
    <div class="card-body stack">
      <div>Started: {formatTimestamp(data.mission.startedAt) || "Unknown"}</div>
      <div>Completed: {formatTimestamp(data.mission.completedAt) || "Not completed"}</div>
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
            <th>Jobs</th>
          </tr>
        </thead>
        <tbody>
          {#each data.mission.tasks as task}
            <tr>
              <td>{task.title}</td>
              <td><span class="pill">{task.agentRole}</span></td>
              <td><span class="pill {task.status === 'blocked' ? 'danger' : task.status === 'complete' ? 'success' : task.status === 'running' || task.status === 'in_progress' ? 'info' : task.status === 'failed' ? 'warn' : ''}">{task.status}</span></td>
              <td>{task.attempts}</td>
              <td>
                {#each task.jobs as job}
                  <a class="btn secondary" href={`/jobs/${job.id}`}>View job</a>
                {/each}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>
