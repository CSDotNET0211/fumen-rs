<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { currentWindow, WindowType } from "../../../app/stores/window";
  import { currentFieldIndex } from "../../../app/stores/data";
  import { canvasView } from "../../../app/stores/data";
  import { get } from "svelte/store";
  import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./const";
  import { listen } from "@tauri-apps/api/event";
  import { unknownThumbnailBase64 } from "../../../app/stores/misc";
  import ContextMenu, { open } from "./contextMenu.svelte";
  import PropertiesPanel from "./PropertiesPanel.svelte";
  import { TetrisEnv } from "tetris/src/tetris_env";
  import { FieldCanvasNode } from "./CanvasNode/fieldCanvasNode";
  import type { CanvasNode } from "./CanvasNode/canvasNode";
  import {
    getAllNodesDatabase,
    getNodeDatabase,
    updateAllThumbnailsDatabase,
  } from "../../../core/nodes/db";
  import { FieldDatabaseNode } from "../../../core/nodes/DatabaseNode/fieldDatabaseNode";
  import { nodeUpdater } from "../../../core/nodes/NodeUpdater/nodeUpdater";
  import { TextDatabaseNode } from "../../../core/nodes/DatabaseNode/textDatabaseNode";
  import { TextCanvasNode } from "./CanvasNode/textCanvasNode";

  let container: HTMLDivElement;
  let canvasInner: HTMLDivElement;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  // 追加: translate用のオフセット
  let offsetX = 0;
  let offsetY = 0;

  let scale = 1;
  const minScale = 0.2;
  const maxScale = 3;

  // ノード管理
  //let fieldNodes: Map<number, FieldCanvasNode> = new Map();
  //let textNodes: Map<number, TextCanvasNode> = new Map();
  let canvasNodes: Map<number, CanvasNode> = new Map();

  // canvas-innerのサイズ

  function onMouseDown(e: MouseEvent) {
    if (e.button === 1) {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      document.body.style.cursor = "grabbing";
      e.preventDefault();
    }
  }

  function saveCanvasView() {
    canvasView.set({
      x: offsetX,
      y: offsetY,
      zoom: scale,
    });
  }

  function onMouseMove(e: MouseEvent) {
    if (isDragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      offsetX += dx;
      offsetY += dy;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  }

  function onMouseUp(e: MouseEvent) {
    if (isDragging && e.button === 1) {
      isDragging = false;
      document.body.style.cursor = "";
      saveCanvasView();
    }
  }

  function onWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      // マウス位置をキャンバス座標系に変換
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      // 現在のズーム・オフセットでのキャンバス上の座標
      const canvasX = (mouseX - offsetX) / scale;
      const canvasY = (mouseY - offsetY) / scale;

      // const prevScale = scale;
      const delta = -e.deltaY || -e.detail;
      const zoomIntensity = 0.05;
      if (delta > 0) {
        scale = Math.min(maxScale, scale + zoomIntensity);
      } else {
        scale = Math.max(minScale, scale - zoomIntensity);
      }

      // 新しいズームで、同じcanvasX/canvasYがマウス位置に来るようにオフセットを補正
      offsetX = mouseX - canvasX * scale;
      offsetY = mouseY - canvasY * scale;

      saveCanvasView();
    }
  }

  function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
  }

  function handleContainerDblClick(e: MouseEvent) {
    if (!canvasInner) return;
    const containerRect = container.getBoundingClientRect();
    let x = (e.clientX - containerRect.left - offsetX) / scale;
    let y = (e.clientY - containerRect.top - offsetY) / scale;
    x = clamp(x, 0, CANVAS_WIDTH / scale);
    y = clamp(y, 0, CANVAS_HEIGHT / scale);
    throw new Error("Not implemented: handleContainerDblClick");
    //TextNode.insertDB(x, y, 30, "", "#ffffff", "transparent");
  }

  // Field Node Event Handler Registration/Removal Functions
  function registerFieldNodeEventHandlers() {
    document.addEventListener("onUpdateFieldNode", onUpdateFieldNode);
    document.addEventListener("onCreateFieldNode", onCreateFieldNode);
    document.addEventListener("onDeleteFieldNode", onDeleteFieldNode);
  }

  function removeFieldNodeEventHandlers() {
    document.removeEventListener("onUpdateFieldNode", onUpdateFieldNode);
    document.removeEventListener("onCreateFieldNode", onCreateFieldNode);
    document.removeEventListener("onDeleteFieldNode", onDeleteFieldNode);
  }

  // Text Node Event Handler Registration/Removal Functions
  function registerTextNodeEventHandlers() {
    document.addEventListener("onUpdateTextNode", onUpdateTextNode);
    document.addEventListener("onCreateTextNode", onCreateTextNode);
    document.addEventListener("onDeleteTextNode", onDeleteTextNode);
  }

  function removeTextNodeEventHandlers() {
    document.removeEventListener("onUpdateTextNode", onUpdateTextNode);
    document.removeEventListener("onCreateTextNode", onCreateTextNode);
    document.removeEventListener("onDeleteTextNode", onDeleteTextNode);
  }

  // Mouse Event Handler Registration/Removal Functions
  function registerMouseEventHandlers() {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    if (container) {
      container.addEventListener("wheel", onWheel, { passive: false });
    }
  }

  function removeMouseEventHandlers() {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    if (container) {
      container.removeEventListener("wheel", onWheel);
    }
  }

  onMount(async () => {
    registerFieldNodeEventHandlers();
    registerTextNodeEventHandlers();
    registerMouseEventHandlers();

    //サムネの更新が必要な場合は更新
    await updateAllThumbnailsDatabase();
    refreshAllNodes();
    // refreshAllFieldNodes();
    // refreshAllTextNodes();
    // TextNode, GroupNode, ArrowNodeのロードも必要ならここで追加

    // canvasViewから復元
    if (get(canvasView) == null) {
      canvasView.set({
        x: (container.clientWidth - CANVAS_WIDTH) / 2,
        y: (container.clientHeight - CANVAS_HEIGHT) / 2,
        zoom: 1,
      });
    }
    offsetX = get(canvasView)?.x ?? 0;
    offsetY = get(canvasView)?.y ?? 0;
    scale = get(canvasView)?.zoom ?? 1;

    // After loading nodes, attach context menu
    // textNodes.forEach(attachContextMenuToNode);
    // fieldNodes.forEach(attachContextMenuToNode);
  });

  onDestroy(() => {
    removeFieldNodeEventHandlers();
    removeTextNodeEventHandlers();
    removeMouseEventHandlers();
  });

  function onUpdateFieldNode(event: Event) {
    const customEvent = event as CustomEvent;
    const databaseNode = customEvent.detail as FieldDatabaseNode;
    const canvasNode = canvasNodes.get(databaseNode.id!);

    canvasNode?.render(databaseNode);
  }

  function onCreateFieldNode(event: Event) {
    const customEvent = event as CustomEvent;
    const databaseNode = customEvent.detail as FieldDatabaseNode;
    const canvasNode = canvasNodes.get(databaseNode.id!);

    canvasNode?.render(databaseNode);
    canvasNodes.set(databaseNode.id!, canvasNode!);
    canvasInner.appendChild(canvasNode!.element!);
  }

  function onDeleteFieldNode(event: Event) {
    const customEvent = event as CustomEvent;
    const nodeId = customEvent.detail.id;
    const canvasNode = canvasNodes.get(nodeId);

    if (canvasNode) {
      canvasNode.element?.parentNode?.removeChild(canvasNode.element!);
      canvasNodes.delete(nodeId);
    }
  }

  function onUpdateTextNode(event: Event) {
    const customEvent = event as CustomEvent;
    const databaseNode = customEvent.detail as TextDatabaseNode;
    const canvasNode = canvasNodes.get(databaseNode.id!);

    canvasNode?.render(databaseNode);
  }

  function onCreateTextNode(event: Event) {
    const customEvent = event as CustomEvent;
    const databaseNode = customEvent.detail as TextDatabaseNode;
    console.log(customEvent.detail);
    const canvasNode = new TextCanvasNode(databaseNode.id!);

    canvasNode.render(databaseNode);
    canvasInner.appendChild(canvasNode.element!);
    canvasNodes.set(canvasNode.id, canvasNode);
  }

  function onDeleteTextNode(event: Event) {
    const customEvent = event as CustomEvent;
    const nodeId = customEvent.detail.id;
    const canvasNode = canvasNodes.get(nodeId);

    if (canvasNode) {
      canvasNode.element?.parentNode?.removeChild(canvasNode.element!);
      canvasNodes.delete(nodeId);
    }
  }

  /// すべての盤面ノードを再描画
  function refreshAllNodes() {
    canvasNodes.forEach((n) => n.element?.parentNode?.removeChild(n.element!));
    canvasNodes.clear();

    const nodes = getAllNodesDatabase();
    console.log("refreshAllNodes", nodes);
    nodes.forEach((node) => {
      const dataBaseNode = getNodeDatabase(node.id!);
      const canvasNode = new FieldCanvasNode(node.id!);
      canvasNode.render(dataBaseNode!);

      canvasInner.appendChild(canvasNode.element!);
      canvasNodes.set(canvasNode.id, canvasNode);
    });
  }

  /*
  function onFieldNodeChanged(event: Event) {
    let customEvent = event as CustomEvent;
    switch (customEvent.detail.action) {
      case "created":
        const node = new FieldNode(
          customEvent.detail.x ??
            (get(canvasView)?.x ?? CANVAS_WIDTH / 2) +
              container.clientWidth / 2,
          customEvent.detail.y ??
            (get(canvasView)?.y ?? CANVAS_HEIGHT / 2) +
              container.clientHeight / 2,
          customEvent.detail.id,
          customEvent.detail.thumbnail ?? get(unknownThumbnailBase64)
        );
        node.render();
        canvasInner.appendChild(node.element!);
        fieldNodes.set(customEvent.detail.id, node);

        if (customEvent.detail.thumbnail === undefined) {
          // サムネが未指定の場合はデフォルトのサムネを設定
          FieldNode.updateThumbnailDB(customEvent.detail.id);
          //          (node.element as HTMLImageElement)!.src = "./static/unknown.png";
          // node.setThumbnail(get(unknownThumbnailBase64));
        } else {
          (node.element as HTMLImageElement)!.src =
            customEvent.detail.thumbnail;
        }

        //   fieldNodeThumbnailUpdate(customEvent.detail.id);
        // fieldNodeCoordinatesUpdate(customEvent.detail.id);
        break;
      case "updatedThumbnail":
        const element = fieldNodes.get(customEvent.detail.id)
          ?.element as HTMLImageElement;

        if (element) {
          element.src = customEvent.detail.thumbnail;
        }

        break;

      case "updatedCoordinates":
        const updatedNode = fieldNodes.get(customEvent.detail.id);
        if (updatedNode) {
          updatedNode.setPosition(customEvent.detail.x, customEvent.detail.y);
          //updatedNode.render(canvasInner);
          // fieldNodeCoordinatesUpdate(customEvent.detail.id);
        }
        break;

      case "updated":
        //	const updatedFieldNode = fieldNodes.get(customEvent.detail.id);
        //	if (updatedFieldNode) {
        //	  updatedFieldNode.setThumbnail(customEvent.detail.thumbnail);
        // fieldNodeThumbnailUpdate(customEvent.detail.id);
        //	}
        break;

      case "deleted":
        fieldNodes.get(customEvent.detail.id)?.element?.remove();
        fieldNodes.delete(customEvent.detail.id);
        break;
    }

    /*	getAllFieldNodes().forEach((node) => {

	});

    //生成があった場合は位置とサムネ更新
    //id渡す特定のやつで
    fieldNodeThumbnailUpdateAll();
    fieldNodeCoordinatesUpdateAll();
	
  }*/

  /*
  function onTextNodeChanged(event: Event) {
    let customEvent = event as CustomEvent;
    switch (customEvent.detail.action) {
      case "created":
        const textNode = new TextNode(
          customEvent.detail.id,
          customEvent.detail.x ?? get(canvasView)!.x,
          customEvent.detail.y ?? get(canvasView)!.y,
          customEvent.detail.text ?? "",
          customEvent.detail.size ?? 50
        );
        textNode.render();
        console.log(canvasInner);
        canvasInner.appendChild(textNode.element!);
        textNodes.set(textNode.id, textNode);
        TextNode.handleTextNodeEdit(textNode);
        break;
      case "updated":
        console.log("updated", customEvent.detail);

        //TODO:render関数と似たような感じの方がいいかも
        const updatedTextNode = textNodes.get(customEvent.detail.id);
        if (updatedTextNode) {
          updatedTextNode.text = customEvent.detail.text;
          updatedTextNode.size = customEvent.detail.size;
          updatedTextNode.setPosition(
            customEvent.detail.x ?? updatedTextNode.getX(),
            customEvent.detail.y ?? updatedTextNode.getY()
          );
          updatedTextNode.color =
            customEvent.detail.color ?? updatedTextNode.color;
          updatedTextNode.backgroundColor =
            customEvent.detail.backgroundColor ??
            updatedTextNode.backgroundColor;

          updatedTextNode.render(); // ここで　elementを再生成・更新
        }
        break;
      case "deleted":
        textNodes.get(customEvent.detail.id)?.element?.remove();
        textNodes.delete(customEvent.detail.id);
        break;
    }
  }*/

  /*
  function refreshAllTextNodes() {
    textNodes.forEach((n) => n.element?.parentNode?.removeChild(n.element!));
    textNodes.clear();

    const result = TextNode.getAllFromDB();
    result.forEach((node) => {
      // 新規ノードを生成
      const x = clamp(node.x, 0, CANVAS_WIDTH);
      const y = clamp(node.y, 0, CANVAS_HEIGHT);
      const newNode = new TextNode(node.id, x, y, node.text, node.size);
      newNode.render();
      canvasInner.appendChild(newNode.element!);
      textNodes.set(newNode.id, newNode);
      // TextNode.handleTextNodeEdit(newNode);
    });
  }*/

  function handleCanvasRightClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const containerRect = container.getBoundingClientRect();
    const canvasX = (e.clientX - containerRect.left - offsetX) / scale;
    const canvasY = (e.clientY - containerRect.top - offsetY) / scale;

    open({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          name: "新規",
          submenu: [
            {
              name: "盤面",
              action: async () => {
                // Create new field at clicked position
                const x = clamp(canvasX, 0, CANVAS_WIDTH);
                const y = clamp(canvasY, 0, CANVAS_HEIGHT);

                await get(nodeUpdater)!.create(
                  new FieldDatabaseNode(
                    undefined,
                    x,
                    y,
                    undefined,
                    new TetrisEnv()
                  )
                );
              },
            },
            {
              name: "テキスト",
              action: async () => {
                const x = clamp(canvasX, 0, CANVAS_WIDTH);
                const y = clamp(canvasY, 0, CANVAS_HEIGHT);

                //作成した後編集
                const index = await get(nodeUpdater)!.create(
                  new TextDatabaseNode(
                    undefined,
                    x,
                    y,
                    "New Text",
                    30,
                    "#ffffff",
                    "transparent"
                  )
                );
              },
            },
          ],
        },
        {
          name: "canvasを保存",
          action: () => {
            saveCanvasView();
          },
        },
        {
          name: "カメラをリセット",
          action: () => {
            offsetX = (container.clientWidth - CANVAS_WIDTH) / 2;
            offsetY = (container.clientHeight - CANVAS_HEIGHT) / 2;
            scale = 1;
            saveCanvasView();
          },
        },
      ],
    });
  }

  function handleContainerRightClick(e: MouseEvent) {
    e.preventDefault();

    open({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          name: "カメラをリセット",
          action: () => {
            offsetX = (container.clientWidth - CANVAS_WIDTH) / 2;
            offsetY = (container.clientHeight - CANVAS_HEIGHT) / 2;
            scale = 1;
            saveCanvasView();
          },
        },
      ],
    });
  }
