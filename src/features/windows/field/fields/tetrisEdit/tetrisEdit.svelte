<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import { FederatedPointerEvent } from "pixi.js";

  import { get } from "svelte/store";
  import { Tetromino } from "tetris/src/tetromino.js";
  import { emitTo, listen } from "@tauri-apps/api/event";
  import { TetrisEnv } from "tetris/src/tetris_env";
  import {
    currentFieldIndex,
    currentFieldNode,
  } from "../../../../../app/stores/data";
  import {
    autoFillQueue,
    selectedMino,
    suppressFieldUpdateNotification,
  } from "../../../../../app/stores/misc";
  import TetrisBoard, {
    mount as mountTetrisBoard,
    tetrisBoardSprites,
    unmount as unMountTetrisBoard,
    type CellSprite,
  } from "../../modules/tetrisBoard.svelte";
  import { t } from "../../../../../translations/translations";
  import { history } from "../../../../../app/stores/history";
  import type { History } from "../../../../../history";

  let is_left_clicking = false;
  let erase_mode = false;
  //履歴追加用
  let boardBeforeEdit: Tetromino[];

  let unlistenApplyField: any;
  let unlistenAutoCanvasUpdater: any;
  let unlistenApplyBot: any;
  let unlistenClearBot: any;
  let unlistenRequestBotField: any;
  let unlistenAutoFillQueue: any;

  let specialBlocks: number[] | null = null;

  function countBoardDiff(b1: Tetromino[], b2: Tetromino[]): number {
    let diffCount = 0;
    for (let i = 0; i < b1.length; i++) {
      if (b1[i] !== b2[i]) {
        diffCount++;
      }
    }
    return diffCount;
  }

  function draw(pos: number, erase_mode: boolean) {
    currentFieldNode.update((field) => {
      if (field == null) return field;

      if (erase_mode) {
        field.board[pos] = Tetromino.Empty;
      } else {
        field.board[pos] = get(selectedMino);
      }
      return field;
    });
  }

  async function setupEventListeners() {
    unlistenAutoFillQueue = autoFillQueue.subscribe((value) => {
      if (value) {
        //ネクストを5つになるまで埋める
        currentFieldNode.update((field) => {
          if (field == null) return field;

          while (field.next.length < 5) {
            field.next.push(field.getBag());
          }

          return field;
        });

        autoFillQueue.set(false);
      }
    });

    unlistenApplyField = await listen<TetrisEnv>(
      "applyfield",
      handleHistoryEvent
    );
    unlistenAutoCanvasUpdater = currentFieldNode.subscribe(handleFieldUpdate);

    unlistenApplyBot = await listen<{
      board: Tetromino[];
      ghosts: boolean[];
    }>("onapplybot", (event) => {
      handleApplyBot(event.payload.board, event.payload.ghosts);
    });
    unlistenClearBot = await listen<string>("onclearbot", handleClearBot);

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown);

    for (let i = 0; i < tetrisBoardSprites.length; i++) {
      let cell = tetrisBoardSprites[i];
      cell.on("pointerdown", handlePointerDown);
      cell.on("pointerenter", handlePointerEnter);
      cell.on("pointerup", handlePointerUp);
      cell.on("pointerupoutside", handlePointerUpOutside);
    }

    unlistenRequestBotField = await listen<TetrisEnv>("requestbotfield", () => {
      emitTo("main", "responsebotfield", get(currentFieldNode));
    });
  }

  function handleHistoryEvent(event: any) {
    const instance = new TetrisEnv();
    Object.assign(instance, event.payload);

    if (event.payload != null) {
      currentFieldNode.set(instance);
    }
  }

  function handleFieldUpdate(env: TetrisEnv | null) {
    if (env == null) return;

    emitTo("main", "onupdatefield", { board: env.board });
    emitTo("main", "onupdatehold", env.hold);
    emitTo("main", "onupdatenext", env.next);
  }

  function handlePointerDown(event: FederatedPointerEvent) {
    suppressFieldUpdateNotification.set(true);
    boardBeforeEdit = [...get(currentFieldNode)!.board];

    if (event.button === 0) {
      const pos = (event.target as CellSprite).pos;
      erase_mode = get(currentFieldNode)!.board[pos] !== Tetromino.Empty;

      if (get(selectedMino) == 8) {
        specialBlocks = [];
        handleSpecialBlockPointerDown(pos);
      } else {
        specialBlocks = null;
        draw(pos, erase_mode);
      }
    }
  }

  function handlePointerEnter(event: FederatedPointerEvent) {
    if (is_left_clicking) {
      const pos = (event.target as CellSprite).pos;

      if (get(selectedMino) == 8) {
        handleSpecialBlockPointerEnter(pos);
      } else {
        draw(pos, erase_mode);
      }
    }
  }

  function handleSpecialBlockPointerDown(pos: number) {
    if (!erase_mode) {
      specialBlocks!.push(pos);
    }
    updateOverrideBoard();
  }

  function handleSpecialBlockPointerEnter(pos: number) {
    if (
      !erase_mode &&
      get(currentFieldNode)!.board[pos] === Tetromino.Empty &&
      !specialBlocks!.includes(pos) &&
      specialBlocks!.length < 4
    ) {
      specialBlocks!.push(pos);
      updateOverrideBoard();

      if (specialBlocks!.length == 4) {
        applySpecialBlocks();
      }
    }
  }

  function updateOverrideBoard() {
    const overrideBoard = new Array(TetrisEnv.WIDTH * TetrisEnv.HEIGHT).fill(
      undefined
    );
    for (const block of specialBlocks!) {
      overrideBoard[block] = 8;
    }
    const board = get(currentFieldNode)!.board;
    emitTo("main", "onupdatefield", { board, override: overrideBoard });
  }

  function applySpecialBlocks() {
    specialBlocks!.sort((a, b) => a - b);
    const minPos = specialBlocks![0];
    const positions = specialBlocks!
      .map((pos) => {
        const adjustedPos = pos - minPos;
        const x = adjustedPos % TetrisEnv.WIDTH;
        const y = Math.floor(adjustedPos / TetrisEnv.WIDTH);
        return `${x}${y}`;
      })
      .join("");

    const TETROMINO_MAP = new Map([
      ["00900111", Tetromino.T],
      ["00900102", Tetromino.T],
      ["00102011", Tetromino.T],
      ["00011102", Tetromino.T],
      ["00109001", Tetromino.S],
      ["00011112", Tetromino.S],
      ["00101121", Tetromino.Z],
      ["00900191", Tetromino.Z],
      ["00100111", Tetromino.O],
      ["00011121", Tetromino.J],
      ["00100102", Tetromino.J],
      ["00102021", Tetromino.J],
      ["00019102", Tetromino.J],
      ["00010212", Tetromino.L],
      ["00102001", Tetromino.L],
      ["00101112", Tetromino.L],
      ["00809001", Tetromino.L],
      ["00010203", Tetromino.I],
      ["00102030", Tetromino.I],
    ]);

    const tetromino = TETROMINO_MAP.get(positions);
    if (tetromino == null) {
      console.error("Invalid tetromino");
      return;
    }

    currentFieldNode.update((env: TetrisEnv | null) => {
      if (env) {
        const field = env.board;
        for (const block of specialBlocks!) {
          field[block] = tetromino;
        }
        env.board = field;
      }
      return env;
    });

    history.update((history: History) => {
      history.add(
        $t("common.history-field"),
        get(currentFieldNode)!.clone(),
        Tetromino[tetromino]
      );
      return history;
    });
  }

  function handlePointerUp(event: FederatedPointerEvent) {
    if (event.button === 0 && is_left_clicking && specialBlocks === null) {
      history.update((history: History) => {
        let count = countBoardDiff(
          boardBeforeEdit,
          get(currentFieldNode)!.board
        );
        if (count == 0) return history;

        let content: String;
        if (erase_mode) {
          content = `<span style="color: red;">-${count}</span>`;
        } else {
          content = `${Tetromino[get(selectedMino)]}<span style="color: green;"> +${count}</span>`;
        }

        history.add(
          $t("common.history-field"),
          get(currentFieldNode)!.clone(),
          content
        );
        return history;
      });

      is_left_clicking = false;
    }

    suppressFieldUpdateNotification.set(false);
    //TODO: さっきここで虚無更新
  }

  function handlePointerUpOutside(event: FederatedPointerEvent) {
    if (event.button === 0 && is_left_clicking && specialBlocks === null) {
      history.update((history: History) => {
        let count = countBoardDiff(
          boardBeforeEdit,
          get(currentFieldNode)!.board
        );
        if (count == 0) return history;

        let content: String;
        if (erase_mode) {
          content = `<span style="color: red;">-${count}</span>`;
        } else {
          content = `${Tetromino[get(selectedMino)]}<span style="color: green;"> +${count}</span>`;
        }

        history.add(
          $t("common.history-field"),
          get(currentFieldNode)!.clone(),
          content
        );
        return history;
      });
    }

    suppressFieldUpdateNotification.set(false);
    //TODO: さっきここで虚無更新
  }

  onMount(async () => {
    await mountTetrisBoard();
    await setupEventListeners();

    autoFillQueue.set(false);
    const env = get(currentFieldNode);
    if (env == null) return;

    emitTo("main", "onupdatefield", { board: env.board });
    emitTo("main", "onupdatehold", env.hold);
    emitTo("main", "onupdatenext", env.next);
  });

  onDestroy(() => {
    unMountTetrisBoard();
    unlistenApplyField();
    unlistenAutoCanvasUpdater();
    unlistenApplyBot();
    unlistenClearBot();
    unlistenRequestBotField();
    unlistenAutoFillQueue();

    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("keydown", handleKeyDown);
  });

  function handleKeyDown(this: Window, ev: KeyboardEvent) {
    if (/^[1-9]$/.test(ev.key)) {
      selectedMino.set(parseInt(ev.key) - 1);
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.button === 0) {
      is_left_clicking = true;
    }
  }

  function handleMouseUp(event: MouseEvent) {
    if (event.button === 0) {
      is_left_clicking = false;
    }
  }

  function handleClearBot(): void {
    emitTo("main", "onupdatefield", { board: get(currentFieldNode)!.board });
  }

  function handleApplyBot(board: Tetromino[], ghosts: boolean[]): void {
    emitTo("main", "onupdatefield", {
      board: board,
      ghosts: ghosts,
    });
  }
</script>

<TetrisBoard />

<style>
</style>
