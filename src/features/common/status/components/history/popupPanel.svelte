<script lang="ts">
  import { get } from "svelte/store";
  import { history } from "../../../../../app/stores/history";
  import type { History, HistoryEntry } from "../../../../../history";
  import {
    currentFieldIndex,
    currentFieldNode,
  } from "../../../../../app/stores/data";
  import PopupPanel from "../../popupPanel.svelte";
  import { onMount } from "svelte";

  let selectedIndex: number | null = null;
  let historyEntries: HistoryEntry[] = [];
  onMount(() => {
    historyEntries = get(history).get();
    const panel = document.querySelector("#main-panel");
    if (panel) {
      panel.scrollTop = panel.scrollHeight;
    }
  });

  function handleHistoryClick(
    event: MouseEvent & { currentTarget: EventTarget & HTMLDivElement }
  ) {
    // historyEntries = get(history).get();
    /*if (showPanel) {
      setTimeout(() => {
        const panel = document.querySelector("#main-panel");
        if (panel) {
          panel.scrollTop = panel.scrollHeight;
        }
      }, 0);
    }*/
  }

  history.subscribe((history) => {
    historyEntries = history.get();
    setTimeout(() => {
      const panel = document.querySelector("#main-panel");
      if (panel) {
        panel.scrollTop = panel.scrollHeight;
      }
    }, 0);

    selectedIndex = history.historyIndex as number;
  });

  function handleEntryClick(index: number) {
    selectedIndex = index;

    history.update((history: History) => {
      {
        history.historyIndex = index;
        currentFieldNode.setValue(history.current.entry.clone());
      }

      return history;
    });
  }

  /*
  openedNotificationPanel.subscribe((panel) => {
    if (panel !== "history") {
      showPanel = false;
    }
  });*/
</script>

<PopupPanel title="History"
  ><ul>
    {#each historyEntries as entry, index}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        class:selected-after={selectedIndex !== null && index > selectedIndex}
        onclick={() => handleEntryClick(index)}
      >
        {entry.entryName}
        {@html entry.content}
      </li>
    {/each}
  </ul>
</PopupPanel>

<style>
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    padding: 4px;
    font-size: 15px;
    border-bottom: 1px solid #555;
    cursor: pointer;
    color: #ddd;
  }

  li:last-child {
    border-bottom: none;
  }

  li.selected-after {
    color: #888;
  }
</style>
