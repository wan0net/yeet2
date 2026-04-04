<script lang="ts">
  import { page } from "$app/state";

  type NavItem = {
    href: string;
    label: string;
    exact?: boolean;
  };

  type NavGroup = {
    title: string;
    items: NavItem[];
  };

  const groups: NavGroup[] = [
    {
      title: "Control",
      items: [
        { href: "/", label: "Overview", exact: true },
        { href: "/guide", label: "Get started" },
        { href: "/projects", label: "All projects" },
        { href: "/projects/new", label: "Add project" }
      ]
    },
    {
      title: "Execution",
      items: [
        { href: "/jobs", label: "Jobs" },
        { href: "/tasks", label: "Tasks" },
        { href: "/missions", label: "Missions" }
      ]
    },
    {
      title: "Interventions",
      items: [
        { href: "/approvals", label: "Approvals" },
        { href: "/blockers", label: "Blockers" },
        { href: "/workers", label: "Workers" }
      ]
    }
  ];

  function isActive(href: string, exact = false): boolean {
    const pathname = page.url.pathname;
    return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  }
</script>

<aside class="control-sidebar">
  {#each groups as group}
    <section class="sidebar-group">
      <div class="sidebar-group-title">{group.title}</div>
      <nav class="sidebar-nav" aria-label={group.title}>
        {#each group.items as item}
          <a
            href={item.href}
            class="sidebar-link"
            class:sidebar-link--active={isActive(item.href, item.exact === true)}
            aria-current={isActive(item.href, item.exact === true) ? "page" : undefined}
          >
            {item.label}
          </a>
        {/each}
      </nav>
    </section>
  {/each}
</aside>
