<script lang="ts">
  import { page } from "$app/state";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { onDestroy } from "svelte";
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
  import OfficeView from "$lib/ui/OfficeView.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let submitting = $state("");

  const project = $derived(data.project);
  const mission = $derived(activeMission(project));
  const blockers = $derived(sortBlockers(project.blockers));
  const jobs = $derived(recentJobs(project).slice(0, 6));
  const taskGroups = $derived(groupTasksByState(project));
  const staffOverview = $derived(agentPresenceOverview(project));
  const staff = $derived(staffOverview.roles);
  const nextTask = $derived(project.missions.flatMap((entry) => entry.tasks).find((task) => task.id === project.nextDispatchableTaskId) ?? null);
  const hasRunningTasks = $derived(
    project.missions.flatMap((m) => m.tasks).some((t) => t.status === "running")
  );
  const inInterview = $derived(project.constitutionStatus === "missing" || project.constitutionStatus === "pending");
  const runningJobs = $derived(
    recentJobs(project)
      .filter((entry) => entry.job.status === "running" || entry.job.status === "queued")
      .slice(0, 3)
  );

  const currentTab = $derived((() => {
    const tab = page.url.searchParams.get("tab")?.trim().toLowerCase();
    return tab === "agents" || tab === "chat" || tab === "office" ? tab : "overview";
  })());

  let pollInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    const shouldPoll = hasRunningTasks || currentTab === "chat";
    if (shouldPoll) {
      if (!pollInterval) {
        pollInterval = setInterval(() => { invalidateAll(); }, 5000);
      }
    } else {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });
  const operatorGuidanceIds = $derived(new Set(project.operatorGuidance.map((entry) => entry.id)));
  const chatEntries = $derived(
    [
      ...project.decisionLogs
        .filter((entry) => !operatorGuidanceIds.has(entry.id))
        .map((entry) => {
          const detail = entry.detail ?? {};
          const choices = Array.isArray(detail.choices)
            ? (detail.choices as unknown[]).filter((c): c is string => typeof c === "string")
            : null;
          const messageMode = typeof detail.messageMode === "string" ? detail.messageMode : null;
          return {
            id: `decision-${entry.id}`,
            rawId: entry.id,
            actor: entry.actor || "system",
            kind: entry.eventType || "workflow",
            summary: entry.summary || entry.title,
            createdAt: entry.createdAt,
            tone: entry.actor === "operator" ? "success" : "info",
            choices: choices && choices.length > 0 ? choices : null,
            messageMode
          };
        }),
      ...project.operatorGuidance.map((entry) => ({
        id: `guidance-${entry.id}`,
        rawId: entry.id,
        actor: entry.actor || "operator",
        kind: entry.mentions.length > 0 ? `@${entry.mentions.join(" @")}` : "message",
        summary: entry.content,
        createdAt: entry.createdAt,
        tone: "success",
        choices: null,
        messageMode: "comment"
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

  function tabHref(tab: "overview" | "agents" | "chat" | "office"): string {
    return tab === "overview" ? `/projects/${project.id}` : `/projects/${project.id}?tab=${tab}`;
  }

  const ALL_ROLE_KEYS = ["planner", "architect", "implementer", "tester", "coder", "qa", "reviewer", "visual"] as const;
  type RoleKey = typeof ALL_ROLE_KEYS[number];

  type EditableRole = {
    roleKey: RoleKey;
    visualName: string;
    goal: string;
    backstory: string;
    model: string | null;
    enabled: boolean;
    sortOrder: number;
  };

  let editableRoles = $state<EditableRole[]>(
    [...project.roleDefinitions]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r, i) => ({
        roleKey: r.roleKey as RoleKey,
        visualName: r.visualName,
        goal: r.goal,
        backstory: r.backstory,
        model: r.model ?? null,
        enabled: r.enabled,
        sortOrder: i
      }))
  );

  let addRoleKey = $state<RoleKey | "">("");

  const usedRoleKeys = $derived(new Set(editableRoles.map((r) => r.roleKey)));
  const availableRoleKeys = $derived(ALL_ROLE_KEYS.filter((k) => !usedRoleKeys.has(k)));

  // Modal state — draft is a working copy so cancel discards changes
  let editingRoleIndex = $state<number | null>(null);
  let modalDraft = $state<EditableRole | null>(null);

  function openRoleModal(i: number) {
    editingRoleIndex = i;
    modalDraft = { ...editableRoles[i] };
  }

  function saveRoleModal() {
    if (editingRoleIndex !== null && modalDraft) {
      const copy = [...editableRoles];
      copy[editingRoleIndex] = { ...modalDraft };
      editableRoles = copy;
    }
    editingRoleIndex = null;
    modalDraft = null;
  }

  function closeRoleModal() {
    editingRoleIndex = null;
    modalDraft = null;
  }

  function rolesJson(): string {
    return JSON.stringify(
      editableRoles.map((r, i) => ({ ...r, sortOrder: i }))
    );
  }

  function moveRole(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= editableRoles.length) return;
    const copy = [...editableRoles];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    editableRoles = copy;
  }

  function removeRole(index: number) {
    editableRoles = editableRoles.filter((_, i) => i !== index);
  }

  function addRole() {
    if (!addRoleKey) return;
    const key = addRoleKey as RoleKey;
    editableRoles = [
      ...editableRoles,
      {
        roleKey: key,
        visualName: key.charAt(0).toUpperCase() + key.slice(1),
        goal: "",
        backstory: "",
        model: null,
        enabled: true,
        sortOrder: editableRoles.length
      }
    ];
    addRoleKey = "";
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
      <form method="POST" use:enhance={() => {
        submitting = "plan";
        return async ({ update }) => { submitting = ""; await update(); };
      }}>
        <input name="returnTab" type="hidden" value={currentTab} />
        <button formaction="?/plan" type="submit" disabled={submitting !== ""}>
          {submitting === "plan" ? "Planning..." : "Plan"}
        </button>
      </form>
      <form method="POST" use:enhance={() => {
        submitting = "run";
        return async ({ update }) => { submitting = ""; await update(); };
      }}>
        <input name="returnTab" type="hidden" value={currentTab} />
        <button formaction="?/run" type="submit" disabled={submitting !== ""}>
          {submitting === "run" ? "Running..." : "Run now"}
        </button>
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
  <a aria-current={currentTab === "office" ? "page" : undefined} class:project-tab--active={currentTab === "office"} class="project-tab" href={tabHref("office")}>
    Office
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
      <div style="word-break: break-all;"><strong>Local path:</strong> {project.localPath || "—"}</div>
      <div><strong>Default branch:</strong> {project.defaultBranch || "—"}</div>
      <div>
        <strong>Constitution:</strong> {formatConstitutionFiles(project.constitution.files ?? undefined)}
        {#if project.constitution.files}
          {@const presentFiles = Object.entries(project.constitution.files).filter(([, present]) => present)}
          {#if presentFiles.length > 0}
            <div class="token-row" style="margin-top: var(--space-2); flex-wrap: wrap; gap: var(--space-1);">
              {#each presentFiles as [name]}
                <span class="pill success">{name}</span>
              {/each}
            </div>
          {/if}
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

{#if currentTab === "overview" && project.githubRepoOwner}
<section class="card">
  <div class="card-header">GitHub sync</div>
  <div class="card-body stack">
    <div class="token-row">
      <span>Status:</span>
      <span class="pill {project.githubProjectSync ? 'success' : 'muted'}">{project.githubProjectSync ? "enabled" : "disabled"}</span>
    </div>
    <form method="POST">
      <input name="returnTab" type="hidden" value="overview" />
      <input name="enabled" type="hidden" value={project.githubProjectSync ? "false" : "true"} />
      <button class={project.githubProjectSync ? "secondary" : ""} formaction="?/toggleGithubSync" type="submit">
        {project.githubProjectSync ? "Disable sync" : "Enable sync"}
      </button>
    </form>
  </div>
</section>
{/if}

{#if currentTab === "overview"}
<section class="card">
  <div class="card-header" style="display: flex; align-items: center;">
    Current mission
    {#if mission}
      <a class="btn secondary" href={`/missions/${mission.id}`} style="margin-left: auto; font-size: 0.75rem; padding: 0.25rem 0.625rem; height: auto;">View mission</a>
    {/if}
  </div>
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

{#if currentTab === "overview" && mission}
<section class="card">
  <div class="card-header">Pipeline</div>
  <div class="card-body">
    <div class="pipeline">
      {#each mission.tasks.sort((a, b) => a.priority - b.priority) as task, i}
        {@const statusClass = task.status === "complete" ? "success" : task.status === "running" ? "info" : task.status === "blocked" || task.status === "failed" ? "danger" : ""}
        {@const latestJob = task.status === "complete" ? [...task.jobs].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).find((j) => j.status === "complete" && j.artifactData != null) ?? null : null}
        <div class="pipeline-stage">
          <div class="pipeline-node {statusClass}">
            <div class="pipeline-role">{task.agentRole}</div>
            <div class="pipeline-title">{task.title}</div>
            <div class="pipeline-status-row">
              {#if task.status === "complete"}
                <span class="pipeline-badge success">✓ done</span>
              {:else if task.status === "running"}
                <span class="pipeline-badge info">⟳ running</span>
              {:else if task.status === "blocked" || task.status === "failed"}
                <span class="pipeline-badge danger">✕ {task.status}</span>
              {:else}
                <span class="pipeline-badge">{task.status}</span>
              {/if}
            </div>
            {#if latestJob}
              <div class="pipeline-verify-row">
                {#if latestJob.artifactData?.buildStatus === "pass"}
                  <span class="pipeline-verify success">✓ build</span>
                {:else if latestJob.artifactData?.buildStatus === "fail"}
                  <span class="pipeline-verify danger">✗ build</span>
                {/if}
                {#if latestJob.artifactData?.testOutput != null}
                  <span class="pipeline-verify {latestJob.artifactData.testOutput.failed > 0 ? 'danger' : 'success'}">{latestJob.artifactData.testOutput.passed}/{latestJob.artifactData.testOutput.total} tests</span>
                {/if}
              </div>
            {/if}
          </div>
          {#if i < mission.tasks.length - 1}
            <div class="pipeline-arrow">→</div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</section>
{/if}

{#if currentTab === "overview" && taskGroups.some((g) => g.tasks.length > 0)}
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

{#if currentTab === "office"}
<section class="card">
  <div class="card-header">Office</div>
  <OfficeView {staff} />
</section>
{/if}

{#if currentTab === "overview" || currentTab === "agents"}
<section class="split-grid">
  <div class="card">
    <form method="POST" action="?/saveRoles">
      <input type="hidden" name="roles" value={rolesJson()} />
      <div class="card-header" style="display: flex; align-items: center;">
        Team
        <div class="team-header-actions">
          {#if currentTab === "agents"}
            <select class="role-select" bind:value={addRoleKey} disabled={availableRoleKeys.length === 0}>
              <option value="">Add role...</option>
              {#each availableRoleKeys as key}
                <option value={key}>{key}</option>
              {/each}
            </select>
            <button type="button" class="btn secondary role-btn" onclick={addRole} disabled={!addRoleKey}>+</button>
            <button type="submit" class="btn role-btn">Save</button>
          {/if}
        </div>
      </div>
      <div class="card-body stack">
        {#each editableRoles as role, i}
          {@const staffRole = staff.find((s) => s.id === project.roleDefinitions.find((d) => d.roleKey === role.roleKey)?.id)}
          <div class="team-role-row" class:team-role-row--disabled={!role.enabled}>
            <div class="team-role-info">
              <strong>{role.visualName}</strong>
              <span class="pill muted" style="font-size: 0.6875rem;">{role.roleKey}</span>
              {#if !role.enabled}
                <span class="pill muted" style="font-size: 0.6875rem;">off</span>
              {/if}
            </div>
            <div class="team-role-meta">
              <span class="muted" style="font-size: 0.75rem;">
                {roleConfiguredModel(project.roleDefinitions.find((d) => d.roleKey === role.roleKey)?.id ?? null)}
              </span>
              {#if staffRole}
                <span class="muted" style="font-size: 0.75rem;">{roleStatusCopy(staffRole.status)}</span>
              {/if}
            </div>
            {#if currentTab === "agents"}
              <div class="team-role-actions">
                <button
                  type="button"
                  class="btn secondary role-btn"
                  onclick={() => openRoleModal(i)}
                  title="Edit role"
                >✏</button>
                <button type="button" class="btn secondary role-btn" onclick={() => moveRole(i, -1)} disabled={i === 0} title="Move up">▲</button>
                <button type="button" class="btn secondary role-btn" onclick={() => moveRole(i, 1)} disabled={i === editableRoles.length - 1} title="Move down">▼</button>
                <button type="button" class="btn secondary role-btn role-btn--remove" onclick={() => removeRole(i)} title="Remove">×</button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </form>
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

{#if modalDraft !== null}
<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit role">
  <div class="modal">
    <div class="modal-header">
      <strong>Edit role</strong>
      <span class="pill muted" style="font-size: 0.75rem;">{modalDraft.roleKey}</span>
    </div>
    <div class="modal-body">
      <label class="modal-field">
        <span class="modal-label">Display name</span>
        <input class="role-input" type="text" placeholder="Display name" bind:value={modalDraft.visualName} />
      </label>
      <label class="modal-field">
        <span class="modal-label">Goal</span>
        <textarea class="role-input role-textarea" placeholder="What this role is trying to achieve..." bind:value={modalDraft.goal}></textarea>
      </label>
      <label class="modal-field">
        <span class="modal-label">Backstory</span>
        <textarea class="role-input role-textarea" placeholder="Background and perspective for this agent..." bind:value={modalDraft.backstory}></textarea>
      </label>
      <label class="modal-field">
        <span class="modal-label">Model</span>
        <input
          class="role-input"
          type="text"
          placeholder={project.roleDefinitions.find((r) => r.roleKey === modalDraft!.roleKey)?.recommendedModel || "Default model"}
          bind:value={modalDraft.model}
        />
      </label>
      <label class="modal-field modal-field--row">
        <input type="checkbox" bind:checked={modalDraft.enabled} />
        <span>Enabled</span>
      </label>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn secondary" onclick={closeRoleModal}>Cancel</button>
      <button type="button" class="btn" onclick={saveRoleModal}>Apply</button>
    </div>
  </div>
</div>
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
    {#if project.constitutionStatus === "missing"}
      <form method="POST" style="margin-left: auto;">
        <input name="returnTab" type="hidden" value="chat" />
        <button class="btn primary" formaction="?/interview" type="submit">Start project interview</button>
      </form>
    {:else if project.constitutionStatus === "pending"}
      <form method="POST" style="margin-left: auto;">
        <input name="returnTab" type="hidden" value="chat" />
        <button class="btn primary" formaction="?/interview" type="submit">Continue interview</button>
      </form>
    {:else if project.constitutionStatus === "parsed" || project.constitutionStatus === "stale"}
      <form method="POST" style="margin-left: auto;">
        <input name="returnTab" type="hidden" value="chat" />
        <button class="btn secondary" formaction="?/interview" type="submit">Update constitution</button>
      </form>
    {/if}
  </div>

  <div class="chatroom-messages">
    {#if chatEntries.length === 0}
      <div class="chatroom-empty">
        {#if project.constitutionStatus === "missing"}
          <p>No constitution files detected. Start the project interview to set up this project — the planner will ask you a few questions and generate the constitution documents.</p>
        {:else if project.constitutionStatus === "pending"}
          <p>Interview in progress. Use the <strong>Continue interview</strong> button above to answer the next question and build out your constitution files.</p>
        {:else}
          <p>No messages yet. Agents will post updates here as they work.</p>
        {/if}
      </div>
    {:else}
      {#each [...chatEntries].reverse() as entry}
        {@const isOperator = entry.actor === "operator" || entry.tone === "success"}
        {@const isHandoff = entry.messageMode === "handoff"}
        <div class="chat-bubble {isOperator ? 'chat-bubble--operator' : isHandoff ? 'chat-bubble--handoff' : 'chat-bubble--agent'}">
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
          {#if entry.choices && entry.choices.length > 0}
            <div class="decision-card">
              {#each entry.choices as choice}
                <form method="POST" style="display:inline">
                  <input name="returnTab" type="hidden" value="chat" />
                  <input name="content" type="hidden" value={choice} />
                  <input name="replyToId" type="hidden" value={entry.rawId} />
                  <button class="btn secondary decision-choice" formaction="?/message" type="submit">{choice}</button>
                </form>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <div class="chatroom-input">
    {#if runningJobs.length > 0}
      <div class="steer-bar">
        <span class="steer-label">Steer running agent:</span>
        {#each runningJobs as entry}
          <form method="POST" class="steer-form" use:enhance={() => {
            return async ({ update }) => { await update(); };
          }}>
            <input name="returnTab" type="hidden" value="chat" />
            <input name="jobId" type="hidden" value={entry.job.id} />
            <input class="steer-input" type="text" name="steerContent" placeholder="Redirect this agent..." />
            <button class="btn secondary steer-btn" formaction="?/steer" type="submit">→ {entry.job.id.slice(0, 6)}</button>
          </form>
        {/each}
      </div>
    {/if}
    <form method="POST" class="chatroom-form">
      <input name="returnTab" type="hidden" value="chat" />
      <textarea name="content" class="chatroom-textarea" placeholder={inInterview ? "Type your answer..." : "Type a message... Use @role to address a specific agent."} rows="2"></textarea>
      <button class="btn primary" formaction={inInterview ? "?/interview" : "?/message"} type="submit">{inInterview ? "Answer" : "Send"}</button>
    </form>
  </div>
</section>
{/if}

<style>
  .pipeline {
    display: flex;
    align-items: center;
    gap: 0;
    overflow-x: auto;
    padding: var(--space-2, 0.5rem) 0;
  }
  .pipeline-stage {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .pipeline-node {
    padding: var(--space-3, 0.75rem);
    border-radius: var(--radius-md, 0.5rem);
    border: 2px solid var(--color-border, #333);
    background: var(--color-surface-raised, #1a1a1a);
    min-width: 120px;
    text-align: center;
  }
  .pipeline-node.success {
    border-color: var(--color-status-success, #22c55e);
    background: color-mix(in srgb, var(--color-status-success, #22c55e) 10%, var(--color-surface-raised, #1a1a1a));
  }
  .pipeline-node.info {
    border-color: var(--color-accent, #60a5fa);
    background: color-mix(in srgb, var(--color-accent, #60a5fa) 10%, var(--color-surface-raised, #1a1a1a));
    animation: pipeline-pulse 2s ease-in-out infinite;
  }
  @keyframes pipeline-pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent, #60a5fa) 40%, transparent); }
    50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent, #60a5fa) 0%, transparent); }
  }
  .pipeline-node.danger {
    border-color: var(--color-status-error, #ef4444);
    background: color-mix(in srgb, var(--color-status-error, #ef4444) 10%, var(--color-surface-raised, #1a1a1a));
  }
  .pipeline-role {
    font-weight: 600;
    font-size: var(--font-size-sm, 0.8125rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary, #aaa);
  }
  .pipeline-title {
    font-size: var(--font-size-sm, 0.8125rem);
    margin-top: var(--space-1, 0.25rem);
    color: var(--color-text-primary, #eee);
  }
  .pipeline-arrow {
    padding: 0 var(--space-2, 0.5rem);
    color: var(--color-text-secondary, #666);
    font-size: 1.25rem;
  }
  .pipeline-status-row {
    margin-top: var(--space-1, 0.25rem);
  }
  .pipeline-badge {
    display: inline-block;
    font-size: 0.625rem;
    padding: 0.1rem 0.35rem;
    border-radius: 999px;
    background: var(--color-surface-sunken, #111);
    color: var(--color-text-secondary, #aaa);
  }
  .pipeline-badge.success { background: color-mix(in srgb, var(--color-status-success, #22c55e) 15%, transparent); color: var(--color-status-success, #22c55e); }
  .pipeline-badge.info { background: color-mix(in srgb, var(--color-accent, #60a5fa) 15%, transparent); color: var(--color-accent, #60a5fa); }
  .pipeline-badge.danger { background: color-mix(in srgb, var(--color-status-error, #ef4444) 15%, transparent); color: var(--color-status-error, #ef4444); }
  .pipeline-verify-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1, 0.25rem);
    margin-top: var(--space-1, 0.25rem);
  }
  .pipeline-verify {
    display: inline-block;
    font-size: 0.625rem;
    padding: 0.1rem 0.35rem;
    border-radius: 999px;
    background: var(--color-surface-sunken, #111);
    color: var(--color-text-secondary, #aaa);
    white-space: nowrap;
  }
  .pipeline-verify.success { background: color-mix(in srgb, var(--color-status-success, #22c55e) 15%, transparent); color: var(--color-status-success, #22c55e); }
  .pipeline-verify.danger { background: color-mix(in srgb, var(--color-status-error, #ef4444) 15%, transparent); color: var(--color-status-error, #ef4444); }
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
  .chat-bubble--handoff {
    align-self: flex-start;
    background: color-mix(in srgb, var(--color-status-success, #22c55e) 8%, var(--color-surface-raised, #1a1a1a));
    border: 1px solid color-mix(in srgb, var(--color-status-success, #22c55e) 40%, transparent);
  }
  .decision-card {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1, 0.25rem);
    margin-top: var(--space-2, 0.5rem);
  }
  .decision-choice {
    font-size: 0.75rem;
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
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
  /* Team list integrated role editor */
  .team-header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
    margin-left: auto;
  }
  .team-role-row {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border-radius: var(--radius-md, 0.5rem);
    background: var(--color-surface-raised, #1a1a1a);
    border: 1px solid var(--color-border, #333);
    transition: border-color 0.15s;
  }
  .team-role-row--disabled {
    opacity: 0.45;
  }
  .team-role-info {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    flex: 1;
    min-width: 0;
  }
  .team-role-info strong {
    font-size: var(--font-size-sm, 0.8125rem);
  }
  .team-role-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.125rem;
    flex-shrink: 0;
  }
  .team-role-actions {
    display: flex;
    gap: var(--space-1, 0.25rem);
    flex-shrink: 0;
  }
  .role-btn {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    font-size: 0.75rem;
    line-height: 1;
  }
  .role-btn--remove {
    color: var(--color-status-error, #ef4444);
  }
  .role-select {
    font-family: inherit;
    font-size: var(--font-size-sm, 0.8125rem);
    background: var(--color-surface-sunken, #111);
    color: var(--color-text-primary, #eee);
    border: 1px solid var(--color-border, #333);
    border-radius: var(--radius-sm, 0.375rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    width: auto;
  }
  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    backdrop-filter: blur(2px);
  }
  .modal {
    background: var(--color-surface, #141414);
    border: 1px solid var(--color-border, #333);
    border-radius: var(--radius-lg, 0.75rem);
    width: min(480px, calc(100vw - 2rem));
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
  }
  .modal-header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
    border-bottom: 1px solid var(--color-border, #333);
    font-size: var(--font-size-sm, 0.875rem);
  }
  .modal-body {
    padding: var(--space-4, 1rem) var(--space-5, 1.25rem);
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }
  .modal-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }
  .modal-field--row {
    flex-direction: row;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }
  .modal-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary, #888);
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-3, 0.75rem) var(--space-5, 1.25rem);
    border-top: 1px solid var(--color-border, #333);
  }
  .role-input {
    font-family: inherit;
    font-size: var(--font-size-sm, 0.8125rem);
    background: var(--color-surface-sunken, #111);
    color: var(--color-text-primary, #eee);
    border: 1px solid var(--color-border, #333);
    border-radius: var(--radius-sm, 0.375rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    width: 100%;
    box-sizing: border-box;
  }
  .role-input:focus {
    outline: 2px solid var(--color-accent, #60a5fa);
    outline-offset: -1px;
    border-color: transparent;
  }
  .role-textarea {
    resize: vertical;
    min-height: 4rem;
    line-height: 1.5;
  }
  .steer-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    flex-wrap: wrap;
    padding: var(--space-2, 0.5rem) 0;
    border-bottom: 1px solid var(--color-border, #333);
    margin-bottom: var(--space-2, 0.5rem);
  }
  .steer-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary, #888);
    white-space: nowrap;
  }
  .steer-form {
    display: flex;
    gap: var(--space-1, 0.25rem);
    align-items: center;
  }
  .steer-input {
    font-family: inherit;
    font-size: var(--font-size-sm, 0.8125rem);
    background: var(--color-surface-sunken, #111);
    color: var(--color-text-primary, #eee);
    border: 1px solid var(--color-accent-dim, #2563eb33);
    border-radius: var(--radius-sm, 0.375rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    width: 200px;
  }
  .steer-btn {
    font-size: 0.75rem;
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    white-space: nowrap;
  }
</style>
