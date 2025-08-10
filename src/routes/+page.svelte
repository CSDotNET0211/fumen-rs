<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { get, writable, type Writable } from "svelte/store";

  import { GameConfig } from "../app/gameConfig.ts";
  import { loadTranslations, t } from "../translations/translations.ts";
  import { TeachableMachine } from "../teachableMachine.ts";

  import { shortcuts } from "../core/shortcuts/shortcuts.ts";

  import { registerShortcuts } from "../core/shortcuts/builtinShortcuts.ts";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import {
    currentWindow,
    initializeWindows,
    windowComponent,
    WindowFadeDuration,
    WindowType,
  } from "../app/stores/window.ts";
  import {
    currentFieldIndex,
    initializeDataStore,
  } from "../app/stores/data.ts";
  import { commands } from "../core/commands/commands.ts";
  import MenuBar from "../features/common/menu/menuBar.svelte";
  import StatusBar from "../features/common/status/statusBar.svelte";
  import { fade } from "svelte/transition";
  import {
    initializeFields,
    initializeOverlayFields,
    initializePanels,
  } from "../features/windows/field/field.ts";
  import {
    gameConfig,
    loadGameConfigOrInitialize,
  } from "../app/stores/config.ts";
  import { initializeTetrisBoard } from "../features/windows/field/modules/tetrisBoard.svelte";
  import { registerCommands } from "../core/commands/builtinCommands.ts";
  import { reloadMenuItems } from "../features/common/menu/menu.ts";
  import { reloadStatusPanels } from "../features/common/status/status.ts";
  import { initialize } from "../core/commands/newCommands.ts";
  import { BSON } from "bson";
  import { unknownThumbnailBase64 } from "../app/stores/misc.ts";
  import { initializeDatabase } from "../core/nodes/db.ts";
  import {
    NodeUpdater,
    nodeUpdater,
  } from "../core/nodes/NodeUpdater/nodeUpdater.ts";
  import { LocalNodeUpdater } from "../core/nodes/NodeUpdater/localNodeUpdater.ts";

  window.IS_WEB_MODE = false;

  let unlistenSaveWindowSizeOnResize: UnlistenFn;

  onMount(async () => {
    // if (!window.IS_WEB_MODE) {
    try {
      unlistenSaveWindowSizeOnResize = await listen<string>(
        "tauri://save-window-size",
        async (event) => {
          const size = await getCurrentWindow().innerSize();
          gameConfig.update((config) => {
            if (config) {
              config.windowSize = {
                width: size.width,
                height: size.height,
              };
            }
            return config;
          });
        }
      );

      if (get(gameConfig)?.windowSize != undefined) {
        invoke("set_window_size", {
          window: getCurrentWindow(),
          width: get(gameConfig)?.windowSize?.width,
          height: get(gameConfig)?.windowSize?.height,
        });
      }

      invoke("initialize_window");
    } catch (e) {
      console.error("Error setting up window size listener:");
    }
    // }

    //TODO: ごちゃつきすぎ
    await loadGameConfigOrInitialize();
    await loadTranslations("en", "/");
    await initializeWindows();
    currentWindow.set(WindowType.Splash);
    await initializeFields();
    await initializePanels();
    await initializeOverlayFields();
    await initializeTetrisBoard();
    await registerCommands();
    await registerShortcuts();
    await initializeTeachableMachine();
    await initialize();
    await initializeDatabase();
    reloadMenuItems();
    reloadStatusPanels();

    nodeUpdater.set(new LocalNodeUpdater());

    const response = await fetch("./static/unknown.png");
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      unknownThumbnailBase64.set(reader.result as string);
    };
    reader.readAsDataURL(blob);

    console.log($t("common.console-warning"), "color: red; font-size: 2em;");

    //await new Promise((resolve) => setTimeout(resolve, 1000));
    currentWindow.set(WindowType.Field);

    await commands.executeCommand("fumen.new", false);
    initializeDataStore();
    /*
    let result: Uint8Array = BSON.serialize(get(currentFieldNode)!);
    console.log(result);
    console.log("Byte size:", result.byteLength);
    const doc = BSON.deserialize(result);
    console.log(doc);*/

    window.addEventListener("contextmenu", disableContextMenu);
    window.addEventListener("keydown", handleShortcutInternal);
    window.addEventListener("mouseup", handleMouseButton);
    //currentWindow;

    try {
      console.log(await invoke("get_args"));
    } catch (e) {
      console.error("Error invoking get_args:");
    }
  });

  onDestroy(() => {
    shortcuts.unregisterAllShortcuts();
    commands.unregisterAllCommands();

    window.removeEventListener("keydown", handleShortcutInternal);
    window.removeEventListener("contextmenu", disableContextMenu);
    window.removeEventListener("mouseup", handleMouseButton);
    unlistenSaveWindowSizeOnResize();
  });

  async function initializeTeachableMachine() {
    const URL = get(gameConfig)?.fumenImageRecognitionModelURL;
    const metadata = URL + "metadata.json";
    const model = URL + "model.json";

    const teachableMachine = new TeachableMachine(model, metadata);
    await teachableMachine.init();
    //teachableMachineModel.set(teachableMachine);
  }

  function handleShortcutInternal(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === "f") {
      event.preventDefault();
      return;
    }

    shortcuts.handleShortcut(event);
  }

  function disableContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  async function handleMouseButton(event: MouseEvent) {
    if (event.button === 3) {
      commands.executeCommand("fumen.undo");
      event.preventDefault();
    } else if (event.button === 4) {
      commands.executeCommand("fumen.redo");
      event.preventDefault();
    }
  }

  function handleTransitionEnd(event: Event) {
    WindowFadeDuration.set(1);
  }
</script>

<main>
  <MenuBar></MenuBar>
  <div
    style="flex-grow: 1; display: flex; flex-direction: column; position: relative;"
  >
    {#if $windowComponent}
      {#key $windowComponent}
        <div
          transition:fade={{ duration: $WindowFadeDuration }}
          on:outroend={handleTransitionEnd}
          style="position: absolute; width: 100%; height: 100%; left: 0; top: 0;"
        >
          <svelte:component this={$windowComponent} />
        </div>
      {/key}
    {/if}
  </div>
  <StatusBar></StatusBar>
</main>

<div id="offscreenCanvas" style="display: none;"></div>

<style>
  @font-face {
    font-family: "Inter";
    src: url("../assets/fonts/inter.ttf") format("ttf");
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
</style>
