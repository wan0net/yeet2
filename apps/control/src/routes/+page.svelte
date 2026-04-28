<script lang="ts">
  import type { PageData } from "./$types";
  import { activeMission, formatTimestamp } from "$lib/project-detail";
  import type { ProjectRecord } from "$lib/projects";

  let { data }: { data: PageData } = $props();

  type ApprovalEntry = {
    projectName: string;
    taskTitle: string;
    blockerTitle?: string;
    taskAgentRole?: string;
  };

  const approvals = $derived((data.approvals ?? []) as ApprovalEntry[]);
  const projects = $derived(data.projects as ProjectRecord[]);
  const agents = $derived(data.agents ?? []);
  const activeAgents = $derived(agents.filter((agent) => agent.status === "working" || agent.status === "queued"));
  const blockedAgents = $derived(agents.filter((agent) => agent.status === "blocked"));
  const activeTasks = $derived(data.tasks.filter((entry) => entry.task.status === "running" || entry.task.status === "in_progress"));
  const readyTasks = $derived(data.tasks.filter((entry) => entry.task.dispatchable));
  const runningJobs = $derived(data.jobs.filter((entry) => entry.job.status === "running" || entry.job.status === "in_progress"));
  const openBlockers = $derived(data.blockers.filter((entry) => entry.blocker.status === "open"));
  const openTickets = $derived(approvals.length + openBlockers.length + activeTasks.length + readyTasks.length);
  const urgentProjects = $derived(
    [...projects]
      .sort((left, right) => {
        const blockerDelta = (right.blockerCount || 0) - (left.blockerCount || 0);
        if (blockerDelta !== 0) return blockerDelta;
        const taskDelta = (right.activeTaskCount || 0) - (left.activeTaskCount || 0);
        if (taskDelta !== 0) return taskDelta;
        return left.name.localeCompare(right.name);
      })
      .slice(0, 4)
  );
  const leadTicket = $derived(
    approvals[0]
      ? {
          label: "approval",
          title: approvals[0].blockerTitle || "Human review required",
          subtitle: `${approvals[0].projectName} · ${approvals[0].taskTitle || approvals[0].taskAgentRole || "operator decision"}`,
          href: "/approvals"
        }
      : openBlockers[0]
        ? {
            label: "blocker",
            title: openBlockers[0].blocker.title,
            subtitle: `${openBlockers[0].projectName} · ${openBlockers[0].taskTitle}`,
            href: "/blockers"
          }
        : activeTasks[0]
          ? {
              label: "active task",
              title: activeTasks[0].task.title,
              subtitle: `${activeTasks[0].projectName} · ${activeTasks[0].task.agentRole}`,
              href: `/projects/${activeTasks[0].projectId}`
            }
          : null
  );
</script>