</script>

<div
  bind:this={container}
  class="canvas-container"
  on:mousedown={onMouseDown}
  tabindex="0"
  on:dblclick={handleContainerDblClick}
  on:contextmenu={handleContainerRightClick}
>
  <div
    bind:this={canvasInner}
    class="canvas-inner"
    style="transform: translate({offsetX}px, {offsetY}px) scale({scale}); transform-origin: 0 0; width: {CANVAS_WIDTH}px; height: {CANVAS_HEIGHT}px;"
    on:contextmenu={handleCanvasRightClick}
  ></div>
  <!-- 操作説明オーバーレイ -->

  <div class="canvas-help">
    <div class="canvas-help-row">
      <img src="./mouse_right.svg" alt="mouse" class="canvas-help-icon" />
      <span class="canvas-help-desc">メニュー</span>
    </div>
    <div class="canvas-help-row">
      <span class="canvas-help-key">Ctrl</span>
      <span class="canvas-help-plus">+</span>
      <img src="./mouse_wheel.svg" alt="mouse" class="canvas-help-icon" />
      <span class="canvas-help-desc">ズーム</span>
    </div>
    <div class="canvas-help-row">
      <img src="./mouse_wheel_click.svg" alt="mouse" class="canvas-help-icon" />
      <span class="canvas-help-plus">+</span>
      <img src="./mouse_move.svg" alt="move" class="canvas-help-icon" />
      <span class="canvas-help-desc">移動</span>
    </div>
  </div>
