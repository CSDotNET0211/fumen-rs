<script lang="ts">
  import { get } from "svelte/store";
  import { Piece } from "tetris-fumen/lib/defines";
  import { Tetromino } from "tetris/src/tetromino";
  import {
    boardViewContent,
    BoardViewContentType,
    fieldIndex,
    fields,
    history,
    overlayBoardViewContent,
    OverrideBoardViewContentType,
  } from "../../store";
  import { decoder, type Pages } from "tetris-fumen";
  import { BaseDirectory, writeFile } from "@tauri-apps/plugin-fs";
  import { onMount } from "svelte";
  import { emitTo } from "@tauri-apps/api/event";
  import { getOffScreenCanvasImage } from "./tetrisBoard.svelte";
  import type { History } from "../../history";
  import { t } from "../../translations/translations.ts";
  import { TetrisEnv } from "tetris/src/tetris_env";

  export let fumenPages: Pages | null;
  let selectedPage = 0;
  let totalPages = 0;
  let thumbnailSrc: string;

  onMount(async () => {
    if (fumenPages) {
      totalPages = fumenPages.length;
      await updateThumbnail();
    }
  });

  function closePanel() {
    overlayBoardViewContent.set(OverrideBoardViewContentType.None);
  }

  function handlePageChange(event: Event) {
    selectedPage = parseInt((event.target as HTMLInputElement).value);
    updateThumbnail();
  }

  async function updateThumbnail() {
    if (fumenPages == null) return;
    let field = getFieldFromFumenPage(fumenPages, selectedPage);
    thumbnailSrc = (await getOffScreenCanvasImage(
      field,
      undefined,
      undefined
    ))!;
  }

  function getFieldFromFumenPage(
    fumenPages: Pages,
    selectedPage: number
  ): Tetromino[] {
    if (fumenPages == null) return [];

    let pieces = (fumenPages[selectedPage].field as any).field.field.pieces;
    let field = new Array(TetrisEnv.WIDTH * TetrisEnv.HEIGHT).fill(
      Tetromino.Empty
    );

    for (let i = 0; i < pieces.length; i++) {
      const x = i % TetrisEnv.WIDTH;
      const y = Math.floor(i / TetrisEnv.WIDTH);
      const piece = pieces[x + (TetrisEnv.HEIGHT - 1 - y) * TetrisEnv.WIDTH];

      switch (piece) {
        case Piece.Empty:
          field[i] = Tetromino.Empty;
          break;
        case Piece.I:
          field[i] = Tetromino.I;
          break;
        case Piece.L:
          field[i] = Tetromino.L;
          break;
        case Piece.O:
          field[i] = Tetromino.O;
          break;
        case Piece.Z:
          field[i] = Tetromino.Z;
          break;
        case Piece.T:
          field[i] = Tetromino.T;
          break;
        case Piece.J:
          field[i] = Tetromino.J;
          break;
        case Piece.S:
          field[i] = Tetromino.S;
          break;
        case Piece.Gray:
          field[i] = Tetromino.Garbage;
          break;
        default:
          console.error("Invalid piece");
          break;
      }
    }

    return field;
  }

  async function applySelectedPage() {
    if (fumenPages == null) return;

    let field = getFieldFromFumenPage(fumenPages, selectedPage);

    emitTo("main", "pastefield", field);
    history.update((history: History) => {
      history.add(
        $t("common.history-paste-fumen"),
        get(fields)[get(fieldIndex)].clone(),
        ""
      );
      return history;
    });
    closePanel();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div
  id="container"
  tabindex="-1"
  onmouseenter={(e) => e.stopPropagation()}
  onmouseup={(e) => e.stopPropagation()}
  onmousedown={(e) => e.stopPropagation()}
  onmouseout={(e) => e.stopPropagation()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="import-panel">
    <h2>{$t("common.fumen-import-panel-import-fumen")}</h2>
    <div style="display: flex; align-items: center;">
      <label for="page-select"
        >{$t("common.fumen-import-panel-select-page")} (0-{totalPages -
          1}):</label
      >
      <input
        type="number"
        id="page-select"
        min="0"
        max={totalPages - 1}
        bind:value={selectedPage}
        oninput={handlePageChange}
      />
      <div class="thumbnail">
        <img src={thumbnailSrc} alt="Selected Page Thumbnail" />
      </div>
    </div>
    <div style="display: flex;gap: 5px;">
      <button onclick={closePanel}
        >{$t("common.fumen-import-panel-cancel")}</button
      >
      <button onclick={applySelectedPage}
        >{$t("common.fumen-import-panel-apply")}</button
      >
    </div>
  </div>
</div>

<style>
  #container {
    width: 100%;
    height: 100%;
    backdrop-filter: blur(5px);
    position: absolute;
    top: 0;
    left: 0;
    background-color: rgba(0, 0, 0, 0.1);
    pointer-events: all;
  }

  .import-panel {
    backdrop-filter: blur(5px);
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .thumbnail {
    margin-left: 20px;
  }
  .thumbnail img {
    width: auto;
    height: 200px;
  }
  button {
    margin-top: 20px;
    padding: 10px 20px;
    border: none;
    border-radius: 2px;
    background-color: #1c7ad2;
    color: #ffffff;
    cursor: pointer;
  }
  button:hover {
    background-color: #1a70bf;
  }
  /* Add styles for the cancel button */
  button:nth-of-type(1) {
    background-color: #313131;
  }
  button:nth-of-type(1):hover {
    background-color: #3c3c3c;
  }
</style>
