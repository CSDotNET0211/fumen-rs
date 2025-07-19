<script lang="ts">
  export let title = "Noname";
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div
  id="main-panel"
  onmouseenter={(e) => e.stopPropagation()}
  onmouseup={(e) => e.stopPropagation()}
  onmousedown={(e) => e.stopPropagation()}
  onmouseout={(e) => e.stopPropagation()}
>
  <div id="title">{title}</div>
  <slot><div>no content found.</div></slot>
</div>

<style>
  #main-panel {
    color: #f0f0f0;
    position: fixed;
    bottom: 30px;
    left: 10px;
    background-color: #1f1f1f;
    border: 1px solid #414141;
    border-radius: 3px;
    padding: 10px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    width: 200px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;
    pointer-events: all;
  }

  #main-panel #title {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 15px;
    color: #fff;
  }

  #main-panel::-webkit-scrollbar {
    width: 5px;
  }
  #main-panel::-webkit-scrollbar-track {
    background: #1c1c1c;
  }
  #main-panel::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  #main-panel::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
</style>
