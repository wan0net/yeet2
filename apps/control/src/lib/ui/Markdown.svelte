<script lang="ts">
  import { marked } from "marked";

  let { content = "", inline = false }: { content: string; inline?: boolean } = $props();

  const rendered = $derived((() => {
    if (!content) return "";
    try {
      return inline ? marked.parseInline(content) : marked.parse(content);
    } catch {
      return content;
    }
  })());
</script>

{#if inline}
  <span class="md-inline">{@html rendered}</span>
{:else}
  <div class="md-prose">{@html rendered}</div>
{/if}

<style>
  .md-prose :global(h1),
  .md-prose :global(h2),
  .md-prose :global(h3),
  .md-prose :global(h4) {
    margin-top: var(--space-3, 0.75rem);
    margin-bottom: var(--space-1, 0.25rem);
    font-weight: 600;
  }
  .md-prose :global(h1) { font-size: 1.25rem; }
  .md-prose :global(h2) { font-size: 1.125rem; }
  .md-prose :global(h3),
  .md-prose :global(h4) { font-size: 1rem; }
  .md-prose :global(p) { margin: var(--space-2, 0.5rem) 0; }
  .md-prose :global(ul),
  .md-prose :global(ol) {
    margin: var(--space-2, 0.5rem) 0;
    padding-left: var(--space-5, 1.25rem);
  }
  .md-prose :global(li) { margin-bottom: var(--space-1, 0.25rem); }
  .md-prose :global(code) {
    font-family: var(--font-mono, monospace);
    font-size: 0.875em;
    background: var(--color-surface-sunken, #1a1a1a);
    padding: 0.1em 0.3em;
    border-radius: var(--radius-sm, 0.25rem);
  }
  .md-prose :global(pre) {
    background: var(--color-surface-sunken, #1a1a1a);
    padding: var(--space-3, 0.75rem);
    border-radius: var(--radius-md, 0.5rem);
    overflow-x: auto;
    margin: var(--space-2, 0.5rem) 0;
  }
  .md-prose :global(pre code) {
    background: none;
    padding: 0;
  }
  .md-prose :global(blockquote) {
    border-left: 3px solid var(--color-border, #333);
    padding-left: var(--space-3, 0.75rem);
    margin: var(--space-2, 0.5rem) 0;
    opacity: 0.85;
  }
  .md-prose :global(a) { color: var(--color-accent, #60a5fa); }
  .md-prose :global(hr) {
    border: none;
    border-top: 1px solid var(--color-border, #333);
    margin: var(--space-3, 0.75rem) 0;
  }
  .md-inline :global(code) {
    font-family: var(--font-mono, monospace);
    font-size: 0.875em;
    background: var(--color-surface-sunken, #1a1a1a);
    padding: 0.1em 0.3em;
    border-radius: var(--radius-sm, 0.25rem);
  }
  .md-inline :global(a) { color: var(--color-accent, #60a5fa); }
</style>
