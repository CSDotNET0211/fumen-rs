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
  import { TetrisEnv } from "tetris";
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

  fieldComponents = writable(new Map());
  overlayComponents = writable(new Map());

  setTimeout(() => (splashScreenShowResetOption = true), 5000);
  promise = initializeInSplash().then(() => {
    splashScreenVisible = false;
    setTimeout(() => (splashScreenHidden = true), 300);
  });

  onMount(async () => {
    await promise;

    console.log($t("common.console-warning"), "color: red; font-size: 2em;");

    fieldIndex.set(0);

    fields.update((currentFields) => ({
      ...currentFields,
      [0]: new TetrisEnv(),
    }));

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleShortcutInternal);
    window.addEventListener("mouseup", handleMouseButton);

    /*const tetrisEdit = (
			await import(`../components/field/tetrisEdit.svelte`)
		).default;
		const tetrisPlay = (
			await import(`../components/field/tetrisPlay.svelte`)
		).default;*/

    fieldComponents.set(
      new Map([
        [BoardViewContentType.TetrisEdit, TetrisEdit],
        [BoardViewContentType.TetrisPlay, TetrisPlay],
      ])
    );
    currentFieldComponent = TetrisEdit;
    /*
 
		const tetrominoSelect = (
			await import(`../components/fields/tetrominoSelect.svelte`)
		).default;
		const fumenImportPanel = (
			await import(`../components/fields/fumenImportPanel.svelte`)
		).default;
		const preferences = (
			await import(`../components/fields/preferences.svelte`)
		).default;
		const gifExportPanel = (
			await import(`../components/fields/gifExportPanel.svelte`)
		).default;
		const imageImportPanel = (
			await import(`../components/fields/imageImportPanel.svelte`)
		).default;*/

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
            shortcuts.getKeyById("newShortcut") ?? "",
            () => {
              commands.executeCommand("fumen.new", true);
            }
          ),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-open") + "...",
            shortcuts.getKeyById("openShortcut") ?? "",
            () => {
              commands.executeCommand("fumen.open");
            }
          ),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-save") + "...",
            shortcuts.getKeyById("saveShortcut") ?? "",
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
            shortcuts.getKeyById("pasteShortcut") ?? "",
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
            shortcuts.getKeyById("playShortcut") ?? "",
            () => boardViewContent.set(BoardViewContentType.TetrisPlay)
          ),
          new StoreMenuItem(
            MenuItemType.Normal,
            $t("common.menu-stop"),
            shortcuts.getKeyById("editShortcut") ?? "",
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

  function handleMouseButton(event: MouseEvent) {
    if (event.button === 3) {
      commands.executeCommand("fumen.undo");
    } else if (event.button === 4) {
      commands.executeCommand("fumen.redo");
    }
    event.preventDefault();
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
    <!-- Main application logic -->
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

        <div style="flex:1;position:relative;" id="main_panel">
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

          <!-- Dynamic Board -->
          {#if currentFieldComponent}
            <svelte:component this={currentFieldComponent}></svelte:component>
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
