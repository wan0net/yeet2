<script lang="ts">
  import type { PageData } from "./$types";
  import { formatTimestamp } from "$lib/project-detail";
  let { data }: { data: PageData } = $props();

  const KIND_OPTIONS = [
    "", "planning", "dispatch", "pull_request", "merge", "autonomy",
    "approval", "message", "verdict", "workflow", "steer"
  ];

  function kindColor(kind: string): string {
    if (kind === "dispatch") return "info";
    if (kind === "planning") return "success";
    if (kind === "merge") return "success";
    if (kind === "message" || kind === "steer") return "warn";
    if (kind === "autonomy") return "info";
    return "";
  }

  function actorColor(actor: string): string {
    if (actor === "operator") return "success";
    if (actor === "system") return "";
    return "info";
  }
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Observability</span>
    <h1>Audit log</h1>
  </div>
</section>

<form method="GET" class="audit-filters">
  <select name="project" class="audit-select">
    <option value="">All projects</option>
    {#each data.projects as project}
      <option value={project.id} selected={data.filters.projectId === project.id}>{project.name}</option>
    {/each}
  </select>
  <select name="kind" class="audit-select">
    {#each KIND_OPTIONS as opt}
      <option value={opt} selected={data.filters.kind === opt}>{opt || "All kinds"}</option>
    {/each}
  </select>
  <input
    class="audit-search"
    type="text"
    name="search"
    placeholder="Search summaries..."
    value={data.filters.search}
  />
  <button class="btn" type="submit">Filter</button>
  <a class="btn secondary" href="/audit">Reset</a>
</form>

<section class="card">
  <div class="card-header">
    Events
    <span class="pill">{data.activity.length}</span>
  </div>
  <div class="card-body">
    {#if data.activity.length === 0}
      <div class="empty-state">No activity matches your filters.</div>
    {:else}
      <div class="audit-table">
        <div class="audit-row audit-row--header">
          <span>When</span>
          <span>Project</span>
          <span>Actor</span>
          <span>Kind</span>
          <span>Summary</span>
        </div>
        {#each data.activity as entry}
          {@const project = data.projects.find((p) => p.id === entry.projectId)}
          <div class="audit-row">
            <span class="audit-ts muted">{formatTimestamp(entry.createdAt ?? null) || "—"}</span>
            <span class="audit-project">
              {#if project}
                <a href="/projects/{project.id}">{project.name}</a>
              {:else}
                <span class="muted">{entry.projectId?.slice(0, 8) ?? "—"}</span>
              {/if}
            </span>
            <span class="audit-actor">
              <span class="pill {actorColor(entry.actor)}" style="font-size: 0.6875rem;">{entry.actor}</span>
            </span>
            <span class="audit-kind">
              <span class="pill {kindColor(entry.kind)}" style="font-size: 0.6875rem;">{entry.kind}</span>
            </span>
            <span class="audit-summary">{entry.summary}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .audit-filters {
    display: flex;
    gap: var(--space-2, 0.5rem);
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: var(--space-4, 1rem);
  }
  .audit-select {
    font-family: inherit;
    font-size: var(--font-size-sm, 0.8125rem);
    background: var(--color-surface-raised, #1a1a1a);
    color: var(--color-text-primary, #eee);
    border: 1px solid var(--color-border, #333);
    border-radius: var(--radius-sm, 0.375rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  }
  .audit-search {
    font-family: inherit;
    font-size: var(--font-size-sm, 0.8125rem);
    background: var(--color-surface-raised, #1a1a1a);
    color: var(--color-text-primary, #eee);
    border: 1px solid var(--color-border, #333);
    border-radius: var(--radius-sm, 0.375rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    min-width: 200px;
  }
  .audit-search:focus {
    outline: 2px solid var(--color-accent, #60a5fa);
    outline-offset: -1px;
    border-color: transparent;
  }
  .audit-table {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .audit-row {
    display: grid;
    grid-template-columns: 140px 140px 90px 90px 1fr;
    gap: var(--space-2, 0.5rem);
    align-items: baseline;
    padding: var(--space-2, 0.5rem) var(--space-1, 0.25rem);
    border-bottom: 1px solid color-mix(in srgb, var(--color-border, #333) 40%, transparent);
    font-size: var(--font-size-sm, 0.8125rem);
  }
  .audit-row--header {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary, #888);
    border-bottom-color: var(--color-border, #333);
  }
  .audit-ts { font-size: 0.75rem; }
  .audit-summary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary, #eee);
  }
</style>
