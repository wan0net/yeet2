<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { formatConstitutionFiles } from "$lib/projects";
  import { activeMission } from "$lib/project-detail";

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Project registry</span>
    <div>
      <h1>Projects</h1>
      <p>Attach repositories, inspect constitutions, and move into active missions from one place.</p>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">Register project</div>
  <div class="card-body">
    <form class="split-grid" method="POST">
      <label>
        Name
        <input name="name" placeholder="forgeyard" />
      </label>
      <label>
        Repo URL
        <input name="repo_url" placeholder="https://github.com/wan0net/yeet2.git" />
      </label>
      <label>
        Default branch
        <input name="default_branch" placeholder="main" value="main" />
      </label>
      <label>
        Local path
        <input name="local_path" placeholder="/srv/forgeyard (optional)" />
      </label>
      <div class="token-row" style="grid-column: 1 / -1;">
        <button formaction="?/register" type="submit">Register project</button>
        {#if form?.registerError}
          <span class="pill danger">{form.registerError}</span>
        {/if}
      </div>
    </form>
  </div>
</section>

<section class="card">
  <div class="card-header">Attached projects</div>
  <div class="card-body">
    {#if data.projects.length === 0}
      <div class="empty-state">No projects registered yet.</div>
    {:else}
      <div class="stack">
        {#each data.projects as project}
          <article class="hero-card">
            <div class="page-header">
              <div class="stack">
                <div class="token-row">
                  <span class="pill">{project.constitutionStatus}</span>
                  {#if project.nextDispatchableTaskRole}
                    <span class="pill info">next {project.nextDispatchableTaskRole}</span>
                  {/if}
                </div>
                <div>
                  <h2>{project.name}</h2>
                  <p>{project.repoUrl || project.localPath}</p>
                </div>
              </div>
              <a class="btn secondary" href={`/projects/${project.id}`}>Open project</a>
            </div>

            <div class="metrics" style="margin-top: 12px;">
              <div class="metric">
                <div class="metric-kicker">Constitution</div>
                <div>{formatConstitutionFiles(project.constitution.files)}</div>
              </div>
              <div class="metric">
                <div class="metric-kicker">Active mission</div>
                <div>{activeMission(project)?.title || "No active mission"}</div>
              </div>
              <div class="metric">
                <div class="metric-kicker">Open blockers</div>
                <div>{project.blockerCount || 0}</div>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </div>
</section>