</div>

<ContextMenu></ContextMenu>

<!-- <PropertiesPanel /> -->

<style>
  .canvas-container {
    width: 100%;
    height: 100%;
    overflow: hidden; /* ← scrollからhiddenに変更 */
    position: relative;
    background: black;
  }

  .canvas-inner {
    position: absolute;
    background: #1c1c1c;
    /* width/heightはJSで指定 */
  }

  :global(.center-text) {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-size: 2rem;
    font-weight: bold;
    color: white;
    user-select: none;
    pointer-events: none;
  }

  :global(.node-thumbnail) {
    width: 300px;
    object-fit: contain;
    border: 1px solid #444;
    background: #222;
    border-radius: 8px;
  }

  /* カスタムスクロールバー */
  .canvas-container::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }
  .canvas-container::-webkit-scrollbar-track {
    background: #1c1c1c;
  }
  .canvas-container::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  .canvas-container::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  :global(.canvas-text) {
    min-width: 40px;
    min-height: 24px;
    position: absolute;
    color: #fff;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 18px;
    white-space: pre-wrap;
    pointer-events: auto;
    user-select: text;
    outline: none;
  }
  :global(.canvas-textarea) {
    width: 120px;
    height: 40px;
    font-size: 18px;
    background: #222;
    color: #fff;
    border: 1px solid #888;
    border-radius: 4px;
    resize: none;
    outline: none;
    box-sizing: border-box;
    z-index: 11;
  }

  *:focus {
    outline: none;
  }

  .canvas-help {
    position: absolute;
    right: 0;
    bottom: 0;
    background: rgba(32, 32, 32, 0.85);
    color: #fff;
    font-size: 10px;
    padding: 8px 14px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 100;
    pointer-events: none;
    user-select: none;
    line-height: 1.7;
    text-align: left;
    display: flex;
    flex-direction: row;
    gap: 22px;
    align-items: center;
  }
  .canvas-help-row {
    display: flex;
    align-items: center;
    gap: 0px;
  }
  .canvas-help-icon {
    width: 33px;
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px #0008);
  }
  .canvas-help-plus {
    font-weight: bold;
    margin: 0 4px;
  }
  .canvas-help-key {
    background: #444;
    color: #fff;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 10px;
    margin: 0 4px;
    font-family: monospace;
  }
  .canvas-help-desc {
    margin-left: 6px;
    font-size: 11px;
    font-weight: 500;
  }
</style>
