<script lang="ts">
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();
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
  <div class="card-header">Repository attachment</div>
  <div class="card-body">
    <form class="split-grid" method="POST">
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
