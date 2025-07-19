<script lang="ts">
  import { currentWindow, WindowType } from "../../../../app/stores/window";
  import Panel from "../panel.svelte";

  function handleSwapClick() {
    currentWindow.set(WindowType.Canvas);
  }
</script>

<Panel title="Canvas">
  <button class="swap-btn" on:click={handleSwapClick}>Swap</button>
</Panel>

<style>
  .swap-btn {
    width: 100%;
    padding: 0.75em 0;
    font-size: 1rem;
    background: #4f8cff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .swap-btn:hover {
    background: #357ae8;
  }
</style>
