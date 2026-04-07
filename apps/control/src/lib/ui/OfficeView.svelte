<script lang="ts">
  import type { AgentPresenceRoleSnapshot } from "$lib/project-detail";

  let { staff }: { staff: AgentPresenceRoleSnapshot[] } = $props();
</script>

<p class="office-mobile-msg">Switch to pipeline view on mobile.</p>
<div class="office-grid">
  {#each staff as role}
    <div class="desk-card desk-card--{role.status}">
      <div class="desk-header">
        <span class="desk-label">{role.label}</span>
        <span class="status-dot status-dot--{role.status}"></span>
      </div>

      {#if role.currentTask}
        <div class="speech-bubble">
          <span class="speech-task">{role.currentTask.task.title}</span>
        </div>
      {:else}
        <div class="desk-idle">Standing by</div>
      {/if}

      {#if role.blockerCount > 0}
        <span class="blocked-badge">{role.blockerCount} blocker{role.blockerCount > 1 ? "s" : ""}</span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .office-mobile-msg {
    display: none;
    font-size: 0.875rem;
    color: var(--color-text-secondary, #888);
    padding: var(--space-4, 1rem);
    text-align: center;
  }

  .office-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-4, 1rem);
    padding: var(--space-4, 1rem);
  }

  @media (max-width: 640px) {
    .office-grid {
      display: none;
    }
    .office-mobile-msg {
      display: block;
    }
  }

  .desk-card {
    background: var(--color-surface-raised, #1e1e2e);
    border: 1px solid var(--color-border, #313244);
    border-radius: 10px;
    padding: var(--space-3, 0.75rem);
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    position: relative;
    transition: border-color 0.2s;
  }

  .desk-card--active {
    border-color: var(--color-accent, #89b4fa);
  }

  .desk-card--blocked {
    border-color: var(--amber, #f9e2af);
  }

  .desk-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2, 0.5rem);
  }

  .desk-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-primary, #cdd6f4);
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
    line-height: 1.2;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--color-border, #585b70);
  }

  .status-dot--active {
    background: var(--color-accent, #89b4fa);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .status-dot--active {
      animation: none;
    }
  }

  .status-dot--blocked {
    background: var(--amber, #f9e2af);
  }

  .status-dot--queued {
    background: var(--green, #a6e3a1);
  }

  .status-dot--idle {
    background: var(--color-border, #585b70);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.3); }
  }

  .speech-bubble {
    background: var(--color-surface, #181825);
    border: 1px solid var(--color-border, #313244);
    border-radius: 6px;
    padding: var(--space-2, 0.5rem);
    position: relative;
    font-size: 0.78rem;
    color: var(--color-text-secondary, #a6adc8);
    line-height: 1.4;
  }

  .speech-bubble::before {
    content: "";
    position: absolute;
    top: -6px;
    left: 14px;
    width: 10px;
    height: 10px;
    background: var(--color-surface, #181825);
    border-left: 1px solid var(--color-border, #313244);
    border-top: 1px solid var(--color-border, #313244);
    transform: rotate(45deg);
  }

  .speech-task {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .desk-idle {
    font-size: 0.78rem;
    color: var(--color-text-secondary, #585b70);
    font-style: italic;
  }

  .blocked-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--amber-bg, #1e1e2e);
    background: var(--amber, #f9e2af);
    border: 1px solid var(--amber-border, transparent);
    border-radius: 4px;
    padding: 2px 6px;
    align-self: flex-start;
  }
</style>
