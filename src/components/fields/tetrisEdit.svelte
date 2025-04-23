<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import TetrisBoard, {
    tetrisBoardSprites,
    mount,
    unmount,
    type CellSprite,
  } from "./tetrisBoard.svelte";

  import { FederatedPointerEvent } from "pixi.js";
  import {
    fields,
    fieldIndex,
    history,
    autoFillQueue,
    suppressFieldUpdateNotification,
    selectedMino,
  } from "../../store.ts";
  import { get } from "svelte/store";
  import { Tetromino } from "tetris/src/tetromino.js";
  import type { History } from "../../history.ts";
  import { emitTo, listen } from "@tauri-apps/api/event";
  import { t } from "../../translations/translations.ts";
  import { TetrisEnv } from "tetris/src/tetris_env";

  let is_left_clicking = false;
  let erase_mode = false;
  //履歴追加用
  let boardBeforeEdit: Tetromino[];

  let unlistenPaste: any;
  let unlistenApplyField: any;
  let unlistenAutoupdater: any;
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
    fields.update((tetris_fields: TetrisEnv[]) => {
      if (erase_mode) {
        tetris_fields[get(fieldIndex)].board[pos] = Tetromino.Empty;
      } else {
        tetris_fields[get(fieldIndex)].board[pos] = get(selectedMino);
      }

      return tetris_fields;
    });
  }

  async function setupEventListeners() {
    unlistenAutoFillQueue = autoFillQueue.subscribe((value) => {
      if (value) {
        //ネクストを5つになるまで埋める
        fields.update((tetris_fields: TetrisEnv[]) => {
          let env = tetris_fields[get(fieldIndex)];
          while (env.next.length < 5) {
            env.next.push(env.getBag());
          }
          tetris_fields[get(fieldIndex)] = env;
          return tetris_fields;
        });

        autoFillQueue.set(false);
      }
    });

    unlistenApplyField = await listen<TetrisEnv>(
      "applyfield",
      handleHistoryEvent
    );
    unlistenAutoupdater = fields.subscribe(handleFieldUpdate);
    unlistenPaste = await listen<Tetromino[]>("pastefield", (event) => {
      handlePasteEvent(event.payload);
    });
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
      let env = get(fields)[get(fieldIndex)];
      emitTo("main", "responsebotfield", env);
    });
  }

  function handleHistoryEvent(event: any) {
    const instance = new TetrisEnv();
    Object.assign(instance, event.payload);

    if (event.payload != null) {
      fields.update((currentFields) => {
        currentFields[get(fieldIndex)] = instance;
        return currentFields;
      });
    }
  }

  function handleFieldUpdate(tetris_fields: TetrisEnv[]) {
    let env = tetris_fields[get(fieldIndex)];
    if (env == null) return;
    //console.log(env);

    emitTo("main", "onupdatefield", { board: env.board });
    emitTo("main", "onupdatehold", env.hold);
    emitTo("main", "onupdatenext", env.next);
  }
  function handlePointerDown(event: FederatedPointerEvent) {
    suppressFieldUpdateNotification.set(true);
    boardBeforeEdit = [...get(fields)[get(fieldIndex)].board];

    if (event.button === 0) {
      const pos = (event.target as CellSprite).pos;
      erase_mode = get(fields)[get(fieldIndex)].board[pos] !== Tetromino.Empty;

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
      get(fields)[get(fieldIndex)].board[pos] === Tetromino.Empty &&
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
    const board = get(fields)[get(fieldIndex)].board;
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

    fields.update((tetris_fields: TetrisEnv[]) => {
      const field = tetris_fields[get(fieldIndex)].board;
      for (const block of specialBlocks!) {
        field[block] = tetromino;
      }
      tetris_fields[get(fieldIndex)].board = field;
      return tetris_fields;
    });

    history.update((history: History) => {
      history.add(
        $t("common.history-field"),
        get(fields)[get(fieldIndex)].clone(),
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
          get(fields)[get(fieldIndex)].board
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
          get(fields)[get(fieldIndex)].clone(),
          content
        );
        return history;
      });

      is_left_clicking = false;
    }

    suppressFieldUpdateNotification.set(false);
    fields.update((tetris_fields: TetrisEnv[]) => {
      return tetris_fields;
    });
  }

  function handlePointerUpOutside(event: FederatedPointerEvent) {
    if (event.button === 0 && is_left_clicking && specialBlocks === null) {
      history.update((history: History) => {
        let count = countBoardDiff(
          boardBeforeEdit,
          get(fields)[get(fieldIndex)].board
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
          get(fields)[get(fieldIndex)].clone(),
          content
        );
        return history;
      });
    }

    suppressFieldUpdateNotification.set(false);
    fields.update((tetris_fields: TetrisEnv[]) => {
      return tetris_fields;
    });
  }

  onMount(async () => {
    await mount();
    await setupEventListeners();

    autoFillQueue.set(false);
    let tetris_fields = get(fields);
    const env = tetris_fields[get(fieldIndex)];
    if (env == null) return;

    emitTo("main", "onupdatefield", { board: env.board });
    emitTo("main", "onupdatehold", env.hold);
    emitTo("main", "onupdatenext", env.next);
  });

  onDestroy(() => {
    unmount();
    unlistenPaste();
    unlistenApplyField();
    unlistenAutoupdater();
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
    let board = get(fields)[get(fieldIndex)].board;
    emitTo("main", "onupdatefield", { board: board });
  }

  function handleApplyBot(board: Tetromino[], ghosts: boolean[]): void {
    emitTo("main", "onupdatefield", {
      board: board,
      ghosts: ghosts,
    });
  }

  function handlePasteEvent(field: Tetromino[]): void {
    fields.update((tetris_fields: TetrisEnv[]) => {
      tetris_fields[get(fieldIndex)].board = field;
      return tetris_fields;
    });
  }
</script>

<TetrisBoard />

<style>
</style>
