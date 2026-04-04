<script lang="ts">
  import { page } from "$app/state";
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
  const nextTask = $derived(project.missions.flatMap((entry) => entry.tasks).find((task) => task.id === project.nextDispatchableTaskId) ?? null);
  const currentTab = $derived((() => {
    const tab = page.url.searchParams.get("tab")?.trim().toLowerCase();
    return tab === "agents" || tab === "chat" ? tab : "overview";
  })());
  const chatEntries = $derived(
    [
      ...project.decisionLogs.map((entry) => ({
        id: `decision-${entry.id}`,
        actor: entry.actor || "system",
        kind: entry.eventType || "workflow",
        summary: entry.summary || entry.title,
        createdAt: entry.createdAt,
        tone: "info"
      })),
      ...project.operatorGuidance.map((entry) => ({
        id: `guidance-${entry.id}`,
        actor: entry.actor || "operator",
        kind: entry.mentions.length > 0 ? `mentions ${entry.mentions.map((mention) => `@${mention}`).join(" ")}` : "operator note",
        summary: entry.content,
        createdAt: entry.createdAt,
        tone: "success"
      }))
    ].sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || ""))
  );

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

  function tabHref(tab: "overview" | "agents" | "chat"): string {
    return tab === "overview" ? `/projects/${project.id}` : `/projects/${project.id}?tab=${tab}`;
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
        <input name="returnTab" type="hidden" value={currentTab} />
        <button formaction="?/plan" type="submit">Plan</button>
      </form>
      <form method="POST">
        <input name="returnTab" type="hidden" value={currentTab} />
        <button formaction="?/run" type="submit">Run now</button>
      </form>
      <a class="btn secondary" href="/projects">Back</a>
    </div>
  </div>
</section>

{#if form?.actionError}
  <div class="pill danger">{form.actionError}</div>
{/if}

<section class="project-tabs">
  <a aria-current={currentTab === "overview" ? "page" : undefined} class:project-tab--active={currentTab === "overview"} class="project-tab" href={tabHref("overview")}>
    Overview
  </a>
  <a aria-current={currentTab === "agents" ? "page" : undefined} class:project-tab--active={currentTab === "agents"} class="project-tab" href={tabHref("agents")}>
    Agents
  </a>
  <a aria-current={currentTab === "chat" ? "page" : undefined} class:project-tab--active={currentTab === "chat"} class="project-tab" href={tabHref("chat")}>
    Chat
  </a>
</section>

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Autonomy</div>
    <div class="metric-value metric-value--compact">{project.autonomy.mode}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Next action</div>
    <div class="metric-value metric-value--compact">{project.nextDispatchableTaskRole || "Waiting"}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Blockers</div>
    <div class="metric-value">{project.blockerCount || 0}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Running scope</div>
    <div class="metric-value">{project.activeTaskCount || 0}</div>
  </div>
</section>

{#if currentTab === "overview"}
<section class="split-grid">
  <div class="card">
    <div class="card-header">Operate</div>
    <div class="card-body stack">
      <div class="stack">
        <div class="metric-kicker">What needs attention</div>
        {#if nextTask}
          <div>
            <strong>{nextTask.title}</strong>
            <div class="muted">{nextTask.agentRole} · {nextTask.status}</div>
          </div>
        {:else if blockers[0]}
          <div>
            <strong>{blockers[0].title}</strong>
            <div class="muted">Open blocker</div>
          </div>
        {:else}
          <div>
            <strong>No immediate action queued.</strong>
            <div class="muted">Run planning or wait for the autonomy loop.</div>
          </div>
        {/if}
      </div>
      <div class="token-row">
        <form method="POST">
          <input name="returnTab" type="hidden" value="overview" />
          <input name="autonomyMode" type="hidden" value="manual" />
          <button class="secondary" formaction="?/autonomy" type="submit">Stop AI</button>
        </form>
        <form method="POST">
          <input name="returnTab" type="hidden" value="overview" />
          <input name="autonomyMode" type="hidden" value="supervised" />
          <button class="secondary" formaction="?/autonomy" type="submit">Supervised</button>
        </form>
        <form method="POST">
          <input name="returnTab" type="hidden" value="overview" />
          <input name="autonomyMode" type="hidden" value="autonomous" />
          <button formaction="?/autonomy" type="submit">Start AI</button>
        </form>
      </div>
      <div class="muted">Last run: {formatTimestamp(project.autonomy.lastRunAt) || "Unknown"}</div>
      <div class="muted">{project.autonomy.lastRunMessage || "No recent autonomy message."}</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">Project facts</div>
    <div class="card-body stack">
      <div><strong>Repo:</strong> {project.repoUrl || "—"}</div>
      <div><strong>Local path:</strong> {project.localPath || "—"}</div>
      <div><strong>Default branch:</strong> {project.defaultBranch || "—"}</div>
      <div>
        <strong>Constitution:</strong> {formatConstitutionFiles(project.constitution.files ?? undefined)}
        {#if project.constitution.files}
          <div class="token-row" style="margin-top: var(--space-2); flex-wrap: wrap; gap: var(--space-1);">
            {#each Object.entries(project.constitution.files) as [name, present]}
              <span class="pill {present ? 'success' : 'muted'}">{name}</span>
            {/each}
          </div>
        {/if}
        {#if project.constitution.missingRequiredFiles && project.constitution.missingRequiredFiles.length > 0}
          <div class="muted" style="margin-top: var(--space-1);">Missing required: {project.constitution.missingRequiredFiles.join(", ")}</div>
        {/if}
        {#if project.constitution.inspectedAt}
          <div class="muted" style="margin-top: var(--space-1);">Inspected: {formatTimestamp(project.constitution.inspectedAt)}</div>
        {/if}
      </div>
      <div><strong>Planner source:</strong> {mission ? planningProvenanceLabel(mission.planningProvenance) : "No mission yet"}</div>
    </div>
  </div>
</section>
{/if}

{#if currentTab === "overview"}
<section class="card">
  <div class="card-header">Current mission</div>
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
{/if}

{#if currentTab === "overview"}
<section class="card">
  <div class="card-header">Task lanes</div>
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
{/if}

{#if currentTab === "overview" || currentTab === "agents"}
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
    <div class="card-header">Model cost analysis</div>
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
{/if}

{#if currentTab === "overview"}
<section class="split-grid">
  <div class="card">
    <div class="card-header">Recent jobs</div>
    <div class="card-body stack">
      {#if jobs.length === 0}
        <div class="empty-state">No jobs recorded yet.</div>
      {:else}
        {#each jobs as entry}
          <a class="hero-card" href={`/jobs/${entry.job.id}`} style="text-decoration: none; color: inherit;">
            <strong>{entry.job.branchName}</strong>
            <div class="muted">{entry.job.status} · {entry.job.executorType}</div>
          </a>
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
{/if}

{#if currentTab === "chat"}
<section class="card">
  <div class="card-header">Team chat</div>
  <div class="card-body stack">
    <form class="stack" method="POST">
      <label>
        Message
        <textarea name="content" placeholder="Add operator guidance or @reply to a teammate."></textarea>
      </label>
      <div class="token-row">
        <input name="returnTab" type="hidden" value="chat" />
        <button formaction="?/message" type="submit">Post to team chat</button>
      </div>
    </form>

    <div class="hero-card">
      <strong>How this thread works</strong>
      <div class="muted">
        Agents can post working updates while they are active, then hand off with `@mentions` when it is the next role's turn. Operators can reply in the same trail.
      </div>
    </div>

    {#if chatEntries.length === 0}
      <div class="empty-state">No workflow chat yet.</div>
    {:else}
      {#each chatEntries as entry}
        <div class="hero-card">
          <div class="page-header">
            <strong>{entry.actor}</strong>
            <div class="token-row">
              <span class={`pill ${entry.tone}`}>{entry.kind}</span>
              {#if entry.createdAt}
                <span class="muted">{formatTimestamp(entry.createdAt) || entry.createdAt}</span>
              {/if}
            </div>
          </div>
          <div>{entry.summary}</div>
        </div>
      {/each}
    {/if}
  </div>
</section>
{/if}
