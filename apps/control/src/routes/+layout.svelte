<script lang="ts">
  import "../app.css";
  import PlatformBar from "$lib/ui/PlatformBar.svelte";
  import ControlSidebar from "$lib/ui/ControlSidebar.svelte";
</script>

<div class="app-shell">
  <PlatformBar />
  <div class="app-frame">
    <ControlSidebar />
    <main class="app-main">
      <slot />
    </main>
  </div>
</div>
