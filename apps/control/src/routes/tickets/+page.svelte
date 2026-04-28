<script lang="ts">
  import type { PageData } from "./$types";
  import Markdown from "$lib/ui/Markdown.svelte";

  let { data }: { data: PageData } = $props();

  type TicketTone = "danger" | "warn" | "info" | "success" | "purple" | "";

  type Ticket = {
    id: string;
    kind: "approval" | "blocker" | "task" | "job";
    title: string;
    projectId: string;
    projectName: string;
    missionTitle: string | null;
    owner: string | null;
    status: string;
    summary: string;
    href: string;
    primaryAction: string;
    createdAt: string | null;
    tone: TicketTone;
    priority: number;
  };

  const isRunning = (status: string) => status === "running" || status === "in_progress";
  const isDone = (status: string) => status === "complete" || status === "completed" || status === "succeeded";

  function approvalTicket(approval: Record<string, unknown>): Ticket {
    const projectId = String(approval.projectId || "");
    const blockerId = String(approval.blockerId || approval.id || "");
    return {
      id: `approval-${blockerId || projectId}`,
      kind: "approval",
      title: String(approval.blockerTitle || "Human review required"),
      projectId,
      projectName: String(approval.projectName || "Unknown project"),
      missionTitle: String(approval.missionTitle || "") || null,
      owner: String(approval.taskAgentRole || "") || null,
      status: String(approval.blockerStatus || "open"),
      summary: String(approval.blockerRecommendation || approval.blockerContext || "Waiting for an operator decision."),
      href: "/approvals",
      primaryAction: "Review",
      createdAt: String(approval.createdAt || "") || null,
      tone: "purple",
      priority: 0
    };
  }

  function blockerTicket(entry: PageData["blockers"][number]): Ticket {
    const open = entry.blocker.status === "open";
    return {
      id: `blocker-${entry.blocker.id}`,
      kind: "blocker",
      title: entry.blocker.title,
      projectId: entry.projectId,
      projectName: entry.projectName,
      missionTitle: entry.missionTitle,
      owner: null,
      status: entry.blocker.status,
      summary: entry.blocker.recommendation || entry.blocker.context || "No blocker context recorded.",
      href: "/blockers",
      primaryAction: open ? "Resolve" : "Open",
      createdAt: entry.blocker.createdAt,
      tone: open ? "danger" : "success",
      priority: open ? 1 : 6
    };
  }

  function taskTicket(entry: PageData["tasks"][number]): Ticket {
    const status = entry.task.status;
    const dispatchable = entry.task.dispatchable ?? false;
    return {
      id: `task-${entry.task.id}`,
      kind: "task",
      title: entry.task.title,
      projectId: entry.projectId,
      projectName: entry.projectName,
      missionTitle: entry.missionTitle,
      owner: entry.task.assignedRoleDefinitionLabel || entry.task.agentRole,
      status,
      summary: entry.task.description || entry.task.dispatchBlockedReason || "No task description recorded.",
      href: `/projects/${entry.projectId}`,
      primaryAction: "Open project",
      createdAt: null,
      tone: status === "blocked" ? "danger" : isRunning(status) ? "info" : dispatchable ? "success" : isDone(status) ? "" : "warn",
      priority: status === "blocked" ? 2 : isRunning(status) ? 3 : dispatchable ? 4 : isDone(status) ? 8 : 5
    };
  }

  function jobTicket(entry: PageData["jobs"][number]): Ticket {
    const status = entry.job.status;
    return {
      id: `job-${entry.job.id}`,
      kind: "job",
      title: entry.taskTitle,
      projectId: entry.projectId,
      projectName: entry.projectName,
      missionTitle: entry.missionTitle,
      owner: entry.job.assignedRoleDefinitionLabel || entry.taskAgentRole,
      status,
      summary: entry.job.artifactSummary || entry.job.branchName || "Job execution is tracked with logs and artifacts.",
      href: `/jobs/${entry.job.id}`,
      primaryAction: "View job",
      createdAt: entry.job.startedAt,
      tone: status === "failed" ? "danger" : isRunning(status) ? "info" : isDone(status) ? "success" : "",
      priority: isRunning(status) ? 3 : status === "failed" ? 2 : 7
    };
  }

  const approvalTickets = $derived((data.approvals as Record<string, unknown>[]).map(approvalTicket));
  const blockerTickets = $derived(data.blockers.map(blockerTicket));
  const taskTickets = $derived(data.tasks.map(taskTicket));
  const activeJobTickets = $derived(data.jobs.filter((entry) => !isDone(entry.job.status)).map(jobTicket));
  const tickets = $derived(
    [...approvalTickets, ...blockerTickets, ...taskTickets, ...activeJobTickets].sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority;
      return (right.createdAt || "").localeCompare(left.createdAt || "");
    })
  );
  const openTickets = $derived(tickets.filter((ticket) => !isDone(ticket.status)));
  const approvalCount = $derived(approvalTickets.filter((ticket) => ticket.status === "open").length);
  const blockerCount = $derived(blockerTickets.filter((ticket) => ticket.status === "open").length);
  const activeCount = $derived(tickets.filter((ticket) => isRunning(ticket.status)).length);
