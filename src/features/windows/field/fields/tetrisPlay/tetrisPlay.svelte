<script lang="ts">
  import { onMount, getContext, onDestroy } from "svelte";
  import { TetrisEnv } from "tetris/src/tetris_env";
  //import { isLeftClicking } from "../routes/+page.svelte";

  import { get, type Unsubscriber } from "svelte/store";
  import { Tetromino } from "tetris/src/tetromino.js";
  import { DIFFS, SHAPES } from "tetris/src/constants.ts";
  import { TetrisConfig } from "tetris/src/config.ts";
  import type { GameConfig } from "../../../../../app/gameConfig";
  import { shortcuts } from "../../../../../core/shortcuts/shortcuts";
  import {
    autoApplyField,
    autoFillQueue,
  } from "../../../../../app/stores/misc";
  import {
    currentField,
    currentOverlayField,
    FieldType,
    OverlayFieldType,
  } from "../../field";
  import { gameConfig } from "../../../../../app/stores/config";
  import TetrisBoard, {
    mount,
    tetrisBoardApp,
    unmount,
  } from "../../modules/tetrisBoard.svelte";
  import {
    currentFieldIndex,
    currentFieldNode,
  } from "../../../../../app/stores/data";
  import { t } from "../../../../../translations/translations";
  import { history } from "../../../../../app/stores/history";
  import type { History } from "../../../../../history";

  let current_frame: number;
  let env: TetrisEnv | null = null;
  let gameConfigObj: GameConfig;
  let tetrisConfigObj: TetrisConfig;

  let unlistenAutoFillQueue: Unsubscriber;
  let unlistenSaveConfig: Unsubscriber;

  let overrideBoard: Tetromino[] | null = null;
  let overrideGhosts: boolean[] | null = null;

  let ghostBoard: Tetromino[] = new Array(
    TetrisEnv.WIDTH * TetrisEnv.HEIGHT
  ).fill(null);
  let ghosts: boolean[] = new Array(TetrisEnv.WIDTH * TetrisEnv.HEIGHT).fill(
    false
  );

  let originalEnv: TetrisEnv | null = null;

  function handleKeyDown(event: KeyboardEvent) {
    if (event.repeat) return;

    const key = `${event.ctrlKey ? "Ctrl+" : ""}${event.shiftKey ? "Shift+" : ""}${event.altKey ? "Alt+" : ""}${event.key.toUpperCase()}`;
    const id = shortcuts.getIdByKey(key);
    if (id != undefined) {
      return;
    }

    switch (event.code) {
      case gameConfigObj.keymaps?.get("TetrisPlay")?.["Right"].key:
        handleClearBot();
        env?.keyDown("moveRight");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["Left"].key:
        handleClearBot();
        env?.keyDown("moveLeft");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["RotateCW"].key:
        handleClearBot();
        env?.keyDown("rotateCW");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["RotateCCW"].key:
        handleClearBot();
        env?.keyDown("rotateCCW");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["Rotate180"].key:
        handleClearBot();
        env?.keyDown("rotate180");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["Hold"].key:
        handleClearBot();
        env?.keyDown("hold");
        if (get(autoApplyField) && env != null) {
          updateFieldForPlay(env, "Hold");
        }

        if (get(autoFillQueue) && env != null) {
          while (env.next.length < 5) {
            env.next.push(env.getBag());
          }
        }
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["HardDrop"].key:
        handleClearBot();
        env?.keyDown("hardDrop");
        if (get(autoApplyField) && env != null) {
          updateFieldForPlay(env, "HardDrop");
        }

        if (get(autoFillQueue) && env != null) {
          while (env.next.length < 5) {
            env.next.push(env.getBag());
          }
        }
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["SoftDrop"].key:
        handleClearBot();
        env?.keyDown("softDrop");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["ResetGame"].key:
        handleClearBot();
        resetGame();
        break;
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.repeat) return;

    switch (event.code) {
      case gameConfigObj.keymaps?.get("TetrisPlay")?.["Right"].key:
        env?.keyUp("moveRight");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["Left"].key:
        env?.keyUp("moveLeft");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["RotateCW"].key:
        env?.keyUp("rotateCW");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["RotateCCW"].key:
        env?.keyUp("rotateCCW");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["Rotate180"].key:
        env?.keyUp("rotate180");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["Hold"].key:
        env?.keyUp("hold");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["HardDrop"].key:
        env?.keyUp("hardDrop");
        break;

      case gameConfigObj.keymaps?.get("TetrisPlay")?.["SoftDrop"].key:
        env?.keyUp("softDrop");
        break;
    }
  }

  onMount(async () => {
    await mount();
    currentOverlayField.set(OverlayFieldType.None);

    unlistenSaveConfig = gameConfig.subscribe((config) => {
      tetrisConfigObj = new TetrisConfig(
        config!.das!,
        config!.arr!,
        config!.sdf!,
        config!.rotationType!
      );

      if (env) {
        env.setConfig(tetrisConfigObj);
      }
    });

    unlistenAutoFillQueue = autoFillQueue.subscribe((value) => {
      if (value && env != null) {
        while (env.next.length < 5) {
          env.next.push(env.getBag());
        }
      }
    });

    document.addEventListener("applyfield", handleApplyField);
    document.addEventListener("resetgame", handleResetGame);
    document.addEventListener("onapplybot", (event) => handleApplyBot(event));
    document.addEventListener("onclearbot", handleClearBot);
    document.addEventListener("requestbotfield", handleRequestBotField);

    gameConfigObj = get(gameConfig)!;
    current_frame = 0;

    if (get(currentFieldNode) == null) {
      throw new Error("Current field node is null");
    }
    originalEnv = get(currentFieldNode)!.clone();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    tetrisBoardApp!.ticker.maxFPS = 60;

    resetGame();

    tetrisBoardApp!.ticker.add(() => {
      current_frame++;

      if (env !== null) {
        env.update();

        let board = env.board.slice();
        if (env.current) {
          const shape = SHAPES[env.current.type][env.current.rotation];
          const diff = DIFFS[env.current.type];

          for (let i = 0; i < shape.length; i++) {
            const posX = env.current.x + shape[i].x + diff.x;
            const posY = env.current.y + shape[i].y + diff.y;

            board[posY * TetrisEnv.WIDTH + posX] = env.current.type;
          }
        }

        let ghostY = env.getGhostY();
        ghosts.fill(false);

        if (env.current && get(gameConfig)?.ghostPiece) {
          const shape = SHAPES[env.current.type][env.current.rotation];
          const diff = DIFFS[env.current.type];

          for (let i = 0; i < shape.length; i++) {
            const posX = env.current.x + shape[i].x + diff.x;
            const posY = ghostY! + shape[i].y + diff.y;

            if (board[posY * TetrisEnv.WIDTH + posX] === Tetromino.Empty) {
              board[posY * TetrisEnv.WIDTH + posX] = env.current.type;
              ghosts[posY * TetrisEnv.WIDTH + posX] = true;
            }
          }
        }

        if (overrideBoard) {
          document.dispatchEvent(
            new CustomEvent("onupdatefield", {
              detail: { board: overrideBoard, ghosts: overrideGhosts },
            })
          );
        } else {
          document.dispatchEvent(
            new CustomEvent("onupdatefield", {
              detail: { board: board, ghosts: ghosts },
            })
          );
        }
        document.dispatchEvent(
          new CustomEvent("onupdatehold", {
            detail: env.hold,
          })
        );
        document.dispatchEvent(
          new CustomEvent("onupdatenext", {
            detail: env.next,
          })
        );
      }
    });
  });

  function handleApplyField(event: Event) {
    const customEvent = event as CustomEvent;

    const instance = new TetrisEnv();
    Object.assign(instance, customEvent.detail);

    if (customEvent.detail != null) {
      env = instance;
      env.start(tetrisConfigObj);
    }

    let clone = instance.clone();

    if (clone?.current) {
      clone.next.unshift(clone.current.type);
    }

    currentFieldNode.setValue(clone);
  }

  onDestroy(() => {
    document.removeEventListener("applyfield", handleApplyField);
    document.removeEventListener("resetgame", handleResetGame);
    document.removeEventListener("onapplybot", (event) =>
      handleApplyBot(event)
    );
    document.removeEventListener("onclearbot", handleClearBot);
    document.removeEventListener("requestbotfield", handleRequestBotField);

    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    unmount();
    unlistenAutoFillQueue();
    unlistenSaveConfig();
  });

  function updateFieldForPlay(field: TetrisEnv, reason: string | undefined) {
    currentFieldNode.update((env: TetrisEnv | null) => {
      let clone = field.clone();

      if (field.current) {
        clone.next.unshift(field.current.type);
      }
      env = clone;

      history.update((history: History) => {
        history.add(
          $t("common.history-apply-field-in-playmode"),
          clone.clone(),
          reason ? `: ${reason}` : ""
        );
        return history;
      });
      return env;
    });
  }
  function handleResetGame() {
    resetGame();
  }

  function handleRequestBotField() {
    let clone = env!.clone();

    if (clone?.current) {
      clone.next.unshift(clone.current.type);
    }

    document.dispatchEvent(
      new CustomEvent("responsebotfield", {
        detail: clone,
      })
    );
  }

  function resetGame(envPayload: TetrisEnv | null = null) {
    if (envPayload) {
      env = envPayload;
    } else if (originalEnv) {
      env = originalEnv.clone();
    } else {
      env = get(currentFieldNode)!.clone();
    }

    tetrisConfigObj = new TetrisConfig(
      gameConfigObj.das!,
      gameConfigObj.arr!,
      gameConfigObj.sdf!,
      gameConfigObj.rotationType!
    );
    env.start(tetrisConfigObj);

    if (get(autoApplyField) && env != null) {
      updateFieldForPlay(env, "Reset");
    }
  }

  function handleApplyBot(event: Event) {
    const customEvent = event as CustomEvent;
    overrideBoard = customEvent.detail.board;
    overrideGhosts = customEvent.detail.ghosts;
  }

  function handleClearBot() {
    overrideBoard = null;
    overrideGhosts = null;
  }
</script>

<TetrisBoard />
