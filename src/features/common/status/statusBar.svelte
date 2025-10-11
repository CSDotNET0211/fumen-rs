<script>
  import { writable } from "svelte/store";
  import { statusPanels, statusPopupComponent } from "./status";
</script>

<div id="panel">
  {#each $statusPanels ?? [] as Panel}
    <svelte:component this={Panel} />
  {/each}
</div>

<div style="position: fixed;">
  <svelte:component this={$statusPopupComponent} />
</div>

<style>
  #panel {
    position: relative;
    display: flex;
    width: 100%;
    height: 20px;
    background-color: #1c7ad2;
    flex-direction: row;
  }
</style>
