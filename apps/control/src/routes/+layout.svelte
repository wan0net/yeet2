<script lang="ts">
  import "../app.css";
  import PlatformBar from "$lib/ui/PlatformBar.svelte";
</script>

<div class="app-shell">
  <PlatformBar />
  <main class="app-main">
    <slot />
  </main>
</div>
