<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { currentTheme, toggleTheme, type ThemeMode } from "$lib/theme";

  let mobileMenuOpen = $state(false);
  let theme = $state<ThemeMode>("light");

  onMount(() => {
    theme = currentTheme();
  });

  // Close the mobile menu whenever the page changes (after navigation).
  $effect(() => {
    void page.url.pathname;
    mobileMenuOpen = false;
  });

  function handleThemeToggle() {
    theme = toggleTheme();
  }
</script>

<header class="platform-bar">
  <a class="pb-brand" href="/">
    <span class="pb-mark"></span>
    <span>
      <span class="pb-title">yeet2</span>
      <span class="pb-subtitle">control plane</span>
    </span>
  </a>

  <nav id="platform-bar-nav" class="pb-nav" class:pb-nav--open={mobileMenuOpen}>
    <a href="/" class="pb-link" class:pb-link--active={page.url.pathname === "/"}>Overview</a>
    <a href="/projects" class="pb-link" class:pb-link--active={page.url.pathname.startsWith("/projects")}>Projects</a>
    <a href="/tickets" class="pb-link" class:pb-link--active={page.url.pathname.startsWith("/tickets")}>Tickets</a>
    <a href="/missions" class="pb-link" class:pb-link--active={page.url.pathname.startsWith("/missions")}>Missions</a>
    <a href="/jobs" class="pb-link" class:pb-link--active={page.url.pathname.startsWith("/jobs")}>Jobs</a>
    <a href="/workers" class="pb-link" class:pb-link--active={page.url.pathname === "/workers"}>Workers</a>
    <a href="/audit" class="pb-link" class:pb-link--active={page.url.pathname === "/audit"}>Audit</a>
    <a href="/guide" class="pb-link" class:pb-link--active={page.url.pathname === "/guide"}>Guide</a>
    <a href="/settings" class="pb-link" class:pb-link--active={page.url.pathname === "/settings"}>Settings</a>
  </nav>

  <button
    type="button"
    class="pb-theme-toggle"
    aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    onclick={handleThemeToggle}
  >
    <span class="pb-theme-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
  </button>

  <button
    type="button"
    class="pb-menu-toggle"
    aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
    aria-expanded={mobileMenuOpen}
    aria-controls="platform-bar-nav"
    onclick={() => { mobileMenuOpen = !mobileMenuOpen; }}
  >
    <span class="pb-menu-icon" aria-hidden="true">{mobileMenuOpen ? "✕" : "☰"}</span>
  </button>
</header>

<style>
  .pb-theme-toggle {
    display: inline-flex;
    width: 38px;
    height: 38px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-subtle);
    color: var(--text);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    margin-left: 8px;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, transform 0.15s;
  }

  .pb-theme-toggle:hover {
    background: var(--bg-hover);
  }

  .pb-theme-toggle:active {
    transform: scale(0.96);
  }

  .pb-theme-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .pb-menu-toggle {
    display: none;
    width: 38px;
    height: 38px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-subtle);
    color: var(--text);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    margin-left: 8px;
  }

  .pb-menu-toggle:hover {
    background: var(--bg-hover);
  }

  .pb-menu-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  @media (max-width: 720px) {
    .pb-menu-toggle {
      display: inline-flex;
    }

    :global(.platform-bar) {
      flex-wrap: wrap;
    }

    .pb-nav {
      display: none;
      flex-basis: 100%;
      flex-direction: column;
      gap: 4px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }

    .pb-nav--open {
      display: flex;
    }

    :global(.pb-link) {
      width: 100%;
      padding: 10px 12px;
      font-size: 14px;
    }
  }
</style>
