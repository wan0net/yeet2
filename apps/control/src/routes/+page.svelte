<script lang="ts">
  import type { PageData } from "./$types";
  import { activeMission, formatTimestamp } from "$lib/project-detail";
  import type { ProjectRecord } from "$lib/projects";

  let { data }: { data: PageData } = $props();

  type ApprovalEntry = {
    projectName: string;
    taskTitle: string;
  };

  const approvals = $derived((data.approvals ?? []) as ApprovalEntry[]);
  const urgentProjects = $derived(
    ([...(data.projects as ProjectRecord[])])
      .sort((left, right) => {
        const blockerDelta = (right.blockerCount || 0) - (left.blockerCount || 0);
        if (blockerDelta !== 0) return blockerDelta;
        const taskDelta = (right.activeTaskCount || 0) - (left.activeTaskCount || 0);
        if (taskDelta !== 0) return taskDelta;
        return left.name.localeCompare(right.name);
      })
      .slice(0, 4)
  );

  const agents = $derived(data.agents ?? []);
</script>

{#if data.error}
  <section class="card" style="border-color: var(--color-status-error);">
    <div class="card-body">{data.error}</div>
  </section>
{/if}

<div class="page-header">
  <div class="stack">
    <span class="eyebrow">Control plane</span>
    <div>
      <h1>Mission Control</h1>
      <p>Factory status at a glance</p>
    </div>
  </div>
  <div class="token-row">
    <a class="btn" href="/approvals">Review approvals</a>
    <a class="btn secondary" href="/blockers">Inspect blockers</a>
    <a class="btn secondary" href="/projects/new">Add project</a>
    <a class="btn secondary" href="/projects">Open projects</a>
    <a class="btn secondary" href="/guide">Get started</a>
  </div>
</div>

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Projects</div>
    <div class="metric-value">{data.overview.totals.projects}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Active missions</div>
    <div class="metric-value">{data.overview.totals.activeMissions}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Running jobs</div>
    <div class="metric-value">{data.overview.totals.runningJobs}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Open blockers</div>
    <div class="metric-value">{data.overview.totals.openBlockers}</div>
  </div>
</section>

{#if agents.length === 0}
  <section class="card">
    <div class="card-body">
      <div class="empty-state">
        <p>No agents configured yet. <a href="/projects/new">Add a project</a> to get started.</p>
      </div>
    </div>
  </section>
{:else}
  <section class="mission-control">
    {#each agents as agent}
      <a class="agent-card {agent.status}" href={`/projects/${agent.projectId}`}>
        <div class="agent-character">{agent.characterName}</div>
        <div class="agent-project">{agent.projectName}</div>
        {#if agent.currentTask}
          <div class="agent-task">{agent.currentTask}</div>
        {/if}
        <span class="pill {agent.status === 'working' ? 'info' : agent.status === 'blocked' ? 'danger' : agent.status === 'complete' ? 'success' : ''}">{agent.status}</span>
      </a>
    {/each}
  </section>
{/if}

<section class="card">
  <div class="card-header">Needs attention now</div>
  <div class="card-body">
    <div class="split-grid">
      <div class="hero-card">
        <div class="page-header">
          <div>
            <div class="metric-kicker">Approvals</div>
            <h2>{approvals.length > 0 ? `${approvals.length} waiting` : "Nothing waiting"}</h2>
          </div>
          <a class="btn secondary" href="/approvals">Open</a>
        </div>
        <p>
          {#if approvals[0]}
            {approvals[0].projectName} · {approvals[0].taskTitle}
          {:else}
            No human-gated approvals are blocking the line right now.
          {/if}
        </p>
      </div>

      <div class="hero-card">
        <div class="page-header">
          <div>
            <div class="metric-kicker">Open blockers</div>
            <h2>{data.blockers.filter((entry) => entry.blocker.status === "open").length} active</h2>
          </div>
          <a class="btn secondary" href="/blockers">Open</a>
        </div>
        <p>
          {#if data.blockers[0]}
            {data.blockers[0].projectName} · {data.blockers[0].blocker.title}
          {:else}
            No active blockers are open across the fleet.
          {/if}
        </p>
      </div>

      <div class="hero-card">
        <div class="page-header">
          <div>
            <div class="metric-kicker">Workers</div>
            <h2>{data.overview.workers.availableWorkers} available</h2>
          </div>
          <a class="btn secondary" href="/workers">Open</a>
        </div>
        <p>
          Healthy workers: {data.overview.workers.healthyWorkers}. Busy workers: {data.overview.workers.busyWorkers}. Stale workers: {data.overview.workers.staleWorkers}.
        </p>
      </div>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">Projects to watch</div>
  <div class="card-body">
    {#if urgentProjects.length === 0}
      <div class="empty-state">No projects registered yet.</div>
    {:else}
      <div class="stack">
        {#each urgentProjects as project}
          <article class="hero-card">
            <div class="page-header">
              <div class="stack">
                <div class="token-row">
                  <span class="pill">{project.autonomy.mode}</span>
                  {#if project.nextDispatchableTaskRole}
                    <span class="pill info">next {project.nextDispatchableTaskRole}</span>
                  {/if}
                  {#if project.blockerCount}
                    <span class="pill warn">{project.blockerCount} blockers</span>
                  {/if}
                </div>
                <div>
                  <h2>{project.name}</h2>
                  <p>{activeMission(project)?.title || "No active mission"}</p>
                </div>
              </div>
              <a class="btn secondary" href={`/projects/${project.id}`}>Open project</a>
            </div>
            <div class="split-grid compact-grid">
              <div>
                <div class="metric-kicker">Next action</div>
                <div>{project.nextDispatchableTaskRole || "Waiting on loop"}</div>
              </div>
              <div>
                <div class="metric-kicker">Active tasks</div>
                <div>{project.activeTaskCount || 0}</div>
              </div>
              <div>
                <div class="metric-kicker">Last autonomy run</div>
                <div>{formatTimestamp(project.autonomy.lastRunAt) || "Never"}</div>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </div>
</section>

<section class="card">
  <div class="card-header">Control plane overview</div>
  <div class="card-body">
    <div class="split-grid">
      <div class="stack">
        <div class="pill {data.overview.auth.enabled ? 'info' : 'success'}">
          Auth {data.overview.auth.mode}
        </div>
        <p>
          The hosted yeet2 instance tracks projects, jobs, missions, approvals, blockers, and workers through the same API-first control plane.
        </p>
      </div>
      <div class="stack">
        <div class="pill {data.overview.workers.availableWorkers > 0 ? 'success' : 'warn'}">
          Available workers {data.overview.workers.availableWorkers}
        </div>
        <p>
          Queued jobs: {data.overview.totals.queuedJobs}. Running jobs: {data.overview.totals.runningJobs}. Failed jobs: {data.overview.totals.failedJobs}.
        </p>
      </div>
    </div>
  </div>
</section>

<style>
  .mission-control {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--space-3);
  }

  .agent-card {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .agent-card:hover {
    border-color: var(--color-accent);
  }

  .agent-card.working {
    border-left: 3px solid var(--color-accent);
    animation: pulse 2s ease-in-out infinite;
  }

  .agent-card.blocked {
    border-left: 3px solid var(--color-status-error);
  }

  .agent-card.complete {
    border-left: 3px solid var(--color-status-success);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.85; }
  }

  .agent-character {
    font-weight: 600;
    font-size: var(--font-size-sm);
  }

  .agent-project {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .agent-task {
    font-size: 0.8rem;
    margin-top: var(--space-1);
    color: var(--color-text-primary);
  }
</style>
