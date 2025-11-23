<script lang="ts">
  import {
    Application,
    Assets,
    Container,
    Rectangle,
    Sprite,
    Texture,
  } from "pixi.js";
  import { onDestroy, onMount } from "svelte";
  import { Tetromino } from "tetris/src/tetromino";
  import { get } from "svelte/store";
  import { BaseDirectory, writeFile } from "@tauri-apps/plugin-fs";

  import { TetrisEnv } from "tetris/src/tetris_env";
  import {
    createTetrisFieldBg,
    getOffScreenCanvasImage,
    initializeCells,
    initializePixijs,
    type CellSprite,
  } from "../modules/tetrisBoard.svelte";
  import {
    currentField,
    currentOverlayField,
    FieldType,
    OverlayFieldType,
  } from "../field";
  import { fumenImage } from "../../../../app/stores/misc";
  import {
    currentFieldIndex,
    currentFieldNode,
  } from "../../../../app/stores/data";
  import { t } from "../../../../translations/translations";
  //import { ImageProcessor } from "./imageProcessor";
  import { gameConfig } from "../../../../app/stores/config";
  import { open } from "@tauri-apps/plugin-dialog";
  import {
    getBlockChunks,
    getImageAvgColor,
    getImageDataFromChunk,
    MINO_TYPES,
    preprocessTrainingData,
    rgbToHsv,
    shrinkChunk,
  } from "../../../../core/utils/imageRecognition";
  import { RandomForestClassifier } from "ml-random-forest";

  let internalFumenImage: HTMLImageElement;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;

  let app: Application;
  let boardSprites: CellSprite[];
  let boardContainer: Container;
  let loadedImage: Sprite;
  let bgImage: Sprite;

  let isLoading = false;
  let showDebugButton = false;
  let currentModel: { model: RandomForestClassifier | null; name: string } = {
    model: null,
    name: "",
  };

  let previewImageSrc = "";

  function toggleDebugButton() {
    showDebugButton = !showDebugButton;
  }

  function updateCurrentModel(event: Event | null = null) {
    const modelDataJson =
      get(gameConfig)?.imageRecognitionModels?.[currentModel.name];
    const modelData = RandomForestClassifier.load(modelDataJson as any);
    currentModel.model = modelData;
  }

  async function debugOutput() {
    const image = await app?.renderer.extract.image({
      target: app.stage,
      frame: new Rectangle(0, 0, app.renderer.width, app.renderer.height),
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx!.drawImage(image as HTMLImageElement, 0, 0);

    const imageData = ctx!.getImageData(0, 0, image.width, image.height);

    const chunks = getBlockChunks(image.width, image.height).map((chunk) =>
      shrinkChunk(chunk),
    );

    const imageDataArray: ImageData[] = [];

    for (const chunk of chunks) {
      const chunkData = getImageDataFromChunk(imageData, chunk);
      imageDataArray.push(chunkData);
    }

    saveChunkImages(imageDataArray);
  }

  onMount(async () => {
    if (get(fumenImage) == null) {
      return;
    } else {
      internalFumenImage = get(fumenImage)!;
    }

    // Initialize currentModel with the first available model
    currentModel.name = get(gameConfig)?.imageRecognitionType!;
    updateCurrentModel();

    let texture = await Assets.load(internalFumenImage!);

    app = new Application();
    boardSprites = [];
    boardContainer = new Container();

    loadedImage = new Sprite(texture);

    app.stage.cursor = "grab";
    app.stage.eventMode = "static";
    app.stage.on("pointerdown", (e) => {
      isDragging = true;
      startX = e.data.global.x;
      startY = e.data.global.y;
      app.stage.cursor = "grabbing";
    });
    app.stage.on("pointerup", () => {
      isDragging = false;
      app.stage.cursor = "grab";
      predictField(); // 追加
    });
    app.stage.on("pointerupoutside", () => {
      isDragging = false;
      app.stage.cursor = "grab";
      predictField(); // 追加
    });
    app.stage.on("pointermove", (e) => {
      if (isDragging) {
        offsetX = e.data.global.x - startX;
        offsetY = e.data.global.y - startY;
        loadedImage.x += offsetX;
        loadedImage.y += offsetY;
        startX = e.data.global.x;
        startY = e.data.global.y;
      }
    });
    app.stage.on("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = 1.01;

      if (e.deltaY < 0) {
        loadedImage.scale.x *= zoomFactor;
        loadedImage.scale.y *= zoomFactor;
      } else {
        loadedImage.scale.x /= zoomFactor;
        loadedImage.scale.y /= zoomFactor;
      }
    });

    await initializePixijs(
      app,
      document.getElementById("canvas-import-image") as HTMLCanvasElement,
    );

    const canvasWidth = app.canvas.width;
    const canvasHeight = app.canvas.height;

    boardContainer.addChild(createTetrisFieldBg(app, 1, 1));

    if (loadedImage.width < canvasWidth) {
      const scaleFactor = canvasWidth / loadedImage.width;
      loadedImage.scale.set(scaleFactor, scaleFactor);
    }

    loadedImage.anchor.x = 0.5;
    loadedImage.anchor.y = 0.5;

    loadedImage.x = loadedImage.width / 2;
    loadedImage.y =
      loadedImage.height / 2 + (canvasHeight - loadedImage.height);

    boardContainer.addChild(loadedImage);

    //boardContainer.addChild(createTetrisFieldBorder(app, 1, 1));

    app.stage.addChild(boardContainer);

    initializeCells(boardContainer, boardSprites);

    boardSprites.forEach((sprite) => {
      sprite.eventMode = "none";
    });
  });

  onDestroy(() => {
    boardSprites = [];
    app.destroy();
  });

  async function saveChunkImages(chunks: ImageData[]) {
    for (let i = 0; i < chunks.length; i++) {
      const bytes = await imageDataToPngUint8Array(chunks[i]);

      await writeFile(`test/chunk_${i}.png`, bytes, {
        baseDir: BaseDirectory.Resource,
      });
    }
  }

  function closePanel() {
    currentOverlayField.set(OverlayFieldType.None);
  }

  function resetImage() {
    console.log(get(gameConfig)?.imageRecognitionModels);

    loadedImage.scale.set(1, 1);

    const canvasWidth = app.canvas.width;
    const canvasHeight = app.canvas.height;
    if (loadedImage.width < canvasWidth) {
      const scaleFactor = canvasWidth / loadedImage.width;
      loadedImage.scale.set(scaleFactor, scaleFactor);
    }

    loadedImage.anchor.x = 0.5;
    loadedImage.anchor.y = 0.5;

    loadedImage.x = loadedImage.width / 2;
    loadedImage.y =
      loadedImage.height / 2 + (canvasHeight - loadedImage.height);
  }

  /**
   * 画像チャンク配列から予測結果を返す
   * 必要数まで "empty" で埋める
   */
  async function predictChunks(
    chunkDataArray: ImageData[],
    chunkSize: { width: number; height: number },
    model: RandomForestClassifier,
  ): Promise<string[]> {
    const predictions: string[] = [];
    for (const chunkData of chunkDataArray) {
      const avgColor = getImageAvgColor(chunkData);
      const hsvColor = rgbToHsv(avgColor.r, avgColor.g, avgColor.b)!;

      /*const model =
        get(gameConfig)?.imageRecognitionModels![
          get(gameConfig)?.imageRecognitionType!
        ];*/

      const prediction = model.predict([
        [hsvColor.h, hsvColor.s, hsvColor.v],
      ])[0];

      predictions.push(MINO_TYPES[prediction]);
    }
    // 残りをemptyで埋める
    const totalCells = TetrisEnv.WIDTH * TetrisEnv.HEIGHT;
    while (predictions.length < totalCells) {
      predictions.push("empty");
    }
    return predictions;
  }

  async function applySelectedPage() {
    isLoading = true;
    let predictionFailed = false;

    const image = await app?.renderer.extract.image({
      target: app.stage,
      frame: new Rectangle(0, 0, app.renderer.width, app.renderer.height),
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx!.drawImage(image as HTMLImageElement, 0, 0);

    const imageData = ctx!.getImageData(0, 0, image.width, image.height);
    const chunks = getBlockChunks(image.width, image.height).map((chunk) =>
      shrinkChunk(chunk),
    );

    const chunkDataArray = [];
    for (const chunk of chunks) {
      const chunkData = getImageDataFromChunk(imageData, chunk);
      chunkDataArray.push(chunkData);
    }

    // 予測関数を利用
    const predictions = await predictChunks(
      chunkDataArray,
      {
        width: chunks[0].width,
        height: chunks[0].height,
      },
      currentModel.model!,
    );

    if (predictionFailed) {
      return;
    }

    const field = currentFieldNode.get()!.board;
    for (let i = 0; i < predictions.length; i++) {
      const prediction = predictions[i].toLowerCase();
      switch (prediction) {
        case "e":
          field[i] = Tetromino.Empty;
          break;
        case "i":
          field[i] = Tetromino.I;
          break;
        case "l":
          field[i] = Tetromino.L;
          break;
        case "o":
          field[i] = Tetromino.O;
          break;
        case "z":
          field[i] = Tetromino.Z;
          break;
        case "t":
          field[i] = Tetromino.T;
          break;
        case "j":
          field[i] = Tetromino.J;
          break;
        case "s":
          field[i] = Tetromino.S;
          break;
        case "g":
          field[i] = Tetromino.Garbage;
          break;
        default:
          console.error("Invalid prediction");
          break;
      }
    }

    currentFieldNode.update((env: TetrisEnv | null) => {
      env!.board = field;
      return env;
    });

    currentOverlayField.set(OverlayFieldType.None);
    isLoading = false;
  }

  async function predictField() {
    const image = await app?.renderer.extract.image({
      target: app.stage,
      frame: new Rectangle(0, 0, app.renderer.width, app.renderer.height),
    });

    console.log("1");
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx!.drawImage(image as HTMLImageElement, 0, 0);

    const imageData = ctx!.getImageData(0, 0, image.width, image.height);
    const chunks = getBlockChunks(image.width, image.height).map((chunk) =>
      shrinkChunk(chunk),
    );
    console.log("2");
    const chunkDataArray = [];
    for (const chunk of chunks) {
      const chunkData = getImageDataFromChunk(imageData, chunk);
      chunkDataArray.push(chunkData);
    }
    console.log("3");
    const predictions = await predictChunks(
      chunkDataArray,
      {
        width: chunks[0].width,
        height: chunks[0].height,
      },
      currentModel.model!,
    );
    console.log("4");
    console.log("Predictions on drag end:", predictions);

    // Convert predictions to Tetromino array
    const fieldNode = currentFieldNode.get()!;
    const tetrominoField: Tetromino[] = predictions.map((prediction) => {
      const pred = prediction.toLowerCase();
      switch (pred) {
        case "i":
          return Tetromino.I;
        case "l":
          return Tetromino.L;
        case "o":
          return Tetromino.O;
        case "z":
          return Tetromino.Z;
        case "t":
          return Tetromino.T;
        case "j":
          return Tetromino.J;
        case "s":
          return Tetromino.S;
        case "g":
          return Tetromino.Garbage;
        case "e":
        default:
          return Tetromino.Empty;
      }
    });
    const thumbnail =
      (await getOffScreenCanvasImage(tetrominoField, undefined, undefined)) ??
      "";

    previewImageSrc = thumbnail;
    (document.getElementById("preview-image") as HTMLImageElement)!.src =
      thumbnail;
  }

  function imageDataToPngUint8Array(imageData: ImageData): Promise<Uint8Array> {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        blob!.arrayBuffer().then((buffer) => {
          resolve(new Uint8Array(buffer));
        });
      }, "image/png");
    });
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
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
  <div id="canvas-import-image" tabindex="-1"></div>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="import-panel">
    <h2>{$t("common.image-import-panel-import-fumen")}</h2>

    {#if !isLoading}
      <div class="overlay-container">
        <div class="preview-container">
          <div>
            <div class="preset-selector"></div>
            <label for="preset-select"
              >1. {$t("common.image-import-panel-preset")}</label
            >
            <select
              id="preset-select"
              bind:value={currentModel.name}
              onchange={updateCurrentModel}
            >
              {#each Object.keys(get(gameConfig)?.imageRecognitionModels || {}) as modelKey}
                <option value={modelKey}>{modelKey}</option>
              {/each}
            </select>
          </div>
          <div class="field-container">
            <div class="preview-wrapper">
              <img id="preview-image" alt="Preview" src={previewImageSrc} />
              {#if !previewImageSrc}
                <div class="preview-placeholder">Preview</div>
              {/if}
            </div>
          </div>
        </div>

        <div id="howto">
          2. {$t("common.image-import-panel-howto")}
        </div>

        <div class="button-container">
          <button
            tabindex="-1"
            class="secondary-button small-button"
            onclick={closePanel}
            >{$t("common.image-import-panel-cancel")}</button
          >
          <button
            tabindex="-1"
            class="secondary-button small-button"
            onclick={resetImage}>{$t("common.image-import-panel-reset")}</button
          >
          <button tabindex="-1" class="small-button" onclick={applySelectedPage}
            >{$t("common.image-import-panel-apply")}</button
          >
        </div>
      </div>
    {/if}
  </div>
  {#if isLoading}
    <div class="loading-overlay">
      <img src="loading.gif" alt="Loading..." />
      <p>{$t("common.image-import-panel-processing")}...</p>
    </div>
  {/if}
  {#if showDebugButton}
    <button
      tabindex="-1"
      class="debug-button"
      onclick={debugOutput}
      style="position: absolute; bottom: 50px; left: 10px;"
    >
      Export Chunks
    </button>
  {/if}
  <!-- svelte-ignore a11y_consider_explicit_label -->
  <button
    tabindex="-1"
    class="transparent-button"
    onclick={toggleDebugButton}
    style="position: absolute; bottom: 10px; left: 10px; opacity: 0.5;"
  >
    &nbsp;
  </button>
</div>

<style>
  #container {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    background-color: #1c1c1c;
    pointer-events: all;
  }

  #canvas-import-image {
    width: 100%;
    height: 100%;
  }

  .import-panel {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  }

  button {
    margin-top: 8px;
    border: none;
    border-radius: 2px;
    background-color: #1c7ad2;
    color: #ffffff;
    cursor: pointer;
    width: 55px;
  }
  button:hover {
    background-color: #1a70bf;
  }

  .secondary-button {
    background-color: #2b2b2b;
  }
  .secondary-button:hover {
    background-color: #353535;
  }
  .small-button {
    padding: 5px 10px;
    font-size: 12px;
    pointer-events: all;
  }
  .loading-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: #cbcbcb;
    text-align: center;
    padding: 20px;
    border-radius: 10px;
    z-index: 1000;
    pointer-events: none;
  }
  .loading-overlay img {
    width: 50px;
    height: 50px;
  }

  #howto {
    text-align: center;
    pointer-events: none;
  }

  .transparent-button {
    width: 30px;
    height: 30px;
    background-color: transparent;
    border: none;
    cursor: pointer;
  }

  .transparent-button:hover {
    background-color: transparent;
  }

  .debug-button {
    padding: 5px 10px;
    background-color: #ff5722;
    color: #cbcbcb;
    border: none;
    border-radius: 3px;
    cursor: pointer;
  }
  .debug-button:hover {
    background-color: #e64a19;
  }

  .overlay-container {
    padding: 8px;
    background-color: #00000095;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 200px;
    pointer-events: none;
  }

  .button-container {
    display: flex;
    gap: 5px;
    justify-content: center;
  }

  .preview-container {
    margin-bottom: 8px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    pointer-events: none;
  }

  .preview-wrapper {
    position: relative;
    min-width: 100px;
    min-height: 200px;
  }

  .preview-placeholder {
    position: absolute;
    top: 0;
    left: 0;
    width: 100px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #222;
    border-radius: 4px;
    border: 1px solid #444;
    color: #888;
    font-size: 14px;
    pointer-events: none;
  }

  #preview-image {
    max-width: 100px;
    max-height: 200px;
    width: auto;
    height: auto;
    display: block;
    margin: 0 auto;
    background: #222;
    border-radius: 4px;
    border: 1px solid #444;
  }
</style>
