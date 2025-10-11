<script lang="ts">
  import { get, writable, type Unsubscriber } from "svelte/store";
  import Panel from "../panel.svelte";
  import { onDestroy, onMount } from "svelte";
  import type { TetrisEnv } from "tetris/src/tetris_env";
  import { Tetromino } from "tetris/src/tetromino";
  import { listen } from "@tauri-apps/api/event";
  import {
    currentField,
    currentOverlayField,
    FieldType,
    overlayFieldComponent,
    OverlayFieldType,
  } from "../field";
  import {
    currentFieldIndex,
    currentFieldNode,
  } from "../../../../app/stores/data";
  import { tetrominoBlockTextures } from "../modules/tetrisBoard.svelte";

  let disabled = writable(false);
  let unListen: Unsubscriber;

  onMount(async () => {
    unListen = currentField.subscribe((value) => {
      disabled.set(value === FieldType.TetrisEdit ? false : true);
    });

    document.addEventListener("onupdatehold", handleUpdateHold);

    let hold = currentFieldNode.get()?.hold;
    updateHold(hold ?? Tetromino.Empty);
  });

  onDestroy(() => {
    unListen();
    document.removeEventListener("onupdatehold", handleUpdateHold);
  });

  let hold = writable("");

  function handleUpdateHold(event: Event) {
    const customEvent = event as CustomEvent;
    updateHold(customEvent.detail);
  }

  function updateHold(type: Tetromino) {
    hold.set(tetrominoBlockTextures[type]);
  }

  function on_click() {
    if (get(disabled)) return;

    if (get(currentOverlayField) === OverlayFieldType.TetrominoSelectHold) {
      currentOverlayField.set(OverlayFieldType.None);
    } else {
      currentOverlayField.set(OverlayFieldType.TetrominoSelectHold);
    }
  }
</script>

<Panel title="Hold">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    id="container"
    role="button"
    tabindex="-1"
    on:click={on_click}
    class:disabled={$disabled}
    class:selected={$currentOverlayField ===
      OverlayFieldType.TetrominoSelectHold && !$disabled}
  >
    {#if $hold !== ""}
      <img src={$hold} alt="hold" draggable="false" />
    {/if}
  </div>
</Panel>

<style>
  #container {
    width: 95%;
    height: 60px;
    background-color: #1c1c1c;
    box-sizing: border-box;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid #1c7ad200;
  }

  #container:hover:not(.disabled) {
    border: 1px solid #1c7ad2;
  }

  #container.disabled {
    cursor: not-allowed;
  }

  #container img {
    width: 90%;
  }

  *:focus {
    outline: none;
  }

  #container.selected:not(.disabled) {
    border: 1px solid #1c7ad2;
  }
</style>
