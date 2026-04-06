<script lang="ts">
  import type { ActionData } from "./$types";

  const TEMPLATES = [
    {
      key: "software",
      name: "Software Development",
      description: "Architecture, implementation, testing, and review pipeline for code projects."
    },
    {
      key: "content",
      name: "Content & Writing",
      description: "Research, writing, editing, fact-checking, and publishing stages."
    },
    {
      key: "architecture",
      name: "Solution Architecture",
      description: "Discovery, design, documentation, review, and approval workflow."
    },
    {
      key: "research",
      name: "Research",
      description: "Question framing, investigation, synthesis, critique, and publishing."
    },
    {
      key: "marketing",
      name: "Marketing",
      description: "Strategy, copywriting, design, review, and campaign publishing."
    },
    {
      key: "legal",
      name: "Legal & Compliance",
      description: "Analysis, drafting, review, compliance check, and approval sign-off."
    },
    {
      key: "data",
      name: "Data Analysis",
      description: "Collection, analysis, visualization, narrative, and review stages."
    },
    {
      key: "product",
      name: "Product",
      description: "PM requirements, design, engineering, QA, and stakeholder review."
    },
    {
      key: "custom",
      name: "Custom",
      description: "Start with a blank worker role and build your own pipeline after creation."
    }
  ];

  let { form }: { form: ActionData } = $props();

  let selectedTemplate = $state((form as any)?.values?.pipelineTemplate ?? "software");
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Project setup</span>
    <div>
      <h1>Add project</h1>
      <p>Attach a repository once, then let yeet2 plan, dispatch, and keep the work moving over time.</p>
    </div>
  </div>
  <a class="btn secondary" href="/projects">Back to projects</a>
</section>

<section class="card">
  <div class="card-header">Pipeline template</div>
  <div class="card-body">
    <p class="setup-note">Choose the type of work this project will handle. You can edit individual roles after creation.</p>
    <div class="template-grid">
      {#each TEMPLATES as template}
        <button
          type="button"
          class="template-card"
          class:selected={selectedTemplate === template.key}
          onclick={() => { selectedTemplate = template.key; }}
        >
          <strong>{template.name}</strong>
          <span>{template.description}</span>
          {#if template.key === "custom"}
            <span class="pill" style="margin-top: 0.25rem;">Edit roles after creation</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">Repository attachment</div>
  <div class="card-body">
    <form class="split-grid" method="POST">
      <input type="hidden" name="pipeline_template" value={selectedTemplate} />
      <label>
        Project name
        <input name="name" placeholder="forgeyard" value={form?.values?.name ?? ""} />
      </label>
      <label>
        Repository URL
        <input name="repo_url" placeholder="https://github.com/wan0net/yeet2.git" value={form?.values?.repoUrl ?? ""} />
      </label>
      <label>
        Default branch
        <input name="default_branch" placeholder="main" value={form?.values?.defaultBranch ?? "main"} />
      </label>
      <label>
        Local path
        <input name="local_path" placeholder="/srv/forgeyard (optional)" value={form?.values?.localPath ?? ""} />
      </label>
      <div class="setup-note" style="grid-column: 1 / -1;">
        Use either a repository URL for clone-based setup or a local path for an already-mounted checkout.
      </div>
      <div class="token-row" style="grid-column: 1 / -1;">
        <button formaction="?/register" type="submit">Attach project</button>
        <a class="btn secondary" href="/projects">Cancel</a>
        {#if form?.registerError}
          <span class="pill danger">{form.registerError}</span>
        {/if}
      </div>
    </form>
  </div>
</section>

<style>
  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .template-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--color-border, #333);
    border-radius: var(--radius-md, 0.5rem);
    background: var(--color-surface-raised, #1a1a1a);
    color: var(--color-text-primary, #eee);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, box-shadow 0.15s;
    overflow: hidden;
    word-break: break-word;
  }

  .template-card:hover {
    border-color: var(--color-accent, #3b82f6);
  }

  .template-card.selected {
    border-color: var(--color-accent, #3b82f6);
    box-shadow: 0 0 0 2px var(--color-accent-dim, #2563eb33);
    background: var(--color-accent-subtle, #1e3a5f);
  }

  .template-card strong {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-primary, #eee);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .template-card span:not(.pill) {
    font-size: 0.75rem;
    color: var(--color-text-secondary, #888);
    line-height: 1.4;
  }
</style>
