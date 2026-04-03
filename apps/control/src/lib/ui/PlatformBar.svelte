<script lang="ts">
  import { page } from "$app/state";

  const items = [
    { href: "/", label: "yeet2", exact: true },
    { href: "/projects", label: "Projects" },
    { href: "/jobs", label: "Jobs" },
    { href: "/tasks", label: "Tasks" },
    { href: "/missions", label: "Missions" },
    { href: "/approvals", label: "Approvals" },
    { href: "/blockers", label: "Blockers" },
    { href: "/workers", label: "Workers" }
  ] as const satisfies ReadonlyArray<{ href: string; label: string; exact?: boolean }>;

  function isActive(href: string, exact = false): boolean {
    const pathname = page.url.pathname;
    return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  }
</script>

<header class="platform-bar">
  <nav aria-label="Primary" class="pb-nav">
    {#each items as item}
      <a
        aria-current={isActive(item.href, "exact" in item ? item.exact === true : false) ? "page" : undefined}
        class:pb-app--active={isActive(item.href, "exact" in item ? item.exact === true : false)}
        class="pb-app"
        href={item.href}
      >
        <span class="pb-mark"></span>
        <span class="pb-label">{item.label}</span>
      </a>
    {/each}
  </nav>

  <div class="pb-right">
    <span class="top-note">autonomous software factory</span>
    <span class="pill">10.42.10.101</span>
  </div>
</header>
