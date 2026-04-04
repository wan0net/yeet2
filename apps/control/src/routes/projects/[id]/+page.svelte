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
  import Markdown from "$lib/ui/Markdown.svelte";

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
  const operatorGuidanceIds = $derived(new Set(project.operatorGuidance.map((entry) => entry.id)));
  const chatEntries = $derived(
    [
      ...project.decisionLogs
        .filter((entry) => !operatorGuidanceIds.has(entry.id))
        .map((entry) => ({
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
        kind: entry.mentions.length > 0 ? `@${entry.mentions.join(" @")}` : "message",
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

  function catalogModelId(model: string | null): string {
    if (!model) return "";
    return model.replace(/^openrouter\//, "");
  }

  function findModelCatalogEntry(model: string | null) {
    const id = catalogModelId(model);
    return id ? data.modelCatalog.find((entry) => entry.value === id) ?? null : null;
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
        <a class="btn secondary" href={`/projects/${project.id}/constitution`} style="margin-top: var(--space-2); display: inline-block;">Edit constitution</a>
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
          <Markdown content={mission.objective} />
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
          <div class="muted">{role.effectiveModel || role.model || "No model assigned"}{!role.model && role.recommendedModel ? " (default)" : ""}</div>
          <div class="muted">
            {projectModelCostSummary(findModelCatalogEntry(role.effectiveModel || role.model)) || "No published pricing available."}
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
            <div class="muted"><Markdown content={blocker.context ?? ""} inline /></div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</section>
{/if}

{#if currentTab === "chat"}
<section class="chatroom">
  <div class="chatroom-header">
    <strong>Team chat</strong>
    {#if project.constitutionStatus === "missing" || project.constitutionStatus === "pending"}
      <form method="POST" style="margin-left: auto;">
        <input name="returnTab" type="hidden" value="chat" />
        <button class="btn primary" formaction="?/interview" type="submit">Start project interview</button>
      </form>
    {/if}
  </div>

  <div class="chatroom-messages">
    {#if chatEntries.length === 0}
      <div class="chatroom-empty">
        {#if project.constitutionStatus === "missing" || project.constitutionStatus === "pending"}
          <p>No constitution files detected. Start the project interview to set up this project — the planner will ask you a few questions and generate the constitution documents.</p>
        {:else}
          <p>No messages yet. Agents will post updates here as they work.</p>
        {/if}
      </div>
    {:else}
      {#each [...chatEntries].reverse() as entry}
        {@const isOperator = entry.actor === "operator" || entry.tone === "success"}
        <div class="chat-bubble {isOperator ? 'chat-bubble--operator' : 'chat-bubble--agent'}">
          <div class="chat-bubble-meta">
            <strong>{entry.actor}</strong>
            <span class={`pill ${entry.tone}`} style="font-size: 0.625rem; padding: 0.1rem 0.3rem;">{entry.kind}</span>
            {#if entry.createdAt}
              <span class="muted" style="font-size: 0.75rem;">{formatTimestamp(entry.createdAt) || entry.createdAt}</span>
            {/if}
          </div>
          <div class="chat-bubble-content">
            <Markdown content={entry.summary} />
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <div class="chatroom-input">
    <form method="POST" class="chatroom-form">
      <input name="returnTab" type="hidden" value="chat" />
      <textarea name="content" class="chatroom-textarea" placeholder="Type a message..." rows="2"></textarea>
      <button class="btn primary" formaction="?/message" type="submit">Send</button>
    </form>
  </div>
</section>

<style>
  .chatroom {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 200px);
    min-height: 400px;
    background: var(--color-surface-sunken, #111);
    border-radius: var(--radius-lg, 0.75rem);
    border: 1px solid var(--color-border, #333);
    overflow: hidden;
  }
  .chatroom-header {
    display: flex;
    align-items: center;
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    border-bottom: 1px solid var(--color-border, #333);
    background: var(--color-surface-raised, #1a1a1a);
  }
  .chatroom-messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4, 1rem);
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }
  .chatroom-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-secondary, #888);
    text-align: center;
    padding: var(--space-6, 2rem);
  }
  .chat-bubble {
    max-width: 75%;
    padding: var(--space-3, 0.75rem);
    border-radius: var(--radius-md, 0.5rem);
  }
  .chat-bubble--agent {
    align-self: flex-start;
    background: var(--color-surface-raised, #1a1a1a);
    border: 1px solid var(--color-border, #333);
  }
  .chat-bubble--operator {
    align-self: flex-end;
    background: var(--color-accent-subtle, #1e3a5f);
    border: 1px solid var(--color-accent-dim, #2563eb33);
  }
  .chat-bubble-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    margin-bottom: var(--space-1, 0.25rem);
  }
  .chat-bubble-content {
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.5;
  }
  .chatroom-input {
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    border-top: 1px solid var(--color-border, #333);
    background: var(--color-surface-raised, #1a1a1a);
  }
  .chatroom-form {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: flex-end;
  }
  .chatroom-textarea {
    flex: 1;
    font-family: inherit;
    font-size: var(--font-size-sm, 0.875rem);
    background: var(--color-surface-sunken, #111);
    color: var(--color-text-primary, #eee);
    border: 1px solid var(--color-border, #333);
    border-radius: var(--radius-md, 0.5rem);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    resize: none;
  }
  .chatroom-textarea:focus {
    outline: 2px solid var(--color-accent, #60a5fa);
    outline-offset: -1px;
    border-color: transparent;
  }
</style>
{/if}
