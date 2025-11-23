<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { currentWindow, WindowType } from "../../../app/stores/window";
  import { currentFieldIndex } from "../../../app/stores/data";
  import { canvasView } from "../../../app/stores/data";
  import { get, type Unsubscriber } from "svelte/store";
  import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./const";
  import { listen } from "@tauri-apps/api/event";
  import { unknownThumbnailBase64 } from "../../../app/stores/misc";
  import ContextMenu, {
    open,
    type ContextMenuItem,
  } from "./contextMenu.svelte";

  import { FieldCanvasNode } from "./canvasNode/fieldCanvasNode";
  import type { CanvasNode } from "./canvasNode/canvasNode";
  import {
    getAllNodesDatabase,
    getNodeDatabase,
    updateAllThumbnailsDatabase,
    updateThumbnailDatabase,
  } from "../../../core/nodes/db";
  import { FieldDatabaseNode } from "../../../core/nodes/DatabaseNode/fieldDatabaseNode";
  import { nodeUpdater } from "../../../core/nodes/NodeUpdater/nodeUpdater";
  import { TextDatabaseNode } from "../../../core/nodes/DatabaseNode/textDatabaseNode";
  import { TextCanvasNode } from "./canvasNode/textCanvasNode";
  import { t } from "../../../translations/translations";
  import { selectedNodeIds } from "./canvasStore";
  import { clamp } from "./util";
  import { TetrisEnv } from "tetris/src/tetris_env";

  let container: HTMLDivElement;
  let canvasInner: HTMLDivElement;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  // Drag selection variables
  let isSelecting = false;
  let selectionStartX = 0;
  let selectionStartY = 0;
  let selectionCurrentX = 0;
  let selectionCurrentY = 0;
  let selectionRect: HTMLDivElement;

  let selectUnsubscriber: Unsubscriber;

  let offsetX = 0;
  let offsetY = 0;

  let scale = 1;
  const minScale = 0.2;
  const maxScale = 3;

  let canvasNodes: Map<number, CanvasNode> = new Map();

  // Context menu patterns
  interface ContextMenuPattern {
    [key: string]: (
      id?: number,
      canvasX?: number,
      canvasY?: number,
    ) => ContextMenuItem[];
  }

  const contextMenuPatterns: ContextMenuPattern = {
    canvas: (id?: number, canvasX?: number, canvasY?: number) => [
      {
        name: get(t)("common.canvas-menu-new"),
        submenu: [
          {
            name: get(t)("common.canvas-menu-field"),
            action: async () => {
              const x = clamp(canvasX!, 0, CANVAS_WIDTH);
              const y = clamp(canvasY!, 0, CANVAS_HEIGHT);
              const index = await get(nodeUpdater)!.create(
                new FieldDatabaseNode(
                  undefined,
                  x,
                  y,
                  undefined,
                  new TetrisEnv(),
                ),
              );
              updateThumbnailDatabase(index);
            },
          },
          {
            name: get(t)("common.canvas-menu-text"),
            action: async () => {
              const x = clamp(canvasX!, 0, CANVAS_WIDTH);
              const y = clamp(canvasY!, 0, CANVAS_HEIGHT);
              const index = await get(nodeUpdater)!.create(
                new TextDatabaseNode(
                  undefined,
                  x,
                  y,
                  "New Text",
                  30,
                  "#ffffff",
                  "transparent",
                ),
              );
            },
          },
        ],
      },
      {
        name: get(t)("common.canvas-menu-save-canvas"),
        action: () => {
          saveCanvasView();
        },
      },
      {
        name: get(t)("common.canvas-menu-reset-camera"),
        action: () => {
          offsetX = (container.clientWidth - CANVAS_WIDTH) / 2;
          offsetY = (container.clientHeight - CANVAS_HEIGHT) / 2;
          scale = 1;
          saveCanvasView();
        },
      },
    ],

    field: (id?: number) => [
      {
        name: get(t)("common.context-menu-open"),
        action: () => {
          currentFieldIndex.set(id!);
          currentWindow.set(WindowType.Field);
        },
      },
      {
        name: get(t)("common.context-menu-duplicate"),
        action: async () => {
          const node = getNodeDatabase(id!);
          node!.id = undefined;
          const newIndex = await get(nodeUpdater)?.create(node!)!;
          const newNode = getNodeDatabase(newIndex) as FieldDatabaseNode;
          get(nodeUpdater)?.update(
            new FieldDatabaseNode(
              newIndex,
              newNode!.x! + 50,
              newNode!.y! + 50,
              undefined,
              undefined,
            ),
          );
        },
      },
      {
        name: get(t)("common.context-menu-delete"),
        action: () => {
          const node = getNodeDatabase(id!);
          get(nodeUpdater)?.delete(node!);
        },
      },
    ],

    text: (id?: number) => [
      {
        name: get(t)("common.context-menu-duplicate"),
        action: async () => {
          const node = getNodeDatabase(id!);
          node!.id = undefined;
          const newIndex = await get(nodeUpdater)?.create(node!)!;
          const newNode = (getNodeDatabase(newIndex) as TextDatabaseNode)!;
          get(nodeUpdater)?.update(
            new TextDatabaseNode(
              newIndex,
              newNode.x! + 50,
              newNode.y! + 50,
              undefined,
              undefined,
              undefined,
              undefined,
            ),
          );
        },
      },
      {
        name: get(t)("common.context-menu-delete"),
        action: () => {
          get(nodeUpdater)?.delete(getNodeDatabase(id!)!);
        },
      },
    ],

    multipleNodes: () => [
      {
        name: get(t)("common.context-menu-duplicate"),
        action: async () => {
          const selectedIds = get(selectedNodeIds);
          const newIds: number[] = [];

          for (const id of selectedIds) {
            const node = getNodeDatabase(id);
            if (node) {
              node.id = undefined;
              const newIndex = await get(nodeUpdater)?.create(node)!;
              newIds.push(newIndex);

              const newNode = getNodeDatabase(newIndex);
              if (newNode instanceof FieldDatabaseNode) {
                get(nodeUpdater)?.update(
                  new FieldDatabaseNode(
                    newIndex,
                    newNode.x! + 50,
                    newNode.y! + 50,
                    undefined,
                    undefined,
                  ),
                );
              } else if (newNode instanceof TextDatabaseNode) {
                get(nodeUpdater)?.update(
                  new TextDatabaseNode(
                    newIndex,
                    newNode.x! + 50,
                    newNode.y! + 50,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                  ),
                );
              }
            }
          }

          // 複製したノードを選択
          selectedNodeIds.set(newIds);
        },
      },
      {
        name: get(t)("common.context-menu-delete"),
        action: () => {
          const selectedIds = get(selectedNodeIds);
          selectedIds.forEach((id) => {
            const node = getNodeDatabase(id);
            if (node) {
              get(nodeUpdater)?.delete(node);
            }
          });
          selectedNodeIds.set([]);
        },
      },
    ],

    container: () => [
      {
        name: get(t)("common.canvas-menu-reset-camera"),
        action: () => {
          offsetX = (container.clientWidth - CANVAS_WIDTH) / 2;
          offsetY = (container.clientHeight - CANVAS_HEIGHT) / 2;
          scale = 1;
          saveCanvasView();
        },
      },
    ],
  };

  function openContextMenu(
    pattern: keyof typeof contextMenuPatterns,
    x: number,
    y: number,
    id?: number,
    canvasX?: number,
    canvasY?: number,
  ) {
    console.log(pattern);
    const items = contextMenuPatterns[pattern](id, canvasX, canvasY);
    open({ x, y, items });
  }

  function createCanvasNode(databaseNode: any): CanvasNode {
    if (databaseNode instanceof FieldDatabaseNode) {
      return new FieldCanvasNode(databaseNode.id!);
    } else if (databaseNode instanceof TextDatabaseNode) {
      return new TextCanvasNode(databaseNode.id!);
    } else {
      throw new Error(
        `Unknown database node type: ${databaseNode.constructor.name}`,
      );
    }
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button === 1) {
      // Middle mouse button - pan the canvas
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      document.body.style.cursor = "grabbing";
      e.preventDefault();
    } else if (e.button === 0) {
      // Left mouse button - start selection
      const rect = container.getBoundingClientRect();
      selectionStartX = e.clientX - rect.left;
      selectionStartY = e.clientY - rect.top;
      selectionCurrentX = selectionStartX;
      selectionCurrentY = selectionStartY;
      isSelecting = true;

      // Clear existing selection
      selectedNodeIds.set([]);

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
    } else if (isSelecting) {
      const rect = container.getBoundingClientRect();
      selectionCurrentX = e.clientX - rect.left;
      selectionCurrentY = e.clientY - rect.top;

      updateSelectionRectangle();
      updateSelectedNodes();
    }
  }

  function onMouseUp(e: MouseEvent) {
    if (isDragging && e.button === 1) {
      isDragging = false;
      document.body.style.cursor = "";
      saveCanvasView();
    } else if (isSelecting && e.button === 0) {
      isSelecting = false;
      hideSelectionRectangle();
    }
  }

  function onWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault();
      const rect = container.getBoundingClientRect();

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const canvasX = (mouseX - offsetX) / scale;
      const canvasY = (mouseY - offsetY) / scale;

      const delta = -e.deltaY || -e.detail;
      const zoomIntensity = 0.05;
      if (delta > 0) {
        scale = Math.min(maxScale, scale + zoomIntensity);
      } else {
        scale = Math.max(minScale, scale - zoomIntensity);
      }

      offsetX = mouseX - canvasX * scale;
      offsetY = mouseY - canvasY * scale;

      saveCanvasView();
    }
  }

  function updateSelectionRectangle() {
    if (!selectionRect) {
      selectionRect = document.createElement("div");
      selectionRect.className = "selection-rectangle";
      container.appendChild(selectionRect);
    }

    const left = Math.min(selectionStartX, selectionCurrentX);
    const top = Math.min(selectionStartY, selectionCurrentY);
    const width = Math.abs(selectionCurrentX - selectionStartX);
    const height = Math.abs(selectionCurrentY - selectionStartY);

    selectionRect.style.left = `${left}px`;
    selectionRect.style.top = `${top}px`;
    selectionRect.style.width = `${width}px`;
    selectionRect.style.height = `${height}px`;
    selectionRect.style.display = "block";
  }

  function hideSelectionRectangle() {
    if (selectionRect) {
      selectionRect.style.display = "none";
    }
  }

  function updateSelectedNodes() {
    const selectionLeft = Math.min(selectionStartX, selectionCurrentX);
    const selectionTop = Math.min(selectionStartY, selectionCurrentY);
    const selectionRight = Math.max(selectionStartX, selectionCurrentX);
    const selectionBottom = Math.max(selectionStartY, selectionCurrentY);

    const selectedIds: number[] = [];

    canvasNodes.forEach((canvasNode, nodeId) => {
      if (canvasNode.element) {
        const rect = canvasNode.element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const nodeLeft = rect.left - containerRect.left;
        const nodeTop = rect.top - containerRect.top;
        const nodeRight = rect.right - containerRect.left;
        const nodeBottom = rect.bottom - containerRect.top;

        // Check if node intersects with selection rectangle
        if (
          nodeLeft < selectionRight &&
          nodeRight > selectionLeft &&
          nodeTop < selectionBottom &&
          nodeBottom > selectionTop
        ) {
          selectedIds.push(nodeId);
        }
      }
    });

    selectedNodeIds.set(selectedIds);
  }

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

  function registerMouseEventHandlers() {
    document.addEventListener("mousemove", onMouseMove);
    //document.addEventListener("mouseup", onMouseUp);
    if (container) {
      container.addEventListener("wheel", onWheel);
    }
  }

  function registerContextMenuEventHandlers() {
    document.addEventListener("openNodeContextMenu", onOpenNodeContextMenu);
  }

  function removeMouseEventHandlers() {
    document.removeEventListener("mousemove", onMouseMove);
    // document.removeEventListener("mouseup", onMouseUp);
    if (container) {
      container.removeEventListener("wheel", onWheel);
    }
  }

  function removeContextMenuEventHandlers() {
    document.removeEventListener("openNodeContextMenu", onOpenNodeContextMenu);
  }

  onMount(async () => {
    currentFieldIndex.set(-1);

    await tick();

    if (!container || !canvasInner) {
      console.error("Canvas elements are not available");
      return;
    }

    await updateAllThumbnailsDatabase();
    refreshAllNodes();

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

    registerFieldNodeEventHandlers();
    registerTextNodeEventHandlers();
    registerMouseEventHandlers();
    registerContextMenuEventHandlers();

    selectUnsubscriber = selectedNodeIds.subscribe((value) => {
      updateNodeSelectionStyles(value);
      return value;
    });
  });

  onDestroy(() => {
    removeFieldNodeEventHandlers();
    removeTextNodeEventHandlers();
    removeMouseEventHandlers();
    removeContextMenuEventHandlers();
    selectUnsubscriber();
  });

  function onUpdateFieldNode(event: Event) {
    const customEvent = event as CustomEvent;
    const databaseNode = customEvent.detail as FieldDatabaseNode;

    if (databaseNode.data) {
      updateThumbnailDatabase(databaseNode.id!);
    }

    const canvasNode = canvasNodes.get(databaseNode.id!);

    canvasNode!.render(databaseNode);
  }

  function onCreateFieldNode(event: Event) {
    const customEvent = event as CustomEvent;
    const databaseNode = customEvent.detail as FieldDatabaseNode;
    const canvasNode = createCanvasNode(databaseNode);

    canvasNode.render(databaseNode);
    canvasNodes.set(databaseNode.id!, canvasNode);
    canvasInner.appendChild(canvasNode.element!);
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
    const canvasNode = createCanvasNode(databaseNode);

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

  function refreshAllNodes() {
    canvasNodes.forEach((n) => n.element?.parentNode?.removeChild(n.element!));
    canvasNodes.clear();

    const nodes = getAllNodesDatabase();

    nodes.forEach((node) => {
      const dataBaseNode = getNodeDatabase(node.id!);

      if (!dataBaseNode) {
        console.warn(`Database node not found for id: ${node.id}`);

        return;
      }

      try {
        const canvasNode = createCanvasNode(dataBaseNode);
        canvasNode.render(dataBaseNode);
        canvasInner.appendChild(canvasNode.element!);
        canvasNodes.set(canvasNode.id, canvasNode);
      } catch (error) {
        console.error(
          `Failed to create canvas node for database node:`,
          dataBaseNode,
          error,
        );
      }
    });
  }

  function handleCanvasRightClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Clear all selected nodes
    selectedNodeIds.set([]);

    const containerRect = container.getBoundingClientRect();
    const canvasX = (e.clientX - containerRect.left - offsetX) / scale;
    const canvasY = (e.clientY - containerRect.top - offsetY) / scale;

    openContextMenu(
      "canvas",
      e.clientX,
      e.clientY,
      undefined,
      canvasX,
      canvasY,
    );
  }

  function handleContainerRightClick(e: MouseEvent) {
    e.preventDefault();

    // Clear all selected nodes
    selectedNodeIds.set([]);

    openContextMenu("container", e.clientX, e.clientY);
  }

  function onOpenNodeContextMenu(event: Event) {
    const customEvent = event as CustomEvent;
    const { x, y, id } = customEvent.detail;

    const selectedIds = get(selectedNodeIds);

    // 複数のノードが選択されている場合
    if (selectedIds.length > 1) {
      openContextMenu("multipleNodes", x, y);
    } else {
      // 単一ノードの場合はノードタイプを判定してメニューを表示
      const node = getNodeDatabase(id);
      if (node instanceof FieldDatabaseNode) {
        openContextMenu("field", x, y, id);
      } else if (node instanceof TextDatabaseNode) {
        openContextMenu("text", x, y, id);
      }
    }
  }

  function updateNodeSelectionStyles(selectedIds: number[]) {
    canvasNodes.forEach((canvasNode, nodeId) => {
      if (canvasNode.element) {
        if (selectedIds.includes(nodeId)) {
          canvasNode.element.style.border = "2px solid #007acc";
          canvasNode.element.style.boxShadow = "0 0 8px rgba(0, 122, 204, 0.5)";
        } else {
          canvasNode.element.style.removeProperty("border");
          canvasNode.element.style.removeProperty("box-shadow");
        }
      }
    });
  }
