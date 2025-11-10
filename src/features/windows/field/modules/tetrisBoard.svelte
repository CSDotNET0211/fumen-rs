<script lang="ts" context="module">
  import {
    Application,
    Assets,
    Container,
    Graphics,
    Rectangle,
    Sprite,
    Text,
    Texture,
  } from "pixi.js";
  import { Tetromino } from "tetris/src/tetromino";
  import { resolveResource } from "@tauri-apps/api/path";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { TetrisEnv } from "tetris/src/tetris_env";

  export const CELL_SIZE = 31;

  export interface CellSprite extends Sprite {
    pos: number;
  }

  export let tetrominoBlockTextures: string[];

  export let tetrisBoardApp: Application | null;
  let blockTextures: Texture<any>[];

  export let tetrisBoardSprites: CellSprite[];
  export let boardContainer: Container;

  // オフスクリーン用のグローバル変数
  let tetrisBoardOffscreenApp: Application | null = null;
  let tetrisBoardOffscreenSprites: CellSprite[] = [];
  let offscreenBoardContainer: Container | null = null;
  let offscreenCanvas: HTMLCanvasElement | null = null;

  export let leftPosition: number = 0;
  export let topPosition: number = 0;

  const TETROMINO_SHAPES = [
    //S
    [
      [1 + 0.5, 0 + 0.5],
      [2 + 0.5, 0 + 0.5],
      [1 + 0.5, 1 + 0.5],
      [0 + 0.5, 1 + 0.5],
    ],
    [
      //Z
      [1 + 0.5, 0 + 0.5],
      [0 + 0.5, 0 + 0.5],
      [1 + 0.5, 1 + 0.5],
      [2 + 0.5, 1 + 0.5],
    ],
    [
      //L
      [0 + 0.5, 1 + 0.5],
      [1 + 0.5, 1 + 0.5],
      [2 + 0.5, 1 + 0.5],
      [2 + 0.5, 0 + 0.5],
    ],
    [
      //J
      [0 + 0.5, 1 + 0.5],
      [1 + 0.5, 1 + 0.5],
      [2 + 0.5, 1 + 0.5],
      [0 + 0.5, 0 + 0.5],
    ],
    [
      //T
      [0 + 0.5, 1 + 0.5],
      [1 + 0.5, 1 + 0.5],
      [2 + 0.5, 1 + 0.5],
      [1 + 0.5, 0 + 0.5],
    ],
    [
      //O
      [1, 0 + 0.5],
      [2, 0 + 0.5],
      [1, 1 + 0.5],
      [2, 1 + 0.5],
    ],
    [
      //I
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  ];

  export async function initializeTetrisBoard() {
    await initializeTetrominoImages();
  }

  export async function getOffScreenCanvasImage(
    board: Tetromino[] | undefined,
    ghosts: boolean[] | undefined,
    override: number[] | undefined,
  ): Promise<string | undefined> {
    // オフスクリーン用のアプリケーションとコンテナを初回のみ作成
    if (tetrisBoardOffscreenApp === null) {
      tetrisBoardOffscreenApp = new Application();
      tetrisBoardOffscreenSprites = [];
      offscreenBoardContainer = new Container();

      // オフスクリーン用のキャンバスを作成
      if (offscreenCanvas === null) {
        offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.id = "offscreenCanvas";
        offscreenCanvas.style.display = "none";
        document.body.appendChild(offscreenCanvas);
      }

      await initializeBoard(
        tetrisBoardOffscreenApp,
        tetrisBoardOffscreenSprites,
        offscreenBoardContainer,
        offscreenCanvas,
      );
    }

    updateFieldInternal(tetrisBoardOffscreenSprites, board, ghosts, override);
    const data = await tetrisBoardOffscreenApp?.renderer.extract.base64(
      tetrisBoardOffscreenApp.stage,
    );

    return data;
  }

  export async function mount() {
    document.addEventListener("onupdatefield", handleUpdateField);

    tetrisBoardApp = new Application();
    tetrisBoardSprites = [];
    boardContainer = new Container();

    await initializeBoard(
      tetrisBoardApp,
      tetrisBoardSprites,
      boardContainer,
      document.getElementById("canvas") as HTMLCanvasElement,
    );

    tetrisBoardApp.canvas.addEventListener("mousemove", handleMouseMove);

    await adjustCanvasSize();
    window.addEventListener("resize", adjustCanvasSize);

    const containerElement = document.getElementById("canvas");
    if (containerElement) {
      const rect = containerElement.getBoundingClientRect();
      leftPosition = rect.left + window.scrollX;
      topPosition = rect.top + window.scrollY;
    }
  }

  function handleMouseMove(event: MouseEvent) {
    const { clientX, clientY } = event;
    const customEvent = new CustomEvent("onTetrisBoardMove", {
      detail: { clientX, clientY },
    });
    document.dispatchEvent(customEvent);
  }

  function handleUpdateField(event: Event) {
    const detail = (event as CustomEvent).detail;
    const { board, ghosts, override } = detail;
    updateFieldInternal(tetrisBoardSprites, board, ghosts, override);
  }

  export async function unmount() {
    document.removeEventListener("onupdatefield", handleUpdateField);
    tetrisBoardApp?.canvas.removeEventListener("mousemove", handleMouseMove);
    tetrisBoardSprites = [];

    tetrisBoardApp?.destroy();

    // オフスクリーン関連のリソースもクリーンアップ
    if (tetrisBoardOffscreenApp) {
      tetrisBoardOffscreenApp.destroy();
      tetrisBoardOffscreenApp = null;
      tetrisBoardOffscreenSprites = [];
      offscreenBoardContainer = null;
    }

    if (offscreenCanvas) {
      document.body.removeChild(offscreenCanvas);
      offscreenCanvas = null;
    }

    window.removeEventListener("resize", adjustCanvasSize);

    const canvasElement = document.getElementById("canvas");
  }

  function updateFieldInternal(
    boardSprites: CellSprite[],
    board: Tetromino[] | undefined,
    ghosts: boolean[] | undefined,
    override: number[] | undefined,
  ) {
    for (let y = 0; y < TetrisEnv.HEIGHT; y++) {
      for (let x = 0; x < TetrisEnv.WIDTH; x++) {
        let pos = x + y * TetrisEnv.WIDTH;

        if (board) {
          if (boardSprites[pos] == null) return;

          if (override && override[pos]) {
            boardSprites[pos].texture = blockTextures[override[pos]];
          } else if (board[pos] === Tetromino.Empty) {
            boardSprites[pos].texture = Texture.EMPTY;
          } else {
            boardSprites[pos].texture = blockTextures[board[pos]];
          }
        }

        if (ghosts && ghosts[pos]) {
          boardSprites[pos].alpha = 0.5;
        } else {
          boardSprites[pos].alpha = 1.0;
        }
      }
    }
  }

  async function adjustCanvasSize() {
    const canvasElement = tetrisBoardApp?.canvas;
    const containerElement = document.getElementById("canvas");

    if (canvasElement && containerElement) {
      const containerRect = containerElement.getBoundingClientRect();
      const canvasWidth = canvasElement.width;
      const canvasHeight = canvasElement.height;

      if (
        canvasWidth / canvasHeight >
        containerRect.width / containerRect.height
      ) {
        canvasElement.style.width = "100%";
        canvasElement.style.height = "auto";
      } else {
        canvasElement.style.width = "auto";
        canvasElement.style.height = "100%";
      }
    }
  }

  export function createTetrisFieldBg(
    app: Application,
    borderOpacity: number,
    bgOpacity: number,
  ) {
    const graphics = new Graphics()
      .rect(0, 0, app.canvas.width, app.canvas.height)
      .fill({ color: 0x000000, alpha: bgOpacity })
      .rect(0, 0, app.renderer.width, CELL_SIZE * 3)
      .fill({ color: 0x181818, alpha: bgOpacity });

    for (let y = 3; y <= TetrisEnv.HEIGHT; y++) {
      const height = y * CELL_SIZE;

      graphics
        .moveTo(0, height)
        .lineTo(TetrisEnv.WIDTH * CELL_SIZE, height)
        .stroke({ color: 0x3e3e3e, width: 1, alpha: borderOpacity });
    }

    for (let x = 0; x <= TetrisEnv.WIDTH; x++) {
      const width = x * CELL_SIZE;

      graphics
        .moveTo(width, CELL_SIZE * 3)
        .lineTo(width, TetrisEnv.HEIGHT * CELL_SIZE)
        .stroke({ color: 0x3e3e3e, width: 1, alpha: borderOpacity });
    }

    const texture = app.renderer.generateTexture(graphics);
    const sprite = new Sprite(texture);
    return sprite;
  }

  /*
  export function createTetrisFieldBorder(
    app: Application,
    borderOpacity: number,
    bgOpacity: number,
  ) {
    const graphics = new Graphics();
    for (let y = 3; y <= 4; y++) {
      const height = y * CELL_SIZE;

      graphics
        .moveTo(0, height)
        .lineTo(TetrisEnv.WIDTH * CELL_SIZE, height)
        .stroke({ color: 0x3e3e3e, width: 1, alpha: borderOpacity });
    }

    const texture = app.renderer.generateTexture(graphics);
    const sprite = new Sprite(texture);
    return sprite;
  }
*/
  export function initializeCells(
    board_container: Container,
    board_sprites: CellSprite[],
  ) {
    for (let y = 0; y < TetrisEnv.HEIGHT; y++) {
      for (let x = 0; x < TetrisEnv.WIDTH; x++) {
        let cell = new Sprite(Texture.EMPTY) as CellSprite;
        board_sprites.push(cell);
        cell.width = 30;
        cell.height = 30;
        cell.x = x * CELL_SIZE + 1;
        cell.y = y * CELL_SIZE;
        cell.pos = x + y * TetrisEnv.WIDTH;
        cell.eventMode = "static";

        board_container.addChild(cell);
      }
    }
  }

  export function createColumnLabels(board_container: Container) {
    for (let x = 0; x < TetrisEnv.WIDTH; x++) {
      const label = new Text({
        text: x.toString(),
        style: {
          fontFamily: "Arial",
          fontSize: 14,
          fill: 0x616161,
          align: "center",
        },
      });

      // ラベルをセルの中央に配置
      label.eventMode = "none";
      label.x = x * CELL_SIZE + CELL_SIZE / 2 + 20;
      label.y = CELL_SIZE / 2; // セルの縦方向中央に配置
      label.anchor.set(0.5); // 中央揃え

      board_container.addChild(label);
    }
  }

  export function createRowLabels(board_container: Container) {
    for (let y = 0; y < TetrisEnv.HEIGHT; y++) {
      const label = new Text({
        text: String.fromCharCode(65 + y),
        style: {
          fontFamily: "Arial",
          fontSize: 14,
          fill: 0x616161,
          align: "center",
        },
      });

      label.eventMode = "none";
      label.x = 20 / 2;
      label.y = y * CELL_SIZE + CELL_SIZE / 2 + 20;
      label.anchor.set(0.5);

      board_container.addChild(label);
    }
  }

  export async function initializePixijs(
    app: Application,
    canvasParent: HTMLCanvasElement,
  ) {
    await app.init({
      backgroundAlpha: 0,
      width: CELL_SIZE * TetrisEnv.WIDTH + 20,
      height: CELL_SIZE * TetrisEnv.HEIGHT + 20,
      backgroundColor: 0x000000,
    });

    canvasParent.appendChild(app.canvas);
  }

  export async function initializeBoard(
    app: Application,
    boardSprites: CellSprite[],
    boardContainer: Container,
    canvasParent: HTMLCanvasElement,
    borderOpacity: number = 1,
    bgOpacity: number = 1,
  ) {
    await initializePixijs(app, canvasParent);

    boardContainer.addChild(createTetrisFieldBg(app, borderOpacity, bgOpacity));

    //let borderSprite = createTetrisFieldBorder(app, borderOpacity, bgOpacity);
    //boardContainer.addChild(borderSprite);

    app.stage.addChild(boardContainer);

    initializeCells(boardContainer, boardSprites);
    boardContainer.x = 20;
    boardContainer.y = 20;

    let labelContainer = new Container();
    app.stage.addChild(labelContainer);
    createColumnLabels(labelContainer);
    createRowLabels(labelContainer);
  }

  // グローバル変数でテクスチャをキャッシュ
  let cachedBlockTexture: Texture<any> | null = null;
  let cachedBlockImageURL: string | null = null;

  async function initializeTetrominoImages() {
    const canvas = document.createElement("canvas");
    canvas.width = 30 * 4;
    canvas.height = 30 * 3;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const img = new Image();

    await getBlockImageURL().then(async (filePath) => {
      // キャッシュされたテクスチャがあり、同じファイルパスの場合は再利用
      let texture: Texture<any>;
      if (cachedBlockTexture && cachedBlockImageURL === filePath) {
        texture = cachedBlockTexture;
      } else {
        texture = await Assets.load(filePath);
        cachedBlockTexture = texture;
        cachedBlockImageURL = filePath;
      }

      img.src = filePath;
      img.crossOrigin = "anonymous";

      tetrominoBlockTextures = [];
      blockTextures = [];

      img.onload = () => {
        for (let mino_index = 0; mino_index < 7; mino_index++) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < 4; i++) {
            ctx.drawImage(
              img,
              mino_index * 30,
              0,
              30,
              30,
              TETROMINO_SHAPES[mino_index][i][0] * 30,
              TETROMINO_SHAPES[mino_index][i][1] * 30,
              30,
              30,
            );
          }

          tetrominoBlockTextures.push(canvas.toDataURL());
        }

        for (let i = 0; i < 9; i++) {
          const x = i * 30;
          const y = 0;
          const frame = new Rectangle(x, y, 30, 30);
          let texture_temp = new Texture({
            source: texture.source,
            orig: frame,
            frame: frame,
          });
          blockTextures.push(texture_temp);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tetrominoBlockTextures.push(canvas.toDataURL());
        tetrominoBlockTextures.push(canvas.toDataURL());
      };
    });
  }

  async function getBlockImageURL() {
    if (window.IS_WEB_MODE) {
      return "./blocks.png";
    } else {
      return convertFileSrc(await resolveResource("assets/images/blocks.png"));
    }
  }

  export function convertToTetromino(input: string): Tetromino {
    switch (input) {
      case "s":
        return Tetromino.S;
      case "z":
        return Tetromino.Z;
      case "l":
        return Tetromino.L;
      case "j":
        return Tetromino.J;
      case "t":
        return Tetromino.T;
      case "o":
        return Tetromino.O;
      case "i":
        return Tetromino.I;
      default:
        return Tetromino.Empty;
    }
  }

  export function convertFromTetromino(tetromino: Tetromino): string {
    switch (tetromino) {
      case Tetromino.S:
        return "s";
      case Tetromino.Z:
        return "z";
      case Tetromino.L:
        return "l";
      case Tetromino.J:
        return "j";
      case Tetromino.T:
        return "t";
      case Tetromino.O:
        return "o";
      case Tetromino.I:
        return "i";
      default:
        return "";
    }
  }

  export async function getCanvasImage(): Promise<string | undefined> {
    const data = await tetrisBoardApp?.renderer.extract.base64(
      tetrisBoardApp.stage,
    );
    return data;
  }
</script>

<div id="canvas-container">
  <div id="canvas"></div>
</div>

<style>
  #canvas-container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
  }

  #canvas {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: 100%;
    max-height: 100%;
    width: 100%;
    height: 100%;
  }
</style>
