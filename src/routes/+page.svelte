<script lang="ts">
  import BottomBar from "../components/bottomBar.svelte";
  import { onDestroy, onMount } from "svelte";
  import { get, writable, type Writable } from "svelte/store";
  import { type Pages } from "tetris-fumen";
  import {
    boardViewContent,
    fields,
    fieldIndex,
    gameConfig,
    menuItems,
    MenuItem as StoreMenuItem,
    MenuItemType,
    BoardViewContentType,
    overlayBoardViewContent,
    OverrideBoardViewContentType,
    teachableMachineModel,
  } from "../store.ts";
  import { TetrisEnv } from "tetris/src/tetris_env";
  import {
    BaseDirectory,
    exists,
    readTextFile,
    writeTextFile,
  } from "@tauri-apps/plugin-fs";
  import { initializeTetrisBoard } from "../components/fields/tetrisBoard.svelte";
  import { GameConfig } from "../gameConfig.ts";
  import MenuBar from "../components/menuBar.svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { loadTranslations, t } from "../translations/translations.ts";
  import { TeachableMachine } from "../teachableMachine.ts";
  import { exit } from "@tauri-apps/plugin-process";

  import { shortcuts } from "../utils/shortcuts.ts";
  import SplashScreen from "../components/splashScreen.svelte";
  import {
    fumenImage,
    fumenPages,
    registerCommands,
  } from "../registry/commands/builtinCommands.ts";
  import TetrisEdit from "../components/fields/tetrisEdit.svelte";
  import TetrisPlay from "../components/fields/tetrisPlay.svelte";
  import TetrominoSelect from "../components/fields/tetrominoSelect.svelte";
  import FumenImportPanel from "../components/fields/fumenImportPanel.svelte";
  import Preferences from "../components/fields/preferences.svelte";
  import GifExportPanel from "../components/fields/gifExportPanel.svelte";
  import ImageImportPanel from "../components/fields/imageImportPanel.svelte";
  import { commands } from "../utils/commands.ts";
  import { registerShortcuts } from "../registry/shortcuts/builtinShortcuts.ts";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

  // グローバル変数
  let rightComponents: Writable<any[]>;
  let leftComponents: Writable<any[]>;
  let fieldComponents: Writable<Map<BoardViewContentType, any>>;
  let currentFieldComponent: any;
  let promise: Promise<void>;
  let splashScreenVisible = true;
  let splashScreenHidden = false;
  let splashScreenStatusText = "Preparing";
  let splashScreenShowResetOption = false;
  let overlayComponents: Writable<Map<OverrideBoardViewContentType, any>>;
  let currentOverrideComponent: any;

  let unlistenResize: UnlistenFn;
  let resized: boolean = false;

  fieldComponents = writable(new Map());
  overlayComponents = writable(new Map());

  setTimeout(() => (splashScreenShowResetOption = true), 5000);
  promise = initializeInSplash().then(() => {
    splashScreenVisible = false;
    setTimeout(() => (splashScreenHidden = true), 300);
  });

  onMount(async () => {
    unlistenResize = await listen<string>("tauri://resize", async (event) => {
      resized = true;

      const size = (await invoke("get_window_size")) as any;
      gameConfig.update((config) => {
        if (config) {
          config.windowSize = {
            width: size[0],
            height: size[1],
          };
        }
        return config;
      });
      /*
      const ASPECT_RATIO = 10 / 23;

      const currentSize = await getCurrentWindow().outerSize();
      const scaleFactor = await getCurrentWindow().scaleFactor();

      let idealWidth = currentSize.height * scaleFactor * ASPECT_RATIO;
      let newMinSize = new LogicalSize({
        width: currentSize.height * scaleFactor * (1 / 2),
        height: 400 * scaleFactor,
      });

      getCurrentWindow().setMinSize(newMinSize);
      console.log(getCurrentWindow().onResized)
      //getCurrentWindow().setSize(newMinSize);*/
    });

    await promise;

    if (get(gameConfig)?.windowSize != undefined) {
      invoke("set_window_size", {
        window: getCurrentWindow(),
        width: get(gameConfig)?.windowSize?.width,
        height: get(gameConfig)?.windowSize?.height,
      });
    }

    invoke("initialize_window");

    console.log($t("common.console-warning"), "color: red; font-size: 2em;");

    fieldIndex.set(0);

    fields.update((currentFields) => ({
      ...currentFields,
      [0]: new TetrisEnv(),
    }));

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleShortcutInternal);
    window.addEventListener("mouseup", handleMouseButton);

    fieldComponents.set(
      new Map([
        [BoardViewContentType.TetrisEdit, TetrisEdit],
        [BoardViewContentType.TetrisPlay, TetrisPlay],
      ])
    );
    currentFieldComponent = TetrisEdit;

    overlayComponents.set(
      new Map<OverrideBoardViewContentType, any>([
        [OverrideBoardViewContentType.TetrominoSelectHold, TetrominoSelect],
        [OverrideBoardViewContentType.TetrominoSelectNext, TetrominoSelect],
        [OverrideBoardViewContentType.ImportFumenText, FumenImportPanel],
        [OverrideBoardViewContentType.Preferences, Preferences],
        [OverrideBoardViewContentType.GifExport, GifExportPanel],
        [OverrideBoardViewContentType.ImportImage, ImageImportPanel],
      ])
    );

    rightComponents = writable([]);
    leftComponents = writable([]);

    const components = [
      { name: "tetrisNext", parent: rightComponents },
      { name: "tetrisBlock", parent: rightComponents },
      { name: "tetrisSnapshot", parent: rightComponents },
      { name: "tetrisHold", parent: leftComponents },
      { name: "tetrisBot", parent: leftComponents },
    ];

    for (const { name, parent } of components) {
      await addBuiltinComponent(name, parent);
    }

    await commands.executeCommand("fumen.new", false);
  });

  onDestroy(() => {
    shortcuts.unregisterAllShortcuts();
    commands.unregisterAllCommands();

    window.removeEventListener("keydown", handleShortcutInternal);
    window.removeEventListener("contextmenu", handleContextMenu);
    window.removeEventListener("mouseup", handleMouseButton);
    unlistenResize();
  });

  async function initializeInSplash() {
    splashScreenStatusText = "Loading config files (1/4)";
    let configExists = await exists("config.json", {
      baseDir: BaseDirectory.Resource,
    });
    if (!configExists) {
      let gameConfig = GameConfig.default();
      let locale = Intl.DateTimeFormat().resolvedOptions().locale;
      console.log(locale);
      if (locale === "ja-JP") {
        gameConfig.language = "ja";
      } else {
        gameConfig.language = "en";
      }

      await writeTextFile("config.json", gameConfig.toJSON(), {
        baseDir: BaseDirectory.Resource,
      });
    }

    let jsonStr = await readTextFile("config.json", {
      baseDir: BaseDirectory.Resource,
    });
    let configJson = GameConfig.fromJSON(jsonStr);

    gameConfig.set(configJson);

    gameConfig.subscribe((config) => {
      writeTextFile("config.json", config!.toJSON(), {
        baseDir: BaseDirectory.Resource,
      });
    });

    console.log(configJson.language);

    splashScreenStatusText = "Loading translations (2/4)";
    await loadTranslations(configJson.language ?? "en", "/");

    splashScreenStatusText = "Loading fumen recognizer (3/4)";
    await initializeTeachableMachine();

    splashScreenStatusText = "Loading the others (4/4)";
    await initializeTetrisBoard();

    registerCommands();
    registerShortcuts();

    // await load;
    menuItems.set([
      new StoreMenuItem(
        MenuItemType.Normal,
        $t("common.menu-file"),
        "",
        () => {},
        [
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-new"),
            shortcuts.getKeyById("fumen.shortcut.new") ?? "",
            () => {
              commands.executeCommand("fumen.new", true);
            }
          ),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-open") + "...",
            shortcuts.getKeyById("fumen.shortcut.open") ?? "",
            () => {
              commands.executeCommand("fumen.open");
            }
          ),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-save") + "...",
            shortcuts.getKeyById("fumen.shortcut.save") ?? "",
            () => {
              commands.executeCommand("fumen.save");
            }
          ),
          new StoreMenuItem(MenuItemType.Separator, "", "", () => {}),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-exit"),
            "Alt+F4",
            async () => {
              await exit();
            }
          ),
        ]
      ),
      new StoreMenuItem(
        MenuItemType.Normal,
        $t("common.menu-edit"),
        "",
        () => {},
        [
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-undo"),
            shortcuts.getKeyById("fumen.shortcut.undo") ?? "",
            () => {
              commands.executeCommand("fumen.undo");
            }
          ),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-redo"),
            shortcuts.getKeyById("fumen.shortcut.redo") ?? "",
            () => {
              commands.executeCommand("fumen.redo");
            }
          ),
          new StoreMenuItem(MenuItemType.Separator, "", "", () => {}),

          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-copy-as-fumen"),
            shortcuts.getKeyById("fumen.shortcut.copy-as-fumen") ?? "",
            () => {
              commands.executeCommand("fumen.copy-as-fumen");
            }
          ),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-copy-as-image"),
            shortcuts.getKeyById("fumen.shortcut-copy-as-image") ?? "",
            () => {
              commands.executeCommand("fumen.copy-as-image");
            }
          ),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-copy-as-gif"),
            "",
            () => {
              overlayBoardViewContent.set(
                OverrideBoardViewContentType.GifExport
              );
            },
            undefined,
            false,
            true
          ),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-paste"),
            shortcuts.getKeyById("fumen.shortcut.paste") ?? "",
            () => {
              commands.executeCommand("fumen.paste");
            }
          ),
          new StoreMenuItem(MenuItemType.Separator, "", "", () => {}),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-preferences"),
            "",
            () =>
              overlayBoardViewContent.set(
                OverrideBoardViewContentType.Preferences
              )
          ),
        ]
      ),
      new StoreMenuItem(
        MenuItemType.Normal,
        $t("common.menu-run"),
        "",
        () => {},
        [
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-start"),
            shortcuts.getKeyById("fumen.shortcut.play") ?? "",
            () => boardViewContent.set(BoardViewContentType.TetrisPlay)
          ),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-stop"),
            shortcuts.getKeyById("fumen.shortcut.edit") ?? "",
            () => boardViewContent.set(BoardViewContentType.TetrisEdit)
          ),
        ]
      ),
      new StoreMenuItem(
        MenuItemType.Normal,
        $t("common.menu-help"),
        "",
        () => {},
        [
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-join-discord"),
            "",
            () => openUrl("https://discord.gg/F958vMFfcV")
          ),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-support-me-on-ko-fi"),
            "",
            () => openUrl("https://ko-fi.com/csdotnet")
          ),
        ]
      ),
    ]);

    splashScreenStatusText = "Done";
  }

  async function initializeTeachableMachine() {
    const URL = get(gameConfig)?.fumenImageRecognitionModelURL;
    const metadata = URL + "metadata.json";
    const model = URL + "model.json";

    const teachableMachine = new TeachableMachine(model, metadata);
    await teachableMachine.init();
    teachableMachineModel.set(teachableMachine);
  }

  function handleShortcutInternal(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === "f") {
      event.preventDefault();
      return;
    }

    shortcuts.handleShortcut(event);
  }

  async function addBuiltinComponent(name: string, parent: Writable<any[]>) {
    const component = (await import(`../components/panels/${name}.svelte`))
      .default;
    parent.update((currentComponents) => {
      return [...currentComponents, component];
    });
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  async function handleMouseButton(event: MouseEvent) {
    if (event.button === 0) {
      /* if (resized) {
        const size = (await invoke("get_window_size")) as any;
        console.log(size);
        gameConfig.update((config) => {
          if (config) {
            config.windowSize = {
              width: size.width,
              height: size.height,
            };
          }
          return config;
        });
        resized = false;
      }*/
    } else if (event.button === 3) {
      commands.executeCommand("fumen.undo");
      event.preventDefault();
    } else if (event.button === 4) {
      commands.executeCommand("fumen.redo");
      event.preventDefault();
    }
  }

  $: {
    const components = get(fieldComponents);
    currentFieldComponent = components.get($boardViewContent) || null;
  }

  $: {
    const components = get(overlayComponents);
    currentOverrideComponent = components.get($overlayBoardViewContent) || null;
  }
</script>

<main>
  <SplashScreen
    visible={splashScreenVisible}
    hidden={splashScreenHidden}
    statusText={splashScreenStatusText}
    showResetOption={splashScreenShowResetOption}
  />
  {#await promise then _}
    <main>
      <MenuBar></MenuBar>
      <div id="main-container">
        <div class="side_panel">
          {#each $leftComponents as Component}
            <div>
              <Component></Component>
            </div>
          {/each}
        </div>

        <div
          style="width:calc(100% - 110px - 110px);position:relative;"
          id="main_panel"
        >
          <!-- Dynamic Board -->

          {#if currentFieldComponent}
            <svelte:component this={currentFieldComponent}></svelte:component>
          {/if}

          <!-- Board Override -->
          {#if currentOverrideComponent}
            <svelte:component
              this={currentOverrideComponent}
              {...$overlayBoardViewContent ===
              OverrideBoardViewContentType.ImportFumenText
                ? { fumenPages }
                : $overlayBoardViewContent ===
                    OverrideBoardViewContentType.ImportImage
                  ? { fumenImage }
                  : {}}
            ></svelte:component>
          {/if}

          <div id="cursors"></div>
        </div>
        <div class="side_panel">
          {#each $rightComponents as Component}
            <div>
              <Component></Component>
            </div>
          {/each}
        </div>
      </div>
      <BottomBar></BottomBar>
    </main>
  {/await}
</main>

<style>
  @font-face {
    font-family: "Inter";
    src: url("../assets/fonts/inter.ttf") format("ttf");
  }

  .side_panel {
    background-color: #2f2f2f;
    width: 110px;
    border-left: 1px solid #3e3e3e;
    overflow-y: auto;
  }

  .side_panel::-webkit-scrollbar {
    width: 5px;
  }
  .side_panel::-webkit-scrollbar-track {
    background: #1c1c1c;
  }
  .side_panel::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  .side_panel::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  :root {
    user-select: none;
    -webkit-user-drag: none;
    font-family: Inter, sans-serif;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;

    color: #f6f6f6;
    background-color: #1c1c1c;

    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-text-size-adjust: 100%;
    cursor: url("src/assets/images/cursor.svg");

    overflow: hidden;
  }

  main {
    position: absolute;
    left: 0;
    top: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    margin: 0;

    display: flex;
    flex-direction: column;
  }

  #main-container {
    width: 100%;
    height: calc(100% - 20px - 30px - 5px);
    display: flex;
    border-top: 1px solid #3e3e3e;
    border-bottom: 1px solid #3e3e3e;
    box-sizing: border-box;
  }

  #cursors {
    width: 100%;
    height: 100%;
  }
</style>
