<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { writable, get, type Writable } from "svelte/store";
  import { RotationType } from "tetris/src/rotation_type";
  import { openPath } from "@tauri-apps/plugin-opener";
  import { Command } from "@tauri-apps/plugin-shell";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { gameConfig } from "../../../app/stores/config";
  import { locale, t } from "../../../translations/translations";
  import { GameConfig } from "../../../app/gameConfig";
  import { currentWindow, WindowType } from "../../../app/stores/window";
  import Panel from "./panel.svelte";
  import { SortableList } from "@jhubbardsf/svelte-sortablejs";

  import { flip } from "svelte/animate";
  import { dndzone } from "svelte-dnd-action";
  import List from "./list.svelte";
  const flipDurationMs = 50;

  let editingKey = writable<string | null>(null);
  let selectedKeymap = writable<string>("TetrisPlay");
  let selectedPreset = writable<string>("Tetris");

  /*
  let right_components = writable<string[]>(["Next", "Block", "Snapshot"]);
  let left_components = writable<string[]>(["Hold", "View"]);
  let available_components = writable<string[]>([
    "Next",
    "Block",
    "Snapshot",
    "Hold",
    "View",
  ]);
*/

  //最初に初期化でleft,rightに入れるやつを入れる、その後使われてないやつをavailableに
  const COMPONENT_ITEMS = [
    "TetrisNext",
    "TetrisBlockSelect",
    "Snapshot",
    "TetrisHold",
    "BotSuggestions",
    "TetrisFieldEditor",
    "CanvasSwap",
  ];
  let leftComponentItems: { id: string }[] = [];
  let rightComponentItems: { id: string }[] = [];
  let availableComponentItems: { id: string }[] = [];

  function changeLanguage(event: Event) {
    const language = (event.target as HTMLSelectElement).value;
    gameConfig.update((config) => {
      if (config) config.language = language;
      return config;
    });
    locale.set(language);
    alert($t("common.dialog-language-update"));
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyInput);
    loadPanelComponents($gameConfig!.currentPreset!);

    // Find all range sliders and set initial --value
    sliderElements = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="range"]')
    );
    sliderElements.forEach((slider) => {
      updateSliderValue(slider);
      const listener = () => updateSliderValue(slider);
      slider.addEventListener("input", listener);
      sliderListeners.push(() => slider.removeEventListener("input", listener));
    });
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeyInput);

    // Remove all slider listeners
    sliderListeners.forEach((remove) => remove());
    sliderListeners = [];
    sliderElements = [];
  });

  function loadPanelComponents(preset: string) {
    const presets = $gameConfig!.panelPresets;
    const leftItems = presets!.presets[preset].left;
    const rightItems = presets!.presets[preset].right;

    leftComponentItems = leftItems.map((item) => ({
      id: item,
    }));
    rightComponentItems = rightItems.map((item) => ({
      id: item,
    }));

    const usedItems = [...leftItems, ...rightItems];
    const availableItems = COMPONENT_ITEMS.filter(
      (item) => !usedItems.includes(item)
    );
    availableComponentItems = availableItems.map((item) => ({
      id: item,
    }));
  }

  function applyPanelPreset(type: string, items: { id: string }[]) {
    console.log(type, items);

    const presets = $gameConfig!.panelPresets;

    switch (type) {
      case "left":
        gameConfig.update((config) => {
          if (config) {
            config.panelPresets!.presets[
              config.panelPresets!.currentPreset
            ].left = items.map((item) => item.id);
          }
          return config;
        });
        break;
      case "right":
        gameConfig.update((config) => {
          if (config) {
            config.panelPresets!.presets[
              config.panelPresets!.currentPreset
            ].right = items.map((item) => item.id);
          }
          return config;
        });
        break;
      default:
        throw new Error(`Unknown panel type: ${type}`);
    }
  }

  function onComponentPanelSelectChanged(event: Event) {
    loadPanelComponents((event.target as HTMLSelectElement).value);
  }

  function startEditing(key: string) {
    editingKey.set(key);
  }

  function stopEditing() {
    editingKey.set(null);
  }

  function handleKeyInput(event: KeyboardEvent) {
    event.preventDefault();
    const key = get(editingKey);
    const keymapName = get(selectedKeymap);

    gameConfig.update((config: GameConfig | null) => {
      if (!config) return config;

      if (key && config.keymaps?.has(keymapName)) {
        config.keymaps.get(keymapName)![key].key = event.code;
        stopEditing();
      }

      return config;
    });
  }

  function back(event: any) {
    console.log("back", event);
    currentWindow.set(WindowType.Field);
  }

  function resetGameConfig() {
    gameConfig.set(GameConfig.default());
    alert($t("common.preferences-reset-success"));
  }

  async function openExecutableFolder() {
    await invoke("reveal_config_file_in_explorer");
  }

  async function resetWindowStatus() {
    gameConfig.update((config) => {
      if (config) {
        config.windowSize = undefined;
      }

      return config;
    });

    const win = getCurrentWindow();
    const factor = await win.scaleFactor();
    invoke("set_window_size", {
      window: win,
      width: Math.round(532 * factor),
      height: Math.round(770 * factor),
    });
  }

  function removeComponent(panel: Writable<string[]>, index: number) {
    panel.update((components) => {
      components.splice(index, 1);
      return [...components];
    });
  }

  function moveComponentBetweenPanels(
    fromPanel: Writable<string[]>,
    toPanel: Writable<string[]>,
    index: number
  ) {
    fromPanel.update((fromComponents) => {
      const [moved] = fromComponents.splice(index, 1);
      toPanel.update((toComponents) => [...toComponents, moved]);
      return [...fromComponents];
    });
  }

  // Helper to update --value for a slider
  function updateSliderValue(slider: HTMLInputElement) {
    slider.style.setProperty(
      "--value",
      ((Number(slider.value) - Number(slider.min)) /
        (Number(slider.max) - Number(slider.min))) *
        100 +
        "%"
    );
  }

  let sliderElements: HTMLInputElement[] = [];
  let sliderListeners: (() => void)[] = [];
