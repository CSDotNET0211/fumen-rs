<script lang="ts">
  import { get, writable } from "svelte/store";
  import Panel from "../panel.svelte";
  import {
    boardViewContent,
    BoardViewContentType,
    fieldIndex,
    fields,
    history,
    overlayBoardViewContent,
    OverrideBoardViewContentType,
  } from "../../store";
  import { onDestroy, onMount } from "svelte";
  import type { TetrisEnv } from "tetris/src/tetris_env";
  import type { Tetromino } from "tetris/src/tetromino";
  import { listen } from "@tauri-apps/api/event";
  import type { History } from "../../history";
  import { tetrominoBlockTextures } from "../fields/tetrisBoard.svelte";

  let disabled = writable(false);
  let unlisten: any;

  boardViewContent.subscribe((value) => {
    disabled.set(value === BoardViewContentType.TetrisEdit ? false : true);
  });

  onMount(async () => {
    unlisten = await listen<string>("onupdatehold", (event) => {
      update_hold(event.payload as unknown as Tetromino);
    });

    let hold = get(fields)[get(fieldIndex)].hold;
    update_hold(hold);
  });

  onDestroy(() => {
    unlisten();
  });

  let hold = writable("");

  function update_hold(type: Tetromino) {
    hold.set(tetrominoBlockTextures[type]);
  }

  function on_click() {
    if (get(disabled)) return;

    if (
      get(overlayBoardViewContent) ===
      OverrideBoardViewContentType.TetrominoSelectHold
    ) {
      overlayBoardViewContent.set(OverrideBoardViewContentType.None);
    } else {
      overlayBoardViewContent.set(
        OverrideBoardViewContentType.TetrominoSelectHold
      );
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
    class:selected={$overlayBoardViewContent ===
      OverrideBoardViewContentType.TetrominoSelectHold && !$disabled}
  >
    {#if $hold !== ""}
      <img src={$hold} alt="hold" draggable="false" />
    {/if}
  </div>
</Panel>

<style>
  #container {
    width: 90%;
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
