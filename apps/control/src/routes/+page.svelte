<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<section class="hero-card">
  <div class="stack">
    <span class="eyebrow">Control plane</span>
    <div>
      <h1>The operator surface for a self-hosted autonomous software factory.</h1>
      <p>
        yeet2 turns a repo constitution into durable missions, dispatchable work, hosted execution,
        explicit blockers, and visible review trails.
      </p>
    </div>
    <div class="token-row">
      <a class="btn" href="/projects">Open projects</a>
      <a class="btn secondary" href="/projects/new">Add project</a>
      <a class="btn secondary" href="/jobs">Inspect jobs</a>
      <a class="btn secondary" href="/approvals">Review approvals</a>
    </div>
  </div>
</section>

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Projects</div>
    <div class="metric-value">{data.overview.totals.projects}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Active missions</div>
    <div class="metric-value">{data.overview.totals.activeMissions}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Running jobs</div>
    <div class="metric-value">{data.overview.totals.runningJobs}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Open blockers</div>
    <div class="metric-value">{data.overview.totals.openBlockers}</div>
  </div>
</section>

<section class="card">
  <div class="card-header">Control plane overview</div>
  <div class="card-body">
    <div class="split-grid">
      <div class="stack">
        <div class="pill {data.overview.auth.enabled ? 'info' : 'success'}">
          Auth {data.overview.auth.mode}
        </div>
        <p>
          The hosted yeet2 instance tracks projects, jobs, missions, approvals, blockers, and workers
          through the same API-first control plane.
        </p>
      </div>
      <div class="stack">
        <div class="pill {data.overview.workers.availableWorkers > 0 ? 'success' : 'warn'}">
          Available workers {data.overview.workers.availableWorkers}
        </div>
        <p>
          Healthy workers: {data.overview.workers.healthyWorkers}. Busy workers:
          {" "}{data.overview.workers.busyWorkers}. Stale workers:
          {" "}{data.overview.workers.staleWorkers}.
        </p>
      </div>
    </div>
  </div>
</section>
