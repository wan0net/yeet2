<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Getting started</span>
    <div>
      <h1>Your first autonomous project</h1>
      <p>Follow these steps to register a project, configure autonomy, and let yeet2 start working.</p>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">
    <span class="pill">1</span> Register a project
  </div>
  <div class="card-body stack">
    <p>
      Add your repository by giving it a name, a repo URL or local path, and a default branch. yeet2
      clones the repo and scans the <code>docs/</code> directory for constitution files that tell agents
      how to plan and execute work.
    </p>
    <div class="token-row">
      <a class="btn secondary" href="/projects/new">Add project</a>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">
    <span class="pill">2</span> Check constitution status
  </div>
  <div class="card-body stack">
    <p>
      Open the project detail page and find the Constitution section. Green pills mean the file was
      detected; grey means it's missing. The three required files are
      <code>VISION.md</code>, <code>SPEC.md</code>, and <code>ROADMAP.md</code> — without them,
      planning will not start. Recommended additions are <code>ARCHITECTURE.md</code>,
      <code>DECISIONS.md</code>, and <code>QUALITY_BAR.md</code>.
    </p>
    <p>
      Use the built-in constitution editor to create or update any of these files directly from the UI.
      These documents are the primary input agents use when forming plans.
    </p>
    <div class="token-row">
      <a class="btn secondary" href="/projects">Open projects</a>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">
    <span class="pill">3</span> Configure roles
  </div>
  <div class="card-body stack">
    <p>
      Each project uses six specialist roles: Planner, Architect, Implementer, Coder, QA, and Reviewer.
      Each role can be assigned a different LLM model to balance cost and capability. All six core
      roles must be enabled before planning will run.
    </p>
    <p>
      The Implementer plans the concrete code changes (which files, what approach, what to test),
      while the Coder executes that plan by writing and testing the actual code.
    </p>
    <p>
      Role configuration lives on the project detail page under the Roles section. Adjust model
      assignments at any time — changes take effect on the next autonomy loop cycle.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-header">
    <span class="pill">4</span> Set autonomy mode
  </div>
  <div class="card-body stack">
    <p>
      yeet2 has three autonomy modes. <strong>Manual</strong> — nothing runs automatically; you
      trigger planning and dispatch by hand. <strong>Supervised</strong> — the loop plans missions
      automatically but waits for your approval before dispatching tasks. <strong>Autonomous</strong>
      — full self-driving: the loop plans, dispatches, creates PRs, and merges without intervention.
    </p>
    <p>
      Start with <strong>Supervised</strong>. It lets you review what the agents intend to do before
      anything executes, so you can catch misaligned plans early.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-header">
    <span class="pill">5</span> Trigger the first plan
  </div>
  <div class="card-body stack">
    <p>
      Click <strong>Plan</strong> on the project detail page, or switch autonomy to Supervised or
      Autonomous and wait for the loop to fire. yeet2 reads the constitution, generates a mission, and
      breaks it into tasks assigned to each specialist role.
    </p>
    <p>
      The Architect validates scope and design, the Implementer plans the changes, the Coder writes
      the code, QA verifies correctness, and the Reviewer checks everything before the branch is merged.
    </p>
    <div class="token-row">
      <a class="btn secondary" href="/missions">View missions</a>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">
    <span class="pill">6</span> Watch the pipeline
  </div>
  <div class="card-body stack">
    <p>
      The autonomy loop dispatches tasks in stage order: Architect → Implementer → Coder → QA → Reviewer.
      Each stage runs as an isolated job in its own git worktree, so stages never interfere with each
      other. View job logs, artifact summaries, and stage verdicts in the Jobs page.
    </p>
    <p>
      After all stages complete successfully, yeet2 can automatically create and merge a pull request
      depending on your autonomy mode and approval settings.
    </p>
    <div class="token-row">
      <a class="btn secondary" href="/jobs">View jobs</a>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">
    <span class="pill">7</span> Handle blockers and approvals
  </div>
  <div class="card-body stack">
    <p>
      If a task fails twice in a row, it becomes blocked and the loop stops advancing that task.
      Blocked tasks appear on the Blockers page — you can resolve them with guidance, retry with
      adjusted instructions, or dismiss them to let the loop move on.
    </p>
    <p>
      In Supervised mode and when human-approval gates are configured, PRs and merges wait for
      explicit sign-off. Review and approve pending items from the Approvals page.
    </p>
    <div class="token-row">
      <a class="btn secondary" href="/blockers">View blockers</a>
      <a class="btn secondary" href="/approvals">View approvals</a>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">
    <span class="pill">8</span> Monitor ongoing work
  </div>
  <div class="card-body stack">
    <p>
      The Overview dashboard shows project health at a glance: pending approvals, open blockers, and
      running jobs. The Workers page shows executor heartbeat and availability — stale or offline
      workers will stall the queue.
    </p>
    <p>
      Every autonomy decision is written to the project's Chat tab as a decision log entry. This gives
      you a full audit trail of what the loop decided and why, without needing to dig through raw logs.
    </p>
    <div class="token-row">
      <a class="btn secondary" href="/">Back to overview</a>
      <a class="btn secondary" href="/workers">View workers</a>
    </div>
  </div>
</section>
