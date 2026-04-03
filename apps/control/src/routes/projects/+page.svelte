<script lang="ts">
  import type { PageData } from "./$types";
  import { formatConstitutionFiles } from "$lib/projects";
  import { activeMission } from "$lib/project-detail";

  let { data }: { data: PageData } = $props();
</script>

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Project registry</span>
    <div>
      <h1>Projects</h1>
      <p>Browse active work, inspect constitutions, and jump into the project that needs attention next.</p>
    </div>
  </div>
  <a class="btn" href="/projects/new">Add project</a>
</section>

<section class="card">
  <div class="card-header">Attached projects</div>
  <div class="card-body">
    {#if data.projects.length === 0}
      <div class="empty-state">
        <div class="stack">
          <strong>No projects registered yet.</strong>
          <span>Start by attaching a repository on the dedicated project setup page.</span>
          <div>
            <a class="btn" href="/projects/new">Create your first project</a>
          </div>
        </div>
      </div>
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
