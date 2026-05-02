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
	      Add your repository by giving it a name, a GitHub repo URL, and a default branch. yeet2
	      clones the repo, links it to GitHub issues, and uses those issues as the work queue.
	    </p>
    <div class="token-row">
      <a class="btn secondary" href="/projects/new">Add project</a>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">
	    <span class="pill">2</span> Connect GitHub tickets
  </div>
  <div class="card-body stack">
	    <p>
	      Open the project detail page, enable GitHub sync, then click <strong>Pull GitHub issues</strong>.
	      Human-created and AI-created GitHub issues become Yeet tickets, get assigned to agent roles,
	      and are closed after agents ship the work.
	    </p>
	    <p>
	      Reference docs such as <code>VISION.md</code>, <code>SPEC.md</code>, and <code>ARCHITECTURE.md</code>
	      still help agents make better choices, but they no longer drive the queue.
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
	      Each project uses specialist roles such as Architect, Implementer, Tester, Coder, QA, and Reviewer.
	      Each role can be assigned a different LLM model to balance cost and capability. Keep at least
	      one implementation-capable role enabled for ticket work.
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
	      pull tickets and dispatch by hand. <strong>Supervised</strong> — the loop pulls GitHub issues
	      automatically but waits before dispatching tasks. <strong>Autonomous</strong>
	      — full self-driving: the loop pulls tickets, dispatches, creates PRs, and merges by policy.
    </p>
    <p>
      Start with <strong>Supervised</strong>. It lets you review what the agents intend to do before
      anything executes, so you can catch misaligned plans early.
    </p>
  </div>
</section>

<section class="card">
  <div class="card-header">
	    <span class="pill">5</span> Start from a ticket
  </div>
  <div class="card-body stack">
	    <p>
	      Create a GitHub issue with the outcome you want. Yeet imports it into the
	      <strong>GitHub source-of-truth inbox</strong>, assigns a role from labels, and runs the agent.
	    </p>
	    <p>
	      Use labels such as <code>role:coder</code>, <code>yeet2:implementer</code>, <code>p1</code>,
	      or <code>blocked</code> to steer ownership, priority, and state. Agents can also emit
	      delegated tickets when a parent ticket needs to be split.
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
      The autonomy loop dispatches tasks in stage order: Architect → Implementer → Tester → Coder → QA → Reviewer.
      Each stage runs as an isolated job in its own git worktree, so stages never interfere with each
      other. Use Tickets as the first view for active work; open Jobs when you need raw logs,
      artifact summaries, and stage verdicts.
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
      Blocked tasks appear at the top of Tickets, where you can decide whether to resolve, retry,
      or dismiss them from the same queue.
    </p>
    <p>
      In Supervised mode and when human-approval gates are configured, PRs and merges wait for
      explicit sign-off. Review pending decision tickets from Tickets; those queues now live in the
      ticket model.
    </p>
    <div class="token-row">
      <a class="btn" href="/tickets">Open tickets</a>
    </div>
  </div>
</section>

<section class="card">
  <div class="card-header">
    <span class="pill">8</span> Monitor ongoing work
  </div>
  <div class="card-body stack">
    <p>
      The Overview dashboard shows the company-level picture: current board item, agent roster,
      ticket pressure, and projects to watch. Tickets is the default daily queue. Workers shows
      executor heartbeat and availability — stale or offline workers will stall the queue.
    </p>
    <p>
      Every autonomy decision is written to the project's Chat tab as a decision log entry. This gives
      you a full audit trail of what the loop decided and why, without needing to dig through raw logs.
    </p>
    <div class="token-row">
      <a class="btn secondary" href="/">Back to overview</a>
      <a class="btn secondary" href="/tickets">Open tickets</a>
      <a class="btn secondary" href="/workers">View workers</a>
    </div>
  </div>
</section>
