<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import { FederatedPointerEvent } from "pixi.js";

  import { get, type Unsubscriber } from "svelte/store";
  import { Tetromino } from "tetris/src/tetromino.js";
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
    unmount,
    type CellSprite,
  } from "../../modules/tetrisBoard.svelte";
  import { t } from "../../../../../translations/translations";
  import { history } from "../../../../../app/stores/history";
  import type { History } from "../../../../../history";
  import { DBRef } from "bson";
  import { DatabaseNode } from "../../../../../core/nodes/DatabaseNode/databaseNode";
  import { getNodeDatabase } from "../../../../../core/nodes/db";

  let isLeftClicking = false;
  let erase_mode = false;
  let pointerIsDown = false;
  let isDragOver = false;

  let editBoard: Tetromino[];
  let updatedCoordinates: { [key: number]: Tetromino };

  //let unlistenAutoCanvasUpdater: Unsubscriber;
  let unlistenAutoFillQueue: Unsubscriber;

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
    if (erase_mode) editBoard[pos] = Tetromino.Empty;
    else editBoard[pos] = get(selectedMino);

    document.dispatchEvent(
      new CustomEvent("onupdatefield", {
        detail: { board: editBoard },
      }),
    );
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
    //unlistenAutoCanvasUpdater = currentFieldNode.subscribe(handleFieldUpdate);

    document.addEventListener("onUpdateFieldNode", handleFieldUpdate);

    document.addEventListener("applyfield", handleApplyFieldEvent);
    document.addEventListener("databaseLoaded", handleFieldUpdate);
    document.addEventListener("onapplybot", handleApplyBot);
    document.addEventListener("onclearbot", handleClearBot);
    document.addEventListener("requestbotfield", requestBotField);

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

    // ファイルドロップイベントリスナーを追加
    const tetrisBoardElement = document.querySelector(
      ".tetris-board-container",
    );
    if (tetrisBoardElement) {
      tetrisBoardElement.addEventListener("dragover", handleDragOver);
      tetrisBoardElement.addEventListener("dragleave", handleDragLeave);
      tetrisBoardElement.addEventListener("drop", handleFileDrop);
    }
  }

  function handleApplyBot(event: Event) {
    const payload = (event as CustomEvent).detail;

    document.dispatchEvent(
      new CustomEvent("onupdatefield", {
        detail: { board: payload.board, ghosts: payload.ghosts },
      }),
    );
  }

  function requestBotField() {
    const env = currentFieldNode.get();
    if (env == null) return;

    document.dispatchEvent(
      new CustomEvent("responsebotfield", { detail: env.clone() }),
    );
  }

  function handleApplyFieldEvent(event: Event) {
    const payload = (event as CustomEvent).detail;

    const instance = new TetrisEnv();
    Object.assign(instance, payload);

    if (payload != null) {
      currentFieldNode.set(instance);
    }
  }

  function handleFieldUpdate(event: Event) {
    if ((event as CustomEvent)?.detail?.id != get(currentFieldIndex)) return;

    let env = (event as CustomEvent)?.detail?.data;
    if (!env) {
      env = currentFieldNode.get();
    }

    if (env == null) return;

    document.dispatchEvent(
      new CustomEvent("onupdatefield", {
        detail: { board: env.board },
      }),
    );

    document.dispatchEvent(
      new CustomEvent("onupdatehold", {
        detail: env.hold,
      }),
    );

    document.dispatchEvent(
      new CustomEvent("onupdatenext", {
        detail: env.next,
      }),
    );
  }

  function onDatabaseLoaded() {
    let env = (event as CustomEvent)?.detail?.data;
    if (!env) {
      env = currentFieldNode.get();
    }

    if (env == null) return;

    document.dispatchEvent(
      new CustomEvent("onupdatefield", {
        detail: { board: env.board },
      }),
    );

    document.dispatchEvent(
      new CustomEvent("onupdatehold", {
        detail: env.hold,
      }),
    );

    document.dispatchEvent(
      new CustomEvent("onupdatenext", {
        detail: env.next,
      }),
    );
  }

  function handlePointerDown(event: FederatedPointerEvent) {
    //  suppressFieldUpdateNotification.set(true);
    editBoard = [...currentFieldNode.get()!.board];

    if (event.button === 0) {
      pointerIsDown = true;

      const pos = (event.target as CellSprite).pos;
      erase_mode = currentFieldNode.get()!.board[pos] !== Tetromino.Empty;

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
    if (isLeftClicking && pointerIsDown) {
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
      currentFieldNode.get()!.board[pos] === Tetromino.Empty &&
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
      undefined,
    );
    for (const block of specialBlocks!) {
      overrideBoard[block] = 8;
    }
    const board = currentFieldNode.get()!.board;
    document.dispatchEvent(
      new CustomEvent("onupdatefield", {
        detail: { board, override: overrideBoard },
      }),
    );
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
      return;
    }

    editBoard = [...currentFieldNode.get()!.board];

    for (const block of specialBlocks!) {
      editBoard[block] = tetromino;
    }

    document.dispatchEvent(
      new CustomEvent("onupdatefield", {
        detail: { board: editBoard },
      }),
    );

    let cloned = currentFieldNode.get()!.clone();
    cloned.board = [...editBoard];
    history.update((history: History) => {
      history.add($t("common.history-field"), cloned, Tetromino[tetromino]);
      return history;
    });

    // specialBlocks = [];
    //    updateOverrideBoard();
    currentFieldNode.update((env) => {
      if (env) env.board = [...editBoard];
      return env;
    });
  }

  function handlePointerUp(event: FederatedPointerEvent) {
    pointerUpCommon(event);
  }

  function handlePointerUpOutside(event: FederatedPointerEvent) {
    pointerUpCommon(event);
  }

  function pointerUpCommon(event: FederatedPointerEvent) {
    if (
      event.button === 0 &&
      isLeftClicking &&
      specialBlocks === null &&
      pointerIsDown
    ) {
      const diff = countBoardDiff(editBoard, currentFieldNode.get()!.board);
      if (diff == 0) return history;

      currentFieldNode.update((env) => {
        if (env) env.board = [...editBoard];
        return env;
      });

      history.update((history: History) => {
        let content: String;
        if (erase_mode) {
          content = `<span style="color: red;">-${diff}</span>`;
        } else {
          content = `${Tetromino[get(selectedMino)]}<span style="color: green;"> +${diff}</span>`;
        }

        history.add(
          $t("common.history-field"),
          currentFieldNode.get()!.clone(),
          content,
        );
        return history;
      });
    }

    pointerIsDown = false;
  }

  function handleFileDrop(event: Event) {
    event.preventDefault();
    isDragOver = false;

    const files = (event as DragEvent).dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // ファイルタイプをチェック
    if (file.type === "application/json" || file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          // ファイルデータを処理するカスタムイベントを発火
          document.dispatchEvent(
            new CustomEvent("onFileDropped", {
              detail: { file, data, type: "json" },
            }),
          );
        } catch (error) {
          console.error("JSON parse error:", error);
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith(".fumen")) {
      // fumenファイルの場合
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        document.dispatchEvent(
          new CustomEvent("onFileDropped", {
            detail: { file, data: content, type: "fumen" },
          }),
        );
      };
      reader.readAsText(file);
    } else {
      // その他のファイル
      document.dispatchEvent(
        new CustomEvent("onFileDropped", {
          detail: { file, type: "unknown" },
        }),
      );
    }
  }

  function handleDragOver(event: Event) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(event: Event) {
    event.preventDefault();
    isDragOver = false;
  }

  onMount(async () => {
    await mountTetrisBoard();
    await setupEventListeners();

    autoFillQueue.set(false);
    const env = currentFieldNode.get();
    if (env == null) return;

    document.dispatchEvent(
      new CustomEvent("onupdatefield", { detail: { board: env.board } }),
    );
    document.dispatchEvent(
      new CustomEvent("onupdatehold", { detail: env.hold }),
    );
    document.dispatchEvent(
      new CustomEvent("onupdatenext", { detail: env.next }),
    );

    //初期化
    selectedMino.set(0);
    isLeftClicking = false;
    erase_mode = false;

    //初期状態のボードを履歴に追加
    history.update((history: History) => {
      history.add($t("common.history-field"), env.clone(), "");
      return history;
    });
  });

  onDestroy(() => {
    unmount();
    unlistenAutoFillQueue();
    document.removeEventListener("applyfield", handleApplyFieldEvent);
    document.removeEventListener("onUpdateFieldNode", handleFieldUpdate);
    document.removeEventListener("onapplybot", handleApplyBot);
    document.removeEventListener("onclearbot", handleClearBot);
    document.removeEventListener("requestbotfield", requestBotField);
    document.removeEventListener("databaseLoaded", handleFieldUpdate);

    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("keydown", handleKeyDown);

    // ファイルドロップイベントリスナーを削除
    const tetrisBoardElement = document.querySelector(
      ".tetris-board-container",
    );
    if (tetrisBoardElement) {
      tetrisBoardElement.removeEventListener("dragover", handleDragOver);
      tetrisBoardElement.removeEventListener("dragleave", handleDragLeave);
      tetrisBoardElement.removeEventListener("drop", handleFileDrop);
    }
  });

  function handleKeyDown(this: Window, ev: KeyboardEvent) {
    if (/^[1-9]$/.test(ev.key)) {
      selectedMino.set(parseInt(ev.key) - 1);
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.button === 0) {
      isLeftClicking = true;
    }
  }

  function handleMouseUp(event: MouseEvent) {
    if (event.button === 0) {
      isLeftClicking = false;
    }
  }

  function handleClearBot(): void {
    document.dispatchEvent(
      new CustomEvent("onupdatefield", {
        detail: { board: currentFieldNode.get()!.board },
      }),
    );
  }
</script>

<div class="tetris-board-container" class:drag-over={isDragOver}>
  <TetrisBoard />
</div>

<style>
  .tetris-board-container {
    width: 100%;
    height: 100%;
    transition: all 0.2s ease;
  }

  .tetris-board-container.drag-over {
    background-color: rgba(0, 123, 255, 0.1);
    border: 2px dashed #007bff;
    border-radius: 4px;
  }

  .tetris-board-container.drag-over::after {
    content: "ファイルをドロップしてください";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    pointer-events: none;
    z-index: 1000;
  }
</style>
