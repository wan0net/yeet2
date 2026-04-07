<script lang="ts">
  let {
    message,
    ondismiss
  }: { message: string | null | undefined; ondismiss?: () => void } = $props();
</script>

{#if message}
  <div class="error-banner" role="alert">
    <span class="error-banner-icon" aria-hidden="true">⚠</span>
    <span class="error-banner-text">{message}</span>
    {#if ondismiss}
      <button type="button" class="error-banner-close" aria-label="Dismiss error" onclick={ondismiss}>×</button>
    {/if}
  </div>
{/if}

<style>
  .error-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    margin-bottom: 16px;
    border: 1px solid var(--red-border, var(--color-status-error));
    background: var(--red-bg, var(--color-surface));
    color: var(--red, var(--color-status-error));
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    animation: error-banner-slide-in 0.2s ease-out;
  }

  @keyframes error-banner-slide-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .error-banner {
      animation: none;
    }
  }

  .error-banner-icon {
    font-size: 16px;
    line-height: 1.2;
  }

  .error-banner-text {
    flex: 1;
    line-height: 1.4;
    word-break: break-word;
  }

  .error-banner-close {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .error-banner-close:hover {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
</style>
