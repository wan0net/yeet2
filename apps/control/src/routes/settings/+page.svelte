<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Configuration</span>
    <div>
      <h1>Settings</h1>
      <p>Manage operator credentials and integration tokens.</p>
    </div>
  </div>
</section>

{#if form?.actionError}
  <section class="card" style="border-color: var(--color-status-error);">
    <div class="card-body">{form.actionError}</div>
  </section>
{/if}

<section class="card">
  <div class="card-header">GitHub token</div>
  <div class="card-body">
    <p style="margin-bottom: 1rem;">
      Status: <span class="pill">{data.githubTokenConfigured ? "Configured" : "Not configured"}</span>
    </p>

    {#if !data.githubTokenConfigured}
      <p style="margin-bottom: 1.5rem; color: var(--color-text-muted);">
        Paste a GitHub personal access token (PAT) with <code>repo</code> scope. This is required for pull request and issue operations. Falls back to the <code>GITHUB_TOKEN</code> environment variable if not set here.
      </p>
      <form method="POST" action="?/saveToken" style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 480px;">
        <label for="token" style="font-size: 0.85rem; font-weight: 500;">Personal access token</label>
        <input
          id="token"
          name="token"
          type="password"
          placeholder="ghp_..."
          autocomplete="off"
          required
          style="font-family: monospace;"
        />
        <div>
          <button type="submit" class="btn">Save token</button>
        </div>
      </form>
    {:else}
      <p style="margin-bottom: 1.5rem; color: var(--color-text-muted);">
        A GitHub token is stored in the database. Remove it to fall back to the <code>GITHUB_TOKEN</code> environment variable.
      </p>
      <form method="POST" action="?/removeToken">
        <button type="submit" class="btn btn--danger">Remove token</button>
      </form>
    {/if}
  </div>
</section>