</script>

{#if data.error}
  <section class="card" style="border-color: var(--color-status-error);">
    <div class="card-body">{data.error}</div>
  </section>
{/if}

<section class="page-header">
  <div class="stack">
    <span class="eyebrow">Ticket system</span>
    <div>
      <h1>Tickets</h1>
      <p>One work queue for agent tasks, blockers, approvals, running jobs, and handoffs.</p>
    </div>
  </div>
  <div class="token-row">
    <a class="btn" href="/approvals">Review approvals</a>
    <a class="btn secondary" href="/blockers">Blockers</a>
    <a class="btn secondary" href="/tasks">Legacy tasks</a>
  </div>
</section>

<section class="metrics">
  <div class="metric">
    <div class="metric-kicker">Open tickets</div>
    <div class="metric-value">{openTickets.length}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Approvals</div>
    <div class="metric-value">{approvalCount}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Blockers</div>
    <div class="metric-value">{blockerCount}</div>
  </div>
  <div class="metric">
    <div class="metric-kicker">Active work</div>
    <div class="metric-value">{activeCount}</div>
  </div>
</section>

<section class="workbench">
  <aside class="workbench-panel">
    <div class="card-header">Command filters</div>
    <div class="card-body stack">
      <a class="filter-chip active" href="/tickets">
        <span>All work</span>
        <strong>{tickets.length}</strong>
      </a>
      <a class="filter-chip" href="/approvals">
        <span>Board approvals</span>
        <strong>{approvalTickets.length}</strong>
      </a>
      <a class="filter-chip" href="/blockers">
        <span>Blocked agents</span>
        <strong>{blockerTickets.length}</strong>
      </a>
      <a class="filter-chip" href="/jobs">
        <span>Execution traces</span>
        <strong>{activeJobTickets.length}</strong>
      </a>
    </div>
  </aside>

  <section class="ticket-stream">
    {#if tickets.length === 0}
      <div class="empty-state">No tickets are available yet.</div>
    {:else}
      {#each tickets as ticket}
        <article class="ticket-card">
          <div class="ticket-main">
            <div class="ticket-stripe {ticket.tone}"></div>
            <div class="stack">
              <div class="token-row">
                <span class="pill {ticket.tone}">{ticket.kind}</span>
                <span class="pill">{ticket.status}</span>
                {#if ticket.owner}
                  <span class="pill info">{ticket.owner}</span>
                {/if}
              </div>
              <div>
                <h2>{ticket.title}</h2>
                <p>{ticket.projectName}{ticket.missionTitle ? ` · ${ticket.missionTitle}` : ""}</p>
              </div>
              <Markdown content={ticket.summary} />
            </div>
          </div>
          <div class="ticket-actions">
            <a class="btn secondary" href={ticket.href}>{ticket.primaryAction}</a>
            <a class="btn outline" href={`/projects/${ticket.projectId}`}>Project</a>
          </div>
        </article>
      {/each}
    {/if}
  </section>
</section>
