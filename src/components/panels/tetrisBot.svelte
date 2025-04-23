<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Panel from "../panel.svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { fieldIndex, fields } from "../../store.ts";
  import { get } from "svelte/store";
  import { Tetromino } from "tetris/src/tetromino";
  import { emitTo, listen } from "@tauri-apps/api/event";
  import { TetrisEnv } from "tetris/src/tetris_env";
  import { t } from "../../translations/translations.ts";

  let bots = ["ColdClear", "Zetris"];
  let selectedBot = bots[0];
  let thinkingTime = 1000;
  let maxNextPieces = 5;
  let unlistenResponseField: any;
  let isLoading = false;

  onMount(async () => {
    await invoke("get_bot_dlls").then((result) => {
      bots = result as string[];
    });

    await setupEventListeners();
  });

  onDestroy(() => {
    unlistenResponseField();
  });

  async function setupEventListeners() {
    unlistenResponseField = await listen<any>(
      "responsebotfield",
      async (event) => {
        isLoading = true;
        try {
          let env = Object.assign(new TetrisEnv(), event.payload);
          let field = "";
          for (let y = 0; y < TetrisEnv.HEIGHT; y++) {
            for (let x = 0; x < TetrisEnv.WIDTH; x++) {
              field +=
                env.board[x + (TetrisEnv.HEIGHT - 1 - y) * TetrisEnv.WIDTH] ==
                Tetromino.Empty
                  ? "0"
                  : "1";
            }
          }
          if (env.countClearableLines() != 0) {
            alert($t("common.bot-alert-clear-line"));
            return;
          }

          let hold =
            typeof env.hold === "number"
              ? Tetromino[env.hold].toString().toLowerCase()
              : env.hold.toString().toLowerCase();
          let pieces = env.next
            .slice(0, maxNextPieces)
            .map((t: any) =>
              typeof t === "number"
                ? Tetromino[t].toString().toLowerCase()
                : t.toString().toLowerCase()
            )
            .join("");

          if (pieces.length + (hold === "empty" ? 0 : 1) < 2) {
            alert($t("common.bot-alert-not-enough-pieces"));
            return;
          }

          let incoming = 0;
          await invoke("search_bot_best", {
            botName: selectedBot,
            field: field,
            hold: hold,
            b2b: env.btb,
            combo: env.combo,
            pieces: pieces,
            incoming: incoming,
          }).then((result) => {
            function convertI32ToTetromino(value: number) {
              switch (value) {
                case 0:
                  return Tetromino.I;
                case 1:
                  return Tetromino.O;
                case 2:
                  return Tetromino.T;
                case 3:
                  return Tetromino.L;
                case 4:
                  return Tetromino.J;
                case 5:
                  return Tetromino.S;
                case 6:
                  return Tetromino.Z;
                default:
                  return Tetromino.Empty;
              }
            }

            const typedResult = result as number[];
            let ghosts = Array(TetrisEnv.WIDTH * TetrisEnv.HEIGHT).fill(false);
            for (let i = 0; i < 8; i += 2) {
              let x = typedResult[i];
              let y = typedResult[i + 1];
              ghosts[x + y * TetrisEnv.WIDTH] = true;
            }

            let board = env.board;
            for (let i = 0; i < 4; i++) {
              board[typedResult[i * 2] + typedResult[i * 2 + 1] * 10] =
                convertI32ToTetromino(typedResult[8]);
            }

            emitTo("main", "onapplybot", {
              board: board,
              ghosts: ghosts,
            });
          });
        } finally {
          isLoading = false;
        }
      }
    );
  }
</script>

<Panel title="Bot">
  <div id="container">
    <div id="bot-selection">
      <label for="bot-select">{$t("common.bot-select-bot")}</label>
      <select id="bot-select" bind:value={selectedBot} tabindex="-1">
        {#each bots as bot}
          <option value={bot}>{bot}</option>
        {/each}
      </select>
    </div>
    <div id="control-container">
      <button
        class="action-button"
        on:click={() => {
          if (isLoading) return;

          if (!selectedBot) {
            alert("Please select a bot!");
            return;
          }

          isLoading = true;
          emitTo("main", "requestbotfield");
        }}
        disabled={isLoading}
        tabindex="-1"
      >
        {#if isLoading}
          <img src="loading.gif" alt="Loading..." style="height:100%" />
        {:else}
          {$t("common.bot-search")}
        {/if}
      </button>
      <button
        class="action-button"
        on:click={() => {
          emitTo("main", "onclearbot");
        }}
        tabindex="-1">{$t("common.bot-clear")}</button
      >
    </div>
    <details id="advanced-settings" tabindex="-1">
      <summary class="toggle-button" tabindex="-1"
        >{$t("common.bot-details")}</summary
      >
      <div class="advanced-setting">
        <label for="thinking-time">{$t("common.bot-thinking-time")}</label>
        <input
          id="thinking-time"
          type="number"
          bind:value={thinkingTime}
          tabindex="-1"
        />
      </div>
      <div class="advanced-setting">
        <label for="max-next-pieces">{$t("common.bot-max-next-pieces")}</label>
        <input
          id="max-next-pieces"
          type="number"
          min="1"
          max="12"
          defaultValue="5"
          bind:value={maxNextPieces}
          tabindex="-1"
        />
      </div>
    </details>
  </div>
</Panel>

<style>
  #container {
    width: 90%;
    background-color: #1c1c1c;
    display: flex;
    flex-direction: column;
    padding: 10px;
    box-sizing: border-box;
    font-size: 12px;
  }

  #bot-selection {
    margin-bottom: 10px;
  }

  #bot-select {
    width: 100%;
    padding: 5px;
    border-radius: 3px;
    border: 1px solid #3e3e3e;
    background-color: #2c2c2c;
    color: #cbcbcb;
    font-size: 10px;
  }

  #control-container {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
    flex-direction: column;
  }

  .action-button {
    background-color: #3e3e3e;
    color: #cbcbcb;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    height: 29px;
  }

  .action-button:hover {
    background-color: #5e5e5e;
  }

  #advanced-settings {
    margin-top: 10px;
  }

  .toggle-button {
    background-color: #3e3e3e;
    color: #cbcbcb;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
  }

  .toggle-button:hover {
    background-color: #5e5e5e;
  }

  .advanced-setting {
    margin-top: 10px;
  }

  .advanced-setting label {
    display: block;
    margin-bottom: 5px;
    font-size: 12px;
  }

  .advanced-setting input {
    width: 60px;
    padding: 5px;
    border-radius: 3px;
    border: 1px solid #3e3e3e;
    background-color: #2c2c2c;
    color: #cbcbcb;
  }
</style>
