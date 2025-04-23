<script lang="ts" context="module">
  import {
    Application,
    Assets,
    Container,
    Graphics,
    Rectangle,
    Sprite,
    Texture,
  } from "pixi.js";
  import { Tetromino } from "tetris/src/tetromino";
  import { resolveResource } from "@tauri-apps/api/path";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { TetrisEnv } from "tetris/src/tetris_env";

  export const CELL_SIZE = 31;

  export interface CellSprite extends Sprite {
    pos: number;
  }

  export let tetrominoBlockTextures: string[];

  export let tetrisBoardApp: Application | null;
  //	let tetrisBoardOffscreenApp: Application | null;
  let blockTextures: Texture<any>[];
  //let tetrisBoardBgSprite: Sprite | null;
  //let tetrisOffScreenBoardBgSprite: Sprite | null;

  export let tetrisBoardSprites: CellSprite[];
  //	let tetrisBoardOffscreenSprites: CellSprite[];
  let boardContainer: Container;
  let unlistenBoardUpdater: any;
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
    override: number[] | undefined
  ): Promise<string | undefined> {
    const tetrisBoardOffscreenApp = new Application();
    const tetrisBoardOffscreenSprites: CellSprite[] = [];
    const offscreenBoardContainer = new Container();
    await initializeBoard(
      tetrisBoardOffscreenApp,
      tetrisBoardOffscreenSprites,
      offscreenBoardContainer,
      document.getElementById("offscreenCanvas") as HTMLCanvasElement
    );

    update_field(tetrisBoardOffscreenSprites, board, ghosts, override);
    const data = await tetrisBoardOffscreenApp?.renderer.extract.base64(
      tetrisBoardOffscreenApp.stage
    );

    tetrisBoardOffscreenApp.destroy();
    return data;
  }

  export async function mount() {
    unlistenBoardUpdater = await listen<{
      board: Tetromino[] | undefined;
      ghosts: boolean[] | undefined;
      override: number[] | undefined;
    }>("onupdatefield", (event) => {
      update_field(
        tetrisBoardSprites,
        event.payload.board,
        event.payload.ghosts,
        event.payload.override
      );
    });

    tetrisBoardApp = new Application();
    tetrisBoardSprites = [];
    boardContainer = new Container();

    await initializeBoard(
      tetrisBoardApp,
      tetrisBoardSprites,
      boardContainer,
      document.getElementById("canvas") as HTMLCanvasElement
    );
  }

  export async function unmount() {
    tetrisBoardSprites = [];
    //	tetrisBoardSprites.forEach((sprite) =>
    //		boardContainer.removeChild(sprite),
    //	);
    tetrisBoardApp?.destroy();
    unlistenBoardUpdater();
  }
  function update_field(
    boardSprites: CellSprite[],
    board: Tetromino[] | undefined,
    ghosts: boolean[] | undefined,
    override: number[] | undefined
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

  export function drawTetrisFieldBg(
    app: Application,
    borderOpacity: number,
    bgOpacity: number
  ) {
    const bgHexOpacity = Math.round(bgOpacity * 255)
      .toString(16)
      .padStart(2, "0");
    const graphics = new Graphics()
      .rect(0, 0, app.canvas.width, app.canvas.height)
      .fill(`0x000000${bgHexOpacity}`)
      .rect(0, 0, app.renderer.width, CELL_SIZE * 3)
      .fill(`0x1c1c1c${bgHexOpacity}`);

    for (let y = CELL_SIZE * 3; y <= app.canvas.height; y += CELL_SIZE) {
      graphics
        .moveTo(0, y)
        .lineTo(app.canvas.width, y)
        .stroke({ color: 0x3e3e3e, width: 1, alpha: borderOpacity });
    }

    for (let x = 0; x <= app.renderer.width; x += CELL_SIZE) {
      graphics
        .moveTo(x, CELL_SIZE * 3)
        .lineTo(x, app.renderer.height)
        .stroke({ color: 0x3e3e3e, width: 1, alpha: borderOpacity });
    }

    const texture = app.renderer.generateTexture(graphics);
    const sprite = new Sprite(texture);
    return sprite;
  }

  export function initializeCells(
    board_container: Container,
    board_sprites: CellSprite[]
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

  export async function initializePixijs(
    app: Application,
    canvasParent: HTMLCanvasElement
  ) {
    await app.init({
      backgroundAlpha: 0,
      width: CELL_SIZE * TetrisEnv.WIDTH,
      height: CELL_SIZE * TetrisEnv.HEIGHT,
    });

    canvasParent.appendChild(app.canvas);
  }

  export async function initializeBoard(
    app: Application,
    boardSprites: CellSprite[],
    boardContainer: Container,
    canvasParent: HTMLCanvasElement,
    borderOpacity: number = 1,
    bgOpacity: number = 1
  ) {
    await initializePixijs(app, canvasParent);
    boardContainer.addChild(drawTetrisFieldBg(app, borderOpacity, bgOpacity));
    app.stage.addChild(boardContainer);

    initializeCells(boardContainer, boardSprites);
  }

  async function initializeTetrominoImages() {
    const canvas = document.createElement("canvas");
    canvas.width = 30 * 4;
    canvas.height = 30 * 3;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const img = new Image();

    await resolveResource("assets/images/blocks.png").then(async (result) => {
      const filePath = convertFileSrc(result);
      const texture = await Assets.load(filePath);

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
              30
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
      tetrisBoardApp.stage
    );
    return data;
  }
</script>

<div id="canvas"></div>
<div id="offscreenCanvas" style="display: none;"></div>

<style>
  #canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
