<script lang="ts">
  import { page } from "$app/state";
</script>

<header class="platform-bar">
  <a class="pb-brand" href="/">
    <span class="pb-mark"></span>
    <span>
      <span class="pb-title">yeet2</span>
      <span class="pb-subtitle">control plane</span>
    </span>
  </a>

  <nav class="pb-nav">
    <a href="/" class="pb-link" class:pb-link--active={page.url.pathname === "/"}>Overview</a>
    <a href="/projects" class="pb-link" class:pb-link--active={page.url.pathname.startsWith("/projects")}>Projects</a>
    <a href="/jobs" class="pb-link" class:pb-link--active={page.url.pathname.startsWith("/jobs")}>Jobs</a>
    <a href="/tasks" class="pb-link" class:pb-link--active={page.url.pathname.startsWith("/tasks")}>Tasks</a>
    <a href="/approvals" class="pb-link" class:pb-link--active={page.url.pathname === "/approvals"}>Approvals</a>
    <a href="/blockers" class="pb-link" class:pb-link--active={page.url.pathname === "/blockers"}>Blockers</a>
    <a href="/workers" class="pb-link" class:pb-link--active={page.url.pathname === "/workers"}>Workers</a>
    <a href="/guide" class="pb-link" class:pb-link--active={page.url.pathname === "/guide"}>Guide</a>
  </nav>
</header>
