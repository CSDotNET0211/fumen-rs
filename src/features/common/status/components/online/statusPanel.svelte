<script lang="ts">
  import { get } from "svelte/store";
  import { currentOpenedStatus, StatusPanelType } from "../../status";
  import { isConnected, players } from "../../../../../services/online";

  function openPanel() {
    if (get(currentOpenedStatus) === StatusPanelType.Online) {
      currentOpenedStatus.set(StatusPanelType.None);
    } else {
      currentOpenedStatus.set(StatusPanelType.Online);
    }
  }
</script>

<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div id="container" on:click={openPanel} tabindex="-1">
  <button class="icon-button" tabindex="-1">
    <img src="/share.svg" alt="online" tabindex="-1" />
  </button>
  <span id="status">
    {#if $isConnected}
      {#if $players.size === 0}
        Connected
      {:else}
        {$players.size}
      {/if}
    {:else}
      Connect Server
    {/if}
  </span>
</div>

<style>
  #container {
    padding: 1px 10px;
    height: 100%;
    pointer-events: all;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  #container:hover {
    background-color: #3788d4;
  }

  .icon-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .icon-button img {
    width: 14px;
  }

  * {
    outline: none;
  }
</style>
