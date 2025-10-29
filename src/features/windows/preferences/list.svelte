<script lang="ts">
  import { dndzone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  const flipDurationMs = 50;

  export let items: any[] = [];
  export let applyPanelPreset:
    | ((type: string, items: any[]) => void)
    | undefined;
  export let type: string;

  function handleSort(e: Event) {
    items = (e as CustomEvent).detail.items;
    console.log(items);
    // Only call applyPanelPreset on finalize event
    if (
      (e as CustomEvent).type === "finalize" &&
      applyPanelPreset &&
      type !== "available"
    ) {
      applyPanelPreset(type, items);
    }
  }
</script>

<section
  use:dndzone={{ items, flipDurationMs }}
  on:consider={handleSort}
  on:finalize={handleSort}
>
  {#each items as item (item.id)}
    <div animate:flip={{ duration: flipDurationMs }}>
      {item.id}
    </div>
  {/each}
</section>

<style>
  div {
    height: 1.5em;
    width: 9em;
    font-size: 13px;
    text-align: center;
    border: 1px solid white;
    color: white;
    margin: 0.2em;
    padding: 0.3em;
    background-color: #2b2b2b;
    border-radius: 11px;
    margin-bottom: 5px;
    transition:
      transform 0.2s cubic-bezier(0.4, 0.2, 0.2, 1),
      box-shadow 0.2s;
  }
  div:hover {
    transform: scale(1.08) translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    background-color: #353535;
  }
  section {
  }
</style>
