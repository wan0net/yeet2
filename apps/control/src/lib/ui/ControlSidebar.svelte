<script lang="ts">
  import { page } from "$app/state";

  const projectId = $derived((() => {
    const match = page.url.pathname.match(/^\/projects\/([^\/]+)/);
    return match ? match[1] : null;
  })());

  const isProjectRoute = $derived(projectId !== null && projectId !== "new");
</script>

{#if isProjectRoute}
<aside class="control-sidebar">
  <section class="sidebar-group">
    <div class="sidebar-group-title">Project</div>
    <nav class="sidebar-nav">
      <a href="/projects/{projectId}" class="sidebar-link" class:sidebar-link--active={page.url.pathname === `/projects/${projectId}` && !page.url.searchParams.get("tab")}>Overview</a>
      <a href="/projects/{projectId}?tab=agents" class="sidebar-link" class:sidebar-link--active={page.url.searchParams.get("tab") === "agents"}>Agents</a>
      <a href="/projects/{projectId}?tab=chat" class="sidebar-link" class:sidebar-link--active={page.url.searchParams.get("tab") === "chat"}>Chat</a>
      <a href="/projects/{projectId}?tab=office" class="sidebar-link" class:sidebar-link--active={page.url.searchParams.get("tab") === "office"}>Office</a>
      <a href="/projects/{projectId}/constitution" class="sidebar-link" class:sidebar-link--active={page.url.pathname.includes("/constitution")}>Constitution</a>
    </nav>
  </section>
</aside>
{/if}
