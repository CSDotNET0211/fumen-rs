<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { writable, get, type Writable } from "svelte/store";
  import {
    boardViewContent,
    gameConfig,
    overlayBoardViewContent,
    OverrideBoardViewContentType,
  } from "../../store";
  import { GameConfig } from "../../gameConfig";
  import { RotationType } from "tetris/src/rotation_type";
  import { t, locale } from "../../translations/translations.ts";
  import { openPath } from "@tauri-apps/plugin-opener";
  import { Command } from "@tauri-apps/plugin-shell";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";

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

  function moveComponentUp(panel: Writable<string[]>, index: number) {
    panel.update((components) => {
      if (index > 0) {
        [components[index - 1], components[index]] = [
          components[index],
          components[index - 1],
        ];
      }
      return components;
    });
  }

  function moveComponentDown(panel: Writable<string[]>, index: number) {
    panel.update((components) => {
      if (index < components.length - 1) {
        [components[index + 1], components[index]] = [
          components[index],
          components[index + 1],
        ];
      }
      return components;
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
    overlayBoardViewContent.set(OverrideBoardViewContentType.None);
  }

  function resetGameConfig() {
    gameConfig.set(GameConfig.default());
    alert($t("common.preferences-reset-success"));
  }

  async function openExecutableFolder() {
    await invoke("reveal_config_file_in_explorer");
  }

  function resetWindowStatus() {
    gameConfig.update((config) => {
      if (config) {
        config.windowSize = undefined;
      }

      return config;
    });

    invoke("set_window_size", {
      window: getCurrentWindow(),
      width: 532,
      height: 770,
    });
  }
</script>

<div id="container">
  <button id="back" onclick={back}>✖</button>
  <div>
    <div class="panel">
      <h2>{$t("common.preferences-keymap")}</h2>
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
                  onclick={() => (editable ? startEditing(key) : null)}
                  >{key}</td
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
    </div>

    <div class="panel">
      <h2>{$t("common.preferences-game")}</h2>
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

      <div style="display: none;">
        <h2>{$t("common.preferences-panel")}</h2>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>{$t("common.preferences-preset")}</label>
        <select bind:value={$selectedPreset}>
          {#each $presets as preset}
            <option value={preset}>{preset}</option>
          {/each}
        </select>
        <h3>{$t("common.preferences-right-panel")}</h3>
        {#each $right_components as component, index}
          <div>
            <span>{component}</span>
            <button onclick={() => moveComponentUp(right_components, index)}
              >Up</button
            >
            <button onclick={() => moveComponentDown(right_components, index)}
              >Down</button
            >
          </div>
        {/each}
        <!--	<button on:click={() => handleAddComponent(right_components)}
				>Add Component</button
			>-->
        <h3>{$t("common.preferences-left-panel")}</h3>
        {#each $left_components as component, index}
          <div>
            <span>{component}</span>
            <button onclick={() => moveComponentUp(left_components, index)}
              >Up</button
            >
            <button onclick={() => moveComponentDown(left_components, index)}
              >Down</button
            >
          </div>
        {/each}
        <!--<button on:click={() => handleAddComponent(left_components)}
				>Add Component</button
			>-->
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
      <!--
			<div class="setting">
				<label>Background Border Opacity</label>
				<input
					type="range"
					bind:value={$gameConfig!.bgBorderOpacity}
					min="0"
					max="100"
					step="1"
				/>
				<input
					type="number"
					bind:value={$gameConfig!.bgBorderOpacity}
					min="0"
					max="100"
					step="1"
					class="value-input"
				/>
			</div>
			-->
    </div>
    <!--
		<h2>{$t("common.preferences-image-recognition")}</h2>
		<input
			type="text"
			bind:value={$gameConfig!.fumenImageRecognitionModelURL}
			placeholder=""
			onkeydown={(e) => e.stopPropagation()}
		/>-->
    <div class="panel">
      <h2>{$t("common.preferences-online")}</h2>
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>{$t("common.preferences-socket-address")}</label>
      <input
        type="text"
        bind:value={$gameConfig!.socketAddress}
        placeholder="https://api.csdotnet.dev"
        onkeydown={(e) => e.stopPropagation()}
      />
    </div>
    <div class="panel">
      <h2>Misc</h2>
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
    </div>

    <div style="height: 100px;"></div>
  </div>
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

  h2 {
    font-size: 1.5em;
    color: #e7e7e7;
    margin-bottom: 0.5em;
    margin-top: 10px;
  }
  h3 {
    font-size: 1.2em;
    color: #e7e7e7;
    margin-bottom: 0.5em;
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
    padding: 8px;
    background-color: #2b2b2b;
    color: #cbcbcb;
    border-radius: 4px;
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
  .panel {
    padding: 10px;
  }
  .panel:hover {
    background-color: #252728;
  }
</style>