{#if data.error}
  <section class="card" style="border-color: var(--color-status-error);">
    <div class="card-body">{data.error}</div>
  </section>
{/if}

<section class="company-hero">
  <div class="company-hero__copy">
    <span class="eyebrow">Autonomous software company</span>
    <h1>Run the team, not the tabs.</h1>
    <p>
      Track every agent, ticket, blocker, approval, and execution trace from one command surface.
    </p>
    <div class="token-row">
      <a class="btn" href="/tickets">Open tickets</a>
      <a class="btn secondary" href="/projects/new">Add project</a>
      <a class="btn secondary" href="/settings">Configure agents</a>
    </div>
  </div>
  <div class="company-hero__panel">
    <div class="metric-kicker">Current board item</div>
    {#if leadTicket}
      <div class="lead-ticket">
        <span class="pill purple">{leadTicket.label}</span>
        <h2>{leadTicket.title}</h2>
        <p>{leadTicket.subtitle}</p>
        <a class="btn secondary" href={leadTicket.href}>Review</a>
      </div>
    {:else}
      <div class="lead-ticket">
        <span class="pill success">clear</span>
        <h2>No human decision waiting</h2>
        <p>The active company queue has no urgent approval or blocker.</p>
        <a class="btn secondary" href="/tickets">View queue</a>
      </div>
    {/if}
  </div>
</section>

<section class="metrics">
  <a class="metric metric-link" href="/projects">
    <div class="metric-kicker">Companies / projects</div>
    <div class="metric-value">{data.overview.totals.projects}</div>
  </a>
  <a class="metric metric-link" href="/tickets">
    <div class="metric-kicker">Open tickets</div>
    <div class="metric-value">{openTickets}</div>
  </a>
  <a class="metric metric-link" href="/workers">
    <div class="metric-kicker">Available agents</div>
    <div class="metric-value">{data.overview.workers.availableWorkers}</div>
  </a>
  <a class="metric metric-link" href="/jobs">
    <div class="metric-kicker">Running jobs</div>
    <div class="metric-value">{runningJobs.length || data.overview.totals.runningJobs}</div>
  </a>
</section>

<section class="ops-grid">
  <article class="card company-card">
    <div class="card-header">Agent roster</div>
    <div class="card-body">
      {#if agents.length === 0}
        <div class="empty-state">No agents configured yet. Add a project to hire the first team.</div>
      {:else}
        <div class="agent-roster">
          {#each agents.slice(0, 12) as agent}
            <a class="agent-row" href={`/projects/${agent.projectId}`}>
              <span class="agent-avatar">{agent.characterName.slice(0, 1)}</span>
              <span class="agent-row__body">
                <strong>{agent.characterName}</strong>
                <small>{agent.projectName} · {agent.roleKey}</small>
                {#if agent.currentTask}
                  <span>{agent.currentTask}</span>
                {/if}
              </span>
              <span class="pill {agent.status === 'working' ? 'info' : agent.status === 'blocked' ? 'danger' : agent.status === 'complete' ? 'success' : agent.status === 'queued' ? 'warn' : ''}">{agent.status}</span>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </article>

  <article class="card company-card">
    <div class="card-header">Ticket pressure</div>
    <div class="card-body stack">
      <a class="pressure-row" href="/approvals">
        <span>Approvals</span>
        <strong>{approvals.length}</strong>
      </a>
      <a class="pressure-row" href="/blockers">
        <span>Blockers</span>
        <strong>{openBlockers.length}</strong>
      </a>
      <a class="pressure-row" href="/tasks">
        <span>Ready tasks</span>
        <strong>{readyTasks.length}</strong>
      </a>
      <a class="pressure-row" href="/jobs">
        <span>Running jobs</span>
        <strong>{runningJobs.length}</strong>
      </a>
      <div class="budget-card">
        <div class="metric-kicker">Governance mode</div>
        <p>Approvals, blockers, and merge gates remain enforced by yeet2 while the UI behaves like an agent company dashboard.</p>
      </div>
    </div>
  </article>
</section>

<section class="card">
  <div class="card-header">Projects to watch</div>
  <div class="card-body">
    {#if urgentProjects.length === 0}
      <div class="empty-state">No projects registered yet.</div>
    {:else}
      <div class="project-company-grid">
        {#each urgentProjects as project}
          <article class="hero-card project-company-card">
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
              <a class="btn secondary" href={`/projects/${project.id}`}>Open</a>
            </div>
            <div class="queue-meta">
              <div>
                <div class="metric-kicker">Next action</div>
                <div>{project.nextDispatchableTaskRole || "Waiting on loop"}</div>
              </div>
              <div>
                <div class="metric-kicker">Active tasks</div>
                <div>{project.activeTaskCount || 0}</div>
              </div>
              <div>
                <div class="metric-kicker">Last run</div>
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
  <div class="card-header">Live operating model</div>
  <div class="card-body">
    <div class="split-grid">
      <div class="stack">
        <span class="pill {activeAgents.length > 0 ? 'info' : 'success'}">{activeAgents.length} active agents</span>
        <p>Agents are represented as persistent staff with current tickets, project context, model selection, and execution status.</p>
      </div>
      <div class="stack">
        <span class="pill {blockedAgents.length > 0 ? 'danger' : 'success'}">{blockedAgents.length} blocked agents</span>
        <p>Blocked work is promoted into the ticket queue so the operator can resolve or dismiss it from a single surface.</p>
      </div>
      <div class="stack">
        <span class="pill {data.overview.auth.enabled ? 'info' : 'success'}">Auth {data.overview.auth.mode}</span>
        <p>Projects, jobs, missions, approvals, blockers, and workers still flow through the same API-first control plane.</p>
      </div>
    </div>
  </div>
</section>
