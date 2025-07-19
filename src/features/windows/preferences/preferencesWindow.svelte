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

  let editingKey = writable<string | null>(null);
  let selectedKeymap = writable<string>("TetrisPlay");
  let presets = writable<string[]>(["Tetris", "PuyoPuyo"]);
  let selectedPreset = writable<string>("Tetris");

  let right_components = writable<string[]>(["Next", "Block", "Snapshot"]);
  let left_components = writable<string[]>(["Hold", "View"]);
  let available_components = writable<string[]>([
    "Next",
    "Block",
    "Snapshot",
    "Hold",
    "View",
  ]);

  let selectedLeftIndex = writable<number | null>(null);
  let selectedRightIndex = writable<number | null>(null);

  let dragSourcePanel: "left" | "right" | null = null;
  let dragSourceIndex: number | null = null;

  let draggingLeft = false;
  let draggingRight = false;
  let dragOverLeft = false;
  let dragOverRight = false;

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
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeyInput);
  });

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

  async function addComponent(name: string, panel: Writable<string[]>) {
    const Component = (
      await import(`../buildin_panels/${name.toLowerCase()}.svelte`)
    ).default;
    panel.update((components) => [...components, Component]);
  }

  function handleAddComponent(panel: Writable<string[]>) {
    const name = prompt("Enter component name to add:");
    if (name && get(available_components).includes(name)) {
      addComponent(name, panel);
    } else {
      alert("Invalid component name");
    }
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

  function handleAddComponentToPanel(panel: Writable<string[]>) {
    const name = prompt("Enter component name to add:");
    if (name && get(available_components).includes(name)) {
      panel.update((components) => [...components, name]);
    } else {
      alert("Invalid component name");
    }
  }

  function selectLeft(index: number) {
    selectedLeftIndex.set(index);
    selectedRightIndex.set(null);
  }
  function selectRight(index: number) {
    selectedRightIndex.set(index);
    selectedLeftIndex.set(null);
  }

  function moveSelectedLeftToRight() {
    const idx = get(selectedLeftIndex);
    if (idx !== null) {
      moveComponentBetweenPanels(left_components, right_components, idx);
      selectedLeftIndex.set(null);
    }
  }
  function moveSelectedRightToLeft() {
    const idx = get(selectedRightIndex);
    if (idx !== null) {
      moveComponentBetweenPanels(right_components, left_components, idx);
      selectedRightIndex.set(null);
    }
  }
  function deleteSelected() {
    const lidx = get(selectedLeftIndex);
    const ridx = get(selectedRightIndex);
    if (lidx !== null) {
      removeComponent(left_components, lidx);
      selectedLeftIndex.set(null);
    } else if (ridx !== null) {
      removeComponent(right_components, ridx);
      selectedRightIndex.set(null);
    }
  }
  function addToLeft() {
    handleAddComponentToPanel(left_components);
  }
  function addToRight() {
    handleAddComponentToPanel(right_components);
  }
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
    </div>
  </Panel>

  <Panel
    title={$t("common.preferences-panel")}
    description="パネルの設定を行います。"
  >
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label>{$t("common.preferences-preset")}</label>
    <select bind:value={$selectedPreset}>
      {#each $presets as preset}
        <option value={preset}>{preset}</option>
      {/each}
    </select>

    <div
      style="display: flex; flex-direction: row; justify-content: center; align-items: flex-start; gap: 32px;"
    >
      <div style="flex:1; min-width: 160px;">
        <h2 style="text-align:center;">LEFT</h2>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div id="panel-left" class="panel-list" class:drag-over={dragOverLeft}>
          {#each $left_components as component, index}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class:panel-item-selected={index === $selectedLeftIndex}
              class:dragging={index === $selectedLeftIndex && draggingLeft}
              class="panel-item"
              draggable="true"
              onclick={() => selectLeft(index)}
            >
              {component}
            </div>
          {/each}
        </div>
      </div>
      <div
        style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 32px;"
      >
        <button onclick={moveSelectedLeftToRight} style="width: 80px;">→</button
        >
        <button onclick={moveSelectedRightToLeft} style="width: 80px;">←</button
        >
        <button onclick={deleteSelected} style="width: 80px;">DEL</button>
        <button onclick={addToLeft} style="width: 80px;">ADD L</button>
        <button onclick={addToRight} style="width: 80px;">ADD R</button>
      </div>
      <div style="flex:1; min-width: 160px;">
        <h2 style="text-align:center;">RIGHT</h2>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          id="panel-right"
          class="panel-list"
          class:drag-over={dragOverRight}
        >
          <SortableList class="panel-item">
            {#each $right_components as component, index}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class:panel-item-selected={index === $selectedRightIndex}
                class:dragging={index === $selectedRightIndex && draggingRight}
                class="panel-item"
                onclick={() => selectRight(index)}
              >
                {component}
              </div>
            {/each}
          </SortableList>
        </div>
      </div>
    </div>

    <SortableList
      class="sortable-list"
      draggable=".panel-item"
      group="panel"
      chosenClass="panel-item-selected"
      dragClass="dragging"
    >
      <div>List Item 1</div>
      <div>List Item 2</div>
      <div>List Item 3</div>
    </SortableList>
  </Panel>
  <!--
		<h2>{$t("common.preferences-image-recognition")}</h2>
		<input
			type="text"
			bind:value={$gameConfig!.fumenImageRecognitionModelURL}
			placeholder=""
			onkeydown={(e) => e.stopPropagation()}
		/>-->

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
    margin: 10px 0;
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
    background-color: #ffffff;
    outline: none;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background-color: rgb(122, 122, 122);
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
  .panel-list {
    border: 1px solid #444;
    min-height: 220px;
    background: #232323;
    border-radius: 8px;
    padding: 8px 0;
    pointer-events: all;
  }
  .panel-item {
    margin: 2px 8px;
    background: #222;
    color: #e7e7e7;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1.2em;
    text-align: center;
    border: 1px solid transparent;
    transition:
      background 0.2s,
      border 0.2s;
    pointer-events: all;
  }
  .panel-item:hover {
    background: #2a2d2e;
  }
  .panel-item-selected {
    border: 1.5px solid #1c7ad2;
    background: #1c7ad233;
    box-sizing: border-box;
  }
  .panel-item.dragging {
    opacity: 0.5;
    border: 1.5px dashed #1c7ad2;
    box-sizing: border-box;
  }
  .panel-list.drag-over {
    background: #1c7ad244;
    border: 2px solid #1c7ad2;
  }

  label {
    color: #cbcbcb;
  }
</style>
