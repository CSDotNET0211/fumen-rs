<script>
  import { get } from "svelte/store";
  import {
    currentFieldIndex,
    currentFieldNode,
  } from "../../../../app/stores/data";
  import Panel from "../panel.svelte";
  import { Tetromino } from "tetris/src/tetromino";
  import { TetrisEnv } from "tetris/src/tetris_env";

  /**
   * Moves all lines up by one, removing the top line and adding an empty line at the bottom
   */
  function clearLineUp() {
    currentFieldNode.update((env) => {
      if (!env) return env;

      // Remove the top line and add an empty line at the bottom
      env.board.splice(0, TetrisEnv.WIDTH);
      env.board.push(...new Array(TetrisEnv.WIDTH).fill(Tetromino.Empty));
      return env;
    });
  }

  function clearLine() {
    currentFieldNode.update((env) => {
      if (!env) return env;

      env.clearLines(false);
      return env;
    });
  }

  function clearLineDown() {
    currentFieldNode.update((env) => {
      if (!env) return env;

      env.clearLines(true);
      return env;
    });
  }
</script>

<Panel title="Board Edit">
  <div id="container">
    <button class="action-button" on:click={clearLine}>
      <img src="/clear-line.svg" alt="Clear Line" style="height: 100%;" />
    </button>
    <button class="action-button" on:click={clearLineDown}>
      <img
        src="/clear-line-down.svg"
        alt="Clear Line Down"
        style="height: 100%;"
      />
    </button>
    <button class="action-button" on:click={clearLineUp}>
      <img src="/clear-line-up.svg" alt="Clear Line Up" style="height: 100%;" />
    </button>
    <button class="action-button">
      <img src="/clear-line.svg" alt="Clear Line" style="height: 100%;" />
    </button>
  </div>
</Panel>

<style>
  #container {
    width: 95%;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    justify-content: center;
    gap: 5px;
  }
  .action-button {
    background-color: #1c1c1c;
    color: #cbcbcb;
    border: none;
    padding: 7px 0px;
    border-radius: 3px;
    cursor: pointer;
    height: 40px;
    width: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