</script>

<div id="container">
  <button id="back" onclick={back}>✖</button>
  <Panel
    title={$t("common.preferences-keymap")}
    description="ショートカットや、キーコンフィグに関する設定を行います。"
  >
    <!-- svelte-ignore a11y_label_has_associated_control -->

    {#if $gameConfig?.keymaps}
      <select bind:value={$selectedKeymap}>
        {#each Array.from($gameConfig.keymaps.keys()) as keymap}
          <option value={keymap}>{keymap}</option>
        {/each}
      </select>
    {/if}
    <table>
      <thead>
        <tr>
          <th>Key</th>
          <th>Binding</th>
        </tr>
      </thead>
      <tbody>
        {#if $gameConfig?.keymaps?.get($selectedKeymap)}
          {#each Object.entries($gameConfig.keymaps.get($selectedKeymap) || {}) as [key, { key: value, editable, title }]}
            <tr {title}>
              <td
                class:non-editable={!editable}
                onclick={() => (editable ? startEditing(key) : null)}>{key}</td
              >
              <td
                class:non-editable={!editable}
                onclick={() => (editable ? startEditing(key) : null)}
              >
                {#if $editingKey === key}
                  <span>{$t("common.preferences-press-any-key")}...</span>
                {:else}
                  {value}
                {/if}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </Panel>

  <Panel
    title={$t("common.preferences-game")}
    description="ゲームの設定を変更します。"
  >
    <label for="rotation-system"
      >{$t("common.preferences-rotation-system")}</label
    >
    <select id="rotation-system" bind:value={$gameConfig!.rotationType}>
      <option value={RotationType.SRS}>SRS</option>
      <option value={RotationType.SRSPlus}>SRS+</option>
    </select>
    <div>
      <label for="ghost-piece">{$t("common.preferences-ghost-piece")}</label>
      <input
        id="ghost-piece"
        type="checkbox"
        bind:checked={$gameConfig!.ghostPiece}
      />
    </div>

    <div class="game-settings">
      <div class="setting">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>DAS</label>
        <input
          type="range"
          bind:value={$gameConfig!.das}
          min="2"
          max="20"
          step="1"
        />
        <input
          type="number"
          bind:value={$gameConfig!.das}
          min="2"
          max="20"
          step="1"
          class="value-input"
          onkeydown={(e) => e.stopPropagation()}
        />
      </div>
      <div class="setting">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>ARR</label>
        <input
          type="range"
          bind:value={$gameConfig!.arr}
          min="0"
          max="10"
          step="1"
        />
        <input
          type="number"
          bind:value={$gameConfig!.arr}
          min="0"
          max="10"
          step="1"
          class="value-input"
          onkeydown={(e) => e.stopPropagation()}
        />
      </div>
      <div class="setting">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>SDF</label>
        <input
          type="range"
          bind:value={$gameConfig!.sdf}
          min="1"
          max="5"
          step="1"
        />
        <input
          type="number"
          bind:value={$gameConfig!.sdf}
          min="20"
          max="41"
          step="1"
          class="value-input"
          onkeydown={(e) => e.stopPropagation()}
        />
      </div>
    </div></Panel
  >

  <Panel
    title="Components"
    description="左右のコンポーネント。ドラッグドロップで並び替え可能。"
  >
    <label for="panel-presets">Panel Presets</label>
    <select
      id="panel-presets"
      onchange={onComponentPanelSelectChanged}
      bind:value={$gameConfig!.panelPresets!.currentPreset}
    >
      {#if $gameConfig?.panelPresets?.presets}
        {#each Object.keys($gameConfig.panelPresets.presets) as preset}
          <option value={preset}>{preset}</option>
        {/each}
      {/if}
    </select>

    <div id="component-container">
      <div style="flex: 1;">
        <label>Left</label>
        <List items={leftComponentItems} {applyPanelPreset} type="left" />
      </div>
      <div style="flex: 1;">
        <label>Available</label>
        <List
          items={availableComponentItems}
          {applyPanelPreset}
          type="available"
        />
      </div>
      <div style="flex: 1;">
        <label>Right</label>
        <List items={rightComponentItems} {applyPanelPreset} type="right" />
      </div>
    </div>
  </Panel>

  <Panel title={$t("common.preferences-online")} description="オンライン">
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label>{$t("common.preferences-socket-address")}</label>
    <input
      type="text"
      bind:value={$gameConfig!.socketAddress}
      placeholder="https://api.csdotnet.dev"
      onkeydown={(e) => e.stopPropagation()}
    />
  </Panel>

  <Panel title="Misc" description="その他の設定">
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label>{$t("common.preferences-language")}</label>

    <select bind:value={$gameConfig!.language} onchange={changeLanguage}>
      <option value="en">en</option>
      <option value="ja">ja</option>
    </select>
    <div style="display: flex;justify-content:left;margin-top: 10px;">
      <button onclick={resetGameConfig}>
        {$t("common.preferences-reset-button")}
      </button>
      <button onclick={openExecutableFolder}>
        {$t("common.preferences-open-folder")}
      </button>
      <button onclick={resetWindowStatus}>
        {$t("common.preferences-reset-window-status")}
      </button>
    </div>
  </Panel>
  <div style="margin-bottom: 100px;"></div>
</div>

<style>
  #container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: start;
    overflow-y: auto;
    background-color: #1c1c1c;
  }
  #container > div {
    padding: 0px 4px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    color: #cbcbcb;
  }
  th:nth-child(1) {
    background-color: #2b2b2b;
    width: 100px;
  }
  th:nth-child(2) {
    background-color: #2b2b2b;
  }
  td {
    padding: 1px 0px;
    padding-left: 10px;
    font-size: 16px;
    text-align: left;
    box-sizing: border-box;
    cursor: pointer;
  }

  th {
    background-color: #f2f2f2;
    text-align: left;
    padding-left: 10px;
  }
  tr:nth-child(even) {
    background-color: #262626;
  }
  tbody tr {
    background-color: #1c1c1c;
    border: 1px solid #1f1f1f;
  }
  tbody tr:hover {
    background-color: #2a2d2e;
  }
  select {
    margin: 4px 0;
    padding: 4px 8px;
    background-color: #2b2b2b;
    color: #cbcbcb;
    border-radius: 4px;
    height: 28px;
    line-height: 28px;
  }
  button {
    margin: 5px;
    padding: 8px 16px;
    background-color: #1c7ad2;
    color: #cbcbcb;
    border: none;
    cursor: pointer;
  }
  button:hover {
    background-color: #155a9b;
  }
  input[type="text"] {
    width: 100%;
    padding: 8px;
    margin: 10px 0;
    background-color: #2b2b2b;
    color: #cbcbcb;
    border: 1px solid #cbcbcb;
    box-sizing: border-box;
  }

  input[type="checkbox"]#ghost-piece {
    accent-color: #1c7ad2;
  }

  #container::-webkit-scrollbar {
    width: 8px;
  }
  #container::-webkit-scrollbar-track {
    background: #1c1c1c;
  }
  #container::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  #container::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  #back {
    position: absolute;
    top: 0px;
    right: 0px;
    background-color: transparent;
    border: none;
    font-size: 24px;
    cursor: pointer;
    z-index: 2;
  }
  td.non-editable {
    color: #888;
    cursor: not-allowed;
  }
  .game-settings {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .setting {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .setting label {
    flex: 1;
    color: #e7e7e7;
  }
  input[type="range"] {
    width: 400px;
    height: 4px;
    border-radius: 5px;
    background-color: #666666;
    outline: none;
    -webkit-appearance: none;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 15px;
    height: 15px;
    border-radius: 0 50% 50% 0;
    background: #1c7ad2;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    background: linear-gradient(
      to right,
      #1c7ad2 0%,
      #1c7ad2 var(--value, 0%),
      #d3d3d3 var(--value, 0%),
      #d3d3d3 100%
    );

    border-radius: 5px;
    height: 15px;
  }

  .setting .value-input {
    color: #ffffff;
    width: 40px;
    background-color: #2b2b2b;
    padding: 5px 0px;
    border: 1px solid #ddd;
    text-align: center;
    border-radius: 2px;
  }
  label {
    color: #cbcbcb;
    text-align: center;
    width: 100%;
  }

  #component-container {
    display: flex;
    gap: 20px;
  }
</style>
