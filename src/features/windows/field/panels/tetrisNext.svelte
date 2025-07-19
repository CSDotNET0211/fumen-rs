<script lang="ts">
  import { get, writable } from "svelte/store";
  import Panel from "../panel.svelte";

  import { listen } from "@tauri-apps/api/event";
  import type { Tetromino } from "tetris/src/tetromino.ts";
  import { onDestroy, onMount } from "svelte";
  import {
    currentField,
    currentOverlayField,
    FieldType,
    OverlayFieldType,
  } from "../field";
  import { tetrominoBlockTextures } from "../modules/tetrisBoard.svelte";
  import { fieldIndex, fields } from "../../../../app/stores/data";

  let unlisten: any;

  onMount(async () => {
    unlisten = await listen<string>("onupdatenext", (event) => {
      update_next(event.payload as unknown as Tetromino[]);
    });

    let next = get(fields)[get(fieldIndex)].next;
    update_next(next);
  });

  onDestroy(() => {
    unlisten();
  });

  function update_next(value: Tetromino[]) {
    let data: string[] = [];
    for (let type of value) {
      let img = tetrominoBlockTextures[type];
      data.push(img);
    }

    next.set(data);
  }

  let disabled = writable(false);

  currentField.subscribe((value) => {
    disabled.set(value === FieldType.TetrisEdit ? false : true);
  });

  let next = writable<string[]>([]);

  async function on_click() {
    if (get(disabled)) return;

    if (get(currentOverlayField) === OverlayFieldType.TetrominoSelectNext) {
      currentOverlayField.set(OverlayFieldType.None);
    } else {
      currentOverlayField.set(OverlayFieldType.TetrominoSelectNext);
    }
  }
</script>

<Panel title="Next">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    id="container"
    role="button"
    tabindex="-1"
    on:click={on_click}
    class:disabled={$disabled}
    class:selected={$currentOverlayField ===
      OverlayFieldType.TetrominoSelectNext && !$disabled}
  >
    {#if $next.length != 0}
      {#each $next as item}
        <img
          src={item}
          alt="next"
          draggable="false"
          style="margin-bottom:2px;"
        />
      {/each}
    {/if}
  </div>
</Panel>

<style>
  #container {
    width: 95%;
    height: 300px;
    background-color: #1c1c1c;
    box-sizing: border-box;
    overflow-y: auto;
    border: 1px solid #1c7ad200;
    scrollbar-gutter: stable;
  }

  #container > img {
    width: 90%;
    -webkit-user-drag: none;
    user-select: none;
    -webkit-user-select: none;
    display: block;
    margin-left: auto;
    margin-right: auto;
  }

  #container:hover:not(.disabled) {
    border: 1px solid #1c7ad2;
  }

  #container.disabled {
    cursor: not-allowed;
  }

  #container::-webkit-scrollbar {
    width: 5px;
  }
  #container::-webkit-scrollbar-track {
    background: #1c1c1c;
  }
  #container::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  #container::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  *:focus {
    outline: none;
  }

  #container.selected:not(.disabled) {
    border: 1px solid #1c7ad2;
  }
</style>
