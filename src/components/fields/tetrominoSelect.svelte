<script lang="ts">
  import { onMount } from "svelte";
  import { get, writable } from "svelte/store";
  import {
    fieldIndex,
    fields,
    history,
    overlayBoardViewContent,
    OverrideBoardViewContentType,
  } from "../../store.ts";
  import {
    convertFromTetromino,
    convertToTetromino,
    tetrominoBlockTextures,
  } from "./tetrisBoard.svelte";
  import { Tetromino } from "tetris/src/tetromino";
  import type { TetrisEnv } from "tetris/src/tetris_env";
  import { emitTo, listen } from "@tauri-apps/api/event";
  import type { History } from "../../history.ts";
  import { t } from "../../translations/translations.ts";

  let input_value = writable("");
  overlayBoardViewContent.subscribe((value) => {
    if (value === OverrideBoardViewContentType.TetrominoSelectHold) {
      let value = convertFromTetromino(get(fields)[get(fieldIndex)].hold);
      input_value.set(value);

      const inputElement = document.getElementById("tetromino-input");
      inputElement?.focus();
    } else if (value === OverrideBoardViewContentType.TetrominoSelectNext) {
      let value = get(fields)[get(fieldIndex)].next.map((item) =>
        convertFromTetromino(item)
      );
      input_value.set(value.join(""));

      const inputElement = document.getElementById("tetromino-input");
      inputElement?.focus();
    }
  });

  /*listen<string>("onupdatenext", (event) => {
		if (event.payload != null) {
			let value = get(fields)[get(field_index)].next.map((item) =>
				convertFromTetromino(item),
			);
			input_value.set(value.join(""));
		}
	});*/

  onMount(() => {
    const inputElement = document.getElementById("tetromino-input");
    inputElement?.focus();
  });

  function handleClick(param: string) {
    if (
      get(overlayBoardViewContent) ===
      OverrideBoardViewContentType.TetrominoSelectHold
    ) {
      input_value.set(param);
    } else if (
      get(overlayBoardViewContent) ===
      OverrideBoardViewContentType.TetrominoSelectNext
    ) {
      input_value.update((value) => value + param);
    }

    handleChange(get(input_value));
  }

  function handleChange(event: any) {
    let input = event?.target?.value ?? event;

    const allowedChars = "szjltoi";
    input = input
      .toLowerCase()
      .split("")
      .filter((char: string) => allowedChars.includes(char))
      .join("");

    if (
      get(overlayBoardViewContent) ===
      OverrideBoardViewContentType.TetrominoSelectHold
    ) {
      let type = convertToTetromino(input.toLowerCase());

      fields.update((tetris_fields: TetrisEnv[]) => {
        tetris_fields[get(fieldIndex)].hold = type;

        return tetris_fields;
      });

      history.update((history: History) => {
        history.add(
          "Hold",
          get(fields)[get(fieldIndex)].clone(),
          input.toLowerCase()
        );
        return history;
      });
    } else if (
      get(overlayBoardViewContent) ===
      OverrideBoardViewContentType.TetrominoSelectNext
    ) {
      let types = input
        .toLowerCase()
        .split("")
        .map((char: string) => convertToTetromino(char));

      fields.update((tetris_fields: TetrisEnv[]) => {
        tetris_fields[get(fieldIndex)].next = types;

        return tetris_fields;
      });

      history.update((history: History) => {
        history.add(
          "Next",
          (get(fields)[get(fieldIndex)] as TetrisEnv).clone(),
          input.toLowerCase()
        );
        return history;
      });
    }
  }
</script>

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
  <div tabindex="-1">
    <div style="margin-top: 20px;padding:10px;">
      {$t("common.tetromino-description")}
    </div>
    <input
      id="tetromino-input"
      type="text"
      spellcheck="false"
      bind:value={$input_value}
      oninput={handleChange}
      placeholder="szjltoi"
    />
    <div id="image-container">
      <button onclick={() => handleClick("s")}>
        <img
          src={tetrominoBlockTextures[0]}
          alt="S Tetromino"
          draggable="false"
        />
      </button>
      <button onclick={() => handleClick("z")}>
        <img
          src={tetrominoBlockTextures[1]}
          alt="Z Tetromino"
          draggable="false"
        />
      </button>
      <button onclick={() => handleClick("l")}>
        <img
          src={tetrominoBlockTextures[2]}
          alt="L Tetromino"
          draggable="false"
        />
      </button>
      <button onclick={() => handleClick("j")}>
        <img
          src={tetrominoBlockTextures[3]}
          alt="J Tetromino"
          draggable="false"
        />
      </button>
      <button onclick={() => handleClick("t")}>
        <img
          src={tetrominoBlockTextures[4]}
          alt="T Tetromino"
          draggable="false"
        />
      </button>
      <button onclick={() => handleClick("o")}>
        <img
          src={tetrominoBlockTextures[5]}
          alt="O Tetromino"
          draggable="false"
        />
      </button>
      <button onclick={() => handleClick("i")}>
        <img
          src={tetrominoBlockTextures[6]}
          alt="I Tetromino"
          draggable="false"
        />
      </button>
    </div>
  </div>
</div>

<style>
  :root {
    background-color: #2f2f2f;
  }

  #image-container {
    display: flex;
    justify-content: center;
    width: 100%;
    flex-wrap: wrap;
  }

  #image-container > button {
    background-color: #1c1c1c;
    border: 1px solid #3e3e3e;
    box-sizing: border-box;
    width: 100px;
    height: 100px;
  }

  #image-container img {
    width: 80px;
    height: auto;
  }

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

  #container > div {
    height: 100%;
    background-color: transparent;
    display: flex;
    align-items: center;
    flex-direction: column;
  }

  #container input {
    width: 70%;
    margin: 15px;
  }

  * {
    outline: none;
  }
</style>