</script>

<div
  bind:this={container}
  class="canvas-container"
  on:mousedown={onMouseDown}
  on:mouseup={onMouseUp}
  on:contextmenu={handleContainerRightClick}
  role="button"
  tabindex="0"
  aria-label="Canvas workspace"
>
  <div
    bind:this={canvasInner}
    class="canvas-inner"
    style="transform: translate({offsetX}px, {offsetY}px) scale({scale}); transform-origin: 0 0; width: {CANVAS_WIDTH}px; height: {CANVAS_HEIGHT}px;"
    on:contextmenu={handleCanvasRightClick}
    role="region"
    aria-label="Canvas content area"
  ></div>
  <!-- 操作説明オーバーレイ -->

  <div class="canvas-help">
    <div class="canvas-help-row">
      <img src="./mouse_right.svg" alt="mouse" class="canvas-help-icon" />
      <span class="canvas-help-desc">{$t("common.canvas-help-menu")}</span>
    </div>
    <div class="canvas-help-row">
      <span class="canvas-help-key">Ctrl</span>
      <span class="canvas-help-plus">+</span>
      <img src="./mouse_wheel.svg" alt="mouse" class="canvas-help-icon" />
      <span class="canvas-help-desc">{$t("common.canvas-help-zoom")}</span>
    </div>
    <div class="canvas-help-row">
      <img src="./mouse_wheel_click.svg" alt="mouse" class="canvas-help-icon" />
      <span class="canvas-help-plus">+</span>
      <img src="./mouse_move.svg" alt="move" class="canvas-help-icon" />
      <span class="canvas-help-desc">{$t("common.canvas-help-move")}</span>
    </div>
  </div>
</div>

<ContextMenu></ContextMenu>

<!-- <PropertiesPanel /> -->

<style>
  .canvas-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    background: black;
  }

  .canvas-inner {
    position: absolute;
    background: #1c1c1c;
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

  :global(.canvas-field) {
    border: 1px solid #444;
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
  :global(.selection-rectangle) {
    position: absolute;
    border: 2px dashed #007acc;
    background: rgba(0, 122, 204, 0.1);
    pointer-events: none;
    z-index: 1000;
    display: none;
  }
</style>
