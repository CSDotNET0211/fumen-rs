<script lang="ts">
  import { onMount } from "svelte";
  import { get, writable, type Writable } from "svelte/store";
  import {
    currentField,
    currentOverlayField,
    fieldComponent,
    FieldType,
    overlayFieldComponent,
    OverlayFieldType,
    Panels,
    PanelType,
  } from "./field";
  import { gameConfig } from "../../../app/stores/config";

  let rightComponents: Writable<any[]> = writable([]);
  let leftComponents: Writable<any[]> = writable([]);

  onMount(() => {
    if (get(currentField) === FieldType.None) {
      currentField.set(FieldType.TetrisEdit);
    }

    currentOverlayField.set(OverlayFieldType.None);
  });

  gameConfig.subscribe(($config) => {
    const presets = $config!.panelPresets;
    if (presets) {
      const leftPreset = presets.presets[presets.currentPreset].left ?? [];
      const rightPreset = presets.presets[presets.currentPreset].right ?? [];

      leftComponents.set(
        leftPreset.map((name: string) => Panels.get(name as PanelType))
      );
      rightComponents.set(
        rightPreset.map((name: string) => Panels.get(name as PanelType))
      );
    }
  });
</script>

<div style="display: flex; height: 100%;">
  <div class="side_panel" style="flex-shrink: 0;">
    {#each $leftComponents as Component}
      <div>
        <Component></Component>
      </div>
    {/each}
  </div>

  <div style="flex-grow: 1; position: relative;background-color: #1c1c1c;">
    {#if $fieldComponent}
      <svelte:component this={$fieldComponent} />
    {/if}

    {#if $overlayFieldComponent != OverlayFieldType.None}
      <div
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"
      >
        <svelte:component this={$overlayFieldComponent} />
      </div>
    {/if}
  </div>

  <div class="side_panel" style="flex-shrink: 0;">
    {#each $rightComponents as Component}
      <div>
        <Component></Component>
      </div>
    {/each}
  </div>
</div>

<style>
  .side_panel {
    background-color: #2f2f2f;
    width: 110px;
    min-width: 110px;
    height: 100%;
    border-left: 1px solid #3e3e3e;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .side_panel::-webkit-scrollbar {
    width: 5px;
  }
  .side_panel::-webkit-scrollbar-track {
    background: #1c1c1c;
  }
  .side_panel::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  .side_panel::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
</style>
