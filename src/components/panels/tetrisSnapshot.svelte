<script lang="ts">
  import { get, writable } from "svelte/store";
  import Panel from "../panel.svelte";
  import type { TetrisEnv } from "tetris/src/tetris_env";
  import { fieldIndex, fields, history } from "../../store";
  import { getCanvasImage } from "../fields/tetrisBoard.svelte";
  import type { History } from "../../history";
  import { t } from "../../translations/translations";
  import { emitTo } from "@tauri-apps/api/event";

  export const selected_mino = writable();

  class SnapshotData {
    env: TetrisEnv;
    thumbnail: string;
    title: string;

    constructor(env: TetrisEnv, thumbnail: string, title: string) {
      this.env = env;
      this.thumbnail = thumbnail;
      this.title = title;
    }
  }

  let snapshot = writable<SnapshotData[]>([]);
  let selectedSnapshotIndex = writable<number | null>(null);
  let editingIndex = writable<number | null>(null);

  async function handlePasteClick() {
    const index = get(selectedSnapshotIndex);
    if (index === null) {
      return;
    }

    emitTo("main", "applyfield", get(snapshot)[index].env.clone());

    history.update((history: History) => {
      history.add(
        $t("common.history.apply-shapshot") + " " + index,
        get(fields)[get(fieldIndex)].clone(),
        ""
      );
      return history;
    });
  }

  async function handleAddClick() {
    let env = get(fields)[get(fieldIndex)];
    let thumbnail = await getCanvasImage();
    let title = "Snapshot " + (get(snapshot).length + 1);

    if (thumbnail == null) {
      return;
    }

    snapshot.update((snapshot) => {
      snapshot.push(new SnapshotData(env, thumbnail, title));
      return snapshot;
    });
  }

  function handleRemoveClick() {
    snapshot.update((snapshot) => {
      const index = get(selectedSnapshotIndex);
      if (index !== null) {
        snapshot.splice(index, 1);
        selectedSnapshotIndex.set(null);
      }
      return snapshot;
    });
  }

  function handleSnapshotClick(index: number) {
    selectedSnapshotIndex.set(index);
    editingIndex.set(null);
  }

  function handleTitleDoubleClick(index: number) {
    editingIndex.set(index);
  }

  function handleTitleChange(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    snapshot.update((snapshot) => {
      snapshot[index].title = input.value;
      return snapshot;
    });
  }

  function handleTitleBlur(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    if (input.value.trim() === "") {
      snapshot.update((snapshot) => {
        snapshot[index].title = "Untitled";
        return snapshot;
      });
    }
    editingIndex.set(null);
  }
</script>

<Panel title="Snapshot">
  <div id="container">
    <div id="snapshot-container">
      {#each $snapshot as snapshotData, index}
        <div
          class="snapshot-item {index === $selectedSnapshotIndex
            ? 'selected'
            : ''}"
          role="button"
          tabindex="-1"
          on:click={() => handleSnapshotClick(index)}
          on:keydown={(e) => e.key === "Enter" && handleSnapshotClick(index)}
        >
          <div style="display: flex;">
            <img
              src={snapshotData.thumbnail}
              alt="thumbnail"
              class="thumbnail"
            />
            {#if index === $editingIndex}
              <input
                style="width: 100%;"
                type="text"
                value={snapshotData.title}
                on:input={(e) => handleTitleChange(e, index)}
                on:blur={(e) => handleTitleBlur(e, index)}
                on:click={(e) => e.stopPropagation()}
              />
            {:else}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                style="line-height: 30px;margin-left: 5px;"
                on:dblclick={() => handleTitleDoubleClick(index)}
              >
                {snapshotData.title}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    <div id="control-container">
      <button
        class="icon-button"
        tabindex="-1"
        on:click={handlePasteClick}
        title="Apply Snapshot"
      >
        <img src={"paste.svg"} alt="clip" />
      </button>
      <button
        class="icon-button"
        tabindex="-1"
        on:click={handleAddClick}
        title="Take Snapshot"
      >
        <img src={"camera.svg"} alt="clip" />
      </button>
      <button
        class="icon-button"
        tabindex="-1"
        on:click={handleRemoveClick}
        title="Remove Snapshot"
      >
        <img src={"trashbin.svg"} alt="trashbin" />
      </button>
    </div>
  </div>
</Panel>

<style>
  img {
    pointer-events: none;
  }

  #container {
    width: 90%;
    height: 130px;
    background-color: #1c1c1c;
    display: flex;
    flex-direction: column;
  }

  #snapshot-container {
    flex: 1;
    overflow-y: auto;
    font-size: 10px;
  }

  #control-container {
    display: flex;
    gap: 0px;
    justify-content: center;
    padding-top: 3px;
    border-top: 1px solid #3e3e3ea0;
  }
  #control-container .icon-button {
    background: none;
    border: none;
    cursor: pointer;
  }
  #control-container .icon-button img {
    width: 16px;
    height: 16px;
  }

  .snapshot-item {
    border-bottom: 1px solid #3e3e3ea0;
    color: #cbcbcb;
  }

  .snapshot-item.selected {
    background-color: #3e3e3e;
  }

  .thumbnail {
    height: 30px;
  }
  #snapshot-container::-webkit-scrollbar {
    width: 5px;
  }
  #snapshot-container::-webkit-scrollbar-track {
    background: #1c1c1c;
  }
  #snapshot-container::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  #snapshot-container::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
</style>
