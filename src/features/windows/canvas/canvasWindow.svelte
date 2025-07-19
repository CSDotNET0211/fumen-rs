<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Application, Container, Graphics } from "pixi.js";
  import { circIn } from "svelte/easing";
  import { math } from "@tensorflow/tfjs";

  let canvas: HTMLCanvasElement;
  let app: Application;
  let gridContainer: Container;
  const baseGridSize = 40;
  const DEFAULT_GRID_WIDTH = 800;
  const DEFAULT_GRID_HEIGHT = 600;

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  const scaleSpeed = 0.1;

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const s = app.stage.scale.x;
    const tx = (e.clientX - app.stage.x) / s;
    const ty = (e.clientY - app.stage.y) / s;

    const deltaScale =
      -1 * Math.max(-1, Math.min(1, e.deltaY)) * scaleSpeed * s;
    const newScale = s + deltaScale;

    app.stage.x = -tx * newScale + e.clientX;
    app.stage.y = -ty * newScale + e.clientY;
    app.stage.scale.x = newScale;
    app.stage.scale.y = newScale;

    drawGrid();
  }

  function onMouseDown(e: MouseEvent) {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    canvas.style.cursor = "grab"; // Change cursor to grab
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return;

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    app.stage.x += dx;
    app.stage.y += dy;

    dragStartX = e.clientX;
    dragStartY = e.clientY;
  }

  function onMouseUp() {
    isDragging = false;
    canvas.style.cursor = "pointer"; // Change cursor back to pointer
  }

  function createGrid(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    gridStep: number,
    lineWidth: number,
    alpha: number
  ): Graphics {
    const grid = new Graphics();
    // Vertical lines
    for (let x = startX; x <= endX; x += gridStep) {
      grid
        .moveTo(x, startY - baseGridSize)
        .lineTo(x, endY)
        .stroke({ color: 0x333333, width: lineWidth, alpha });
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += gridStep) {
      grid
        .moveTo(startX - baseGridSize, y)
        .lineTo(endX, y)
        .stroke({ color: 0x333333, width: lineWidth, alpha });
    }

    return grid;
  }

  function drawGrid() {
    gridContainer.removeChildren();

    const subGridSize = baseGridSize / 4;

    // baseが40のときalphaが1、0のとき0になるように補正
    //const correctedAlpha = Math.max(0, Math.min(1, base / 40));
    //const alpha = correctedAlpha;

    const mainGrid = createGrid(
      0,
      0,
      DEFAULT_GRID_WIDTH,
      DEFAULT_GRID_HEIGHT,
      baseGridSize,
      1,
      0.3
    );
    const subGrid = createGrid(
      0,
      0,
      DEFAULT_GRID_WIDTH,
      DEFAULT_GRID_HEIGHT,
      subGridSize,
      0.5,
      0.3
    );

    gridContainer.addChild(mainGrid);
    gridContainer.addChild(subGrid);
  }

  function createBoardNodes() {
	//
  }

  function drawLinesOnNode(node: Graphics) {
    node.lineStyle(2, 0x000000, 1); // Black lines with width 2
    for (let x = 0; x <= DEFAULT_GRID_WIDTH; x += baseGridSize) {
      node.moveTo(x, 0).lineTo(x, DEFAULT_GRID_HEIGHT);
    }
    for (let y = 0; y <= DEFAULT_GRID_HEIGHT; y += baseGridSize) {
      node.moveTo(0, y).lineTo(DEFAULT_GRID_WIDTH, y);
    }
  }

  onMount(async () => {
    app = new Application();
    await app.init({
      view: canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      background: "#ff0000", // Set a valid background color
      antialias: true,
      resizeTo: window,
    });

    gridContainer = new Container();
    app.stage.addChild(gridContainer);

    drawGrid();

    //const boardNode = createBoardNode();
    //drawLinesOnNode(boardNode);
    //app.stage.addChild(boardNode);

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });

  onDestroy(() => {
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    app.destroy(true, { children: true });
  });

  let selectedTool = "pointer";

  function selectTool(tool: string) {
    selectedTool = tool;
    console.log("Selected tool:", tool);
  }
</script>

<div class="operation-panel">
  <button
    class={selectedTool === "pointer" ? "active" : ""}
    on:click={() => selectTool("pointer")}
  >
    <img src="/pointer.svg" alt="Pointer" />
  </button>
  <button
    class={selectedTool === "grab" ? "active" : ""}
    on:click={() => selectTool("grab")}
  >
    <img src="/grab.svg" alt="Grab" />
  </button>
  <button
    class={selectedTool === "text" ? "active" : ""}
    on:click={() => selectTool("text")}
  >
    <img src="/text.svg" alt="Text" />
  </button>
  <button
    class={selectedTool === "move" ? "active" : ""}
    on:click={() => selectTool("move")}
  >
    <img src="/icons/move.svg" alt="Move" />
  </button>
</div>

<canvas
  bind:this={canvas}
  style="width: 100%; height: 100%; display: block; cursor: default;"
></canvas>

<style>
  .operation-panel {
    position: absolute;
    left: 10px;
    top: 10px;
    width: 60px;
    background-color: #333333; /* Dark background */
    display: flex;
    flex-direction: column;
    padding: 5px;
    box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.5); /* Adjust shadow for dark theme */
    border-radius: 5px;
    z-index: 1000;
  }

  .operation-panel button {
    width: 50px;
    height: 50px;
    margin: 5px 0;
    cursor: pointer;
    border: none;
    background-color: #444444; /* Dark button background */
    border: 1px solid #555555; /* Dark border */
    border-radius: 5px;
    transition:
      background-color 0.3s,
      border-color 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .operation-panel button:hover {
    background-color: #555555; /* Slightly lighter hover effect */
  }

  .operation-panel button.active {
    background-color: #666666; /* Active button background */
    border-color: #888888; /* Active button border */
  }

  .operation-panel button img {
    width: 30px;
    height: 30px;
  }
</style>
