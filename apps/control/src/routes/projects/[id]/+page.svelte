<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import {
    activeMission,
    agentPresenceOverview,
    recentJobs,
    sortBlockers,
    groupTasksByState,
    formatTimestamp
  } from "$lib/project-detail";
  import { formatConstitutionFiles, planningProvenanceLabel, projectModelCostSummary } from "$lib/projects";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const project = $derived(data.project);
  const mission = $derived(activeMission(project));
  const blockers = $derived(sortBlockers(project.blockers));
  const jobs = $derived(recentJobs(project).slice(0, 6));
  const taskGroups = $derived(groupTasksByState(project));
  const staffOverview = $derived(agentPresenceOverview(project));
  const staff = $derived(staffOverview.roles);

  function roleConfiguredModel(definitionId: string | null): string {
    if (!definitionId) return "Default";
    const role = project.roleDefinitions.find((entry) => entry.id === definitionId);
    return role?.model || "Default";
  }

  function roleStatusCopy(status: string): string {
    if (status === "active") return "On stage";
    if (status === "blocked") return "Needs help";
    if (status === "queued") return "Queued up";
    return "Standing by";
  }
</script>

<section class="hero-card">
  <div class="page-header">
    <div class="stack">
      <div class="token-row">
        <span class="eyebrow">Project detail</span>
        <span class="pill">{project.constitutionStatus}</span>
        <span class="pill info">{project.autonomy.mode}</span>
      </div>
      <div>
        <h1>{project.name}</h1>
        <p>{project.repoUrl || project.localPath}</p>
      </div>
    </div>
    <div class="token-row">
      <form method="POST">
        <button formaction="?/plan" type="submit">Plan</button>
      </form>
      <form method="POST">
        <button formaction="?/run" type="submit">Run now</button>
      </form>
      <a class="btn secondary" href="/projects">Back</a>
    </div>
  </div>
</section>

{#if form?.actionError}
  <div class="pill danger">{form.actionError}</div>
{/if}

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Active missions</div>
    <div class="metric-value">{project.activeMissionCount || 0}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Active tasks</div>
    <div class="metric-value">{project.activeTaskCount || 0}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Blockers</div>
    <div class="metric-value">{project.blockerCount || 0}</div>
  </div>
</section>

<section class="split-grid">
  <div class="card">
    <div class="card-header">Repository</div>
    <div class="card-body stack">
      <div><strong>Repo:</strong> {project.repoUrl || "—"}</div>
      <div><strong>Local path:</strong> {project.localPath || "—"}</div>
      <div><strong>Default branch:</strong> {project.defaultBranch || "—"}</div>
      <div><strong>Constitution:</strong> {formatConstitutionFiles(project.constitution.files ?? undefined)}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Autonomy</div>
    <div class="card-body stack">
      <p>Current mode: <strong>{project.autonomy.mode}</strong></p>
      <div class="token-row">
        <form method="POST">
          <input name="autonomyMode" type="hidden" value="manual" />
          <button class="secondary" formaction="?/autonomy" type="submit">Stop AI</button>
        </form>
        <form method="POST">
          <input name="autonomyMode" type="hidden" value="supervised" />
          <button class="secondary" formaction="?/autonomy" type="submit">Supervised</button>
        </form>
        <form method="POST">
          <input name="autonomyMode" type="hidden" value="autonomous" />
          <button formaction="?/autonomy" type="submit">Start AI</button>
        </form>
      </div>
      <p>Last run: {formatTimestamp(project.autonomy.lastRunAt) || "Unknown"}</p>
      <p class="muted">{project.autonomy.lastRunMessage || "No recent autonomy message."}</p>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">Mission</div>
  <div class="card-body">
    {#if mission}
      <div class="stack">
        <div class="token-row">
          <span class="pill">{mission.status}</span>
          <span class="pill info">{planningProvenanceLabel(mission.planningProvenance)}</span>
        </div>
        <div>
          <h2>{mission.title}</h2>
          <p>{mission.objective}</p>
        </div>
      </div>
    {:else}
      <div class="empty-state">No active mission yet.</div>
    {/if}
  </div>
</section>

<section class="card">
  <div class="card-header">Tasks by state</div>
  <div class="card-body">
    <div class="split-grid">
      {#each taskGroups as group}
        <div class="hero-card">
          <div class="token-row">
            <span class="pill">{group.state}</span>
          </div>
          <div class="stack" style="margin-top: 12px;">
            {#if group.tasks.length === 0}
              <div class="muted">No tasks in this state.</div>
            {:else}
              {#each group.tasks as entry}
                <div>
                  <strong>{entry.task.title}</strong>
                  <div class="muted">{entry.task.agentRole} · {entry.task.status}</div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<section class="split-grid">
  <div class="card">
    <div class="card-header">Team</div>
    <div class="card-body stack">
      {#each staff as role}
        <div class="hero-card">
          <div class="page-header">
            <div>
              <strong>{role.label}</strong>
              <div class="muted">{role.status}</div>
            </div>
            <span class="pill">{roleConfiguredModel(role.id)}</span>
          </div>
          <div class="muted">{roleStatusCopy(role.status)}</div>
        </div>
      {/each}
    </div>
  </div>

  <div class="card">
    <div class="card-header">Cost analysis</div>
    <div class="card-body stack">
      {#each project.roleDefinitions.filter((entry) => entry.enabled) as role}
        <div class="hero-card">
          <strong>{role.visualName}</strong>
          <div class="muted">{role.model || "Recommended default"}</div>
          <div class="muted">
            {projectModelCostSummary(data.modelCatalog.find((entry) => entry.value === role.model) || null) || "No published pricing available."}
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<section class="split-grid">
  <div class="card">
    <div class="card-header">Recent jobs</div>
    <div class="card-body stack">
      {#if jobs.length === 0}
        <div class="empty-state">No jobs recorded yet.</div>
      {:else}
        {#each jobs as entry}
          <div class="hero-card">
            <strong>{entry.job.branchName}</strong>
            <div class="muted">{entry.job.status} · {entry.job.executorType}</div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <div class="card">
    <div class="card-header">Blockers</div>
    <div class="card-body stack">
      {#if blockers.length === 0}
        <div class="empty-state">No blockers are open.</div>
      {:else}
        {#each blockers as blocker}
          <div class="hero-card">
            <div class="token-row">
              <span class="pill {blocker.status === 'open' ? 'warn' : 'success'}">{blocker.status}</span>
            </div>
            <strong>{blocker.title}</strong>
            <div class="muted">{blocker.context}</div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">Team chat</div>
  <div class="card-body stack">
    <form class="stack" method="POST">
      <label>
        Message
        <textarea name="content" placeholder="Add operator guidance or @reply to a teammate."></textarea>
      </label>
      <div class="token-row">
        <button formaction="?/message" type="submit">Post to team chat</button>
      </div>
    </form>

    {#if project.decisionLogs.length === 0}
      <div class="empty-state">No workflow chat yet.</div>
    {:else}
      {#each project.decisionLogs as entry}
        <div class="hero-card">
          <div class="page-header">
            <strong>{entry.actor || "system"}</strong>
            <span class="pill">{entry.eventType}</span>
          </div>
          <div>{entry.summary || entry.title}</div>
        </div>
      {/each}
    {/if}
  </div>
</section>
