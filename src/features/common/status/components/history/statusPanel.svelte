<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<script>
  import { get } from "svelte/store";
  import { currentOpenedStatus, StatusPanelType } from "../../status";

  function openPanel() {
    if (get(currentOpenedStatus) === StatusPanelType.History) {
      currentOpenedStatus.set(StatusPanelType.None);
    } else {
      currentOpenedStatus.set(StatusPanelType.History);
    }
  }
</script>

<div id="container" tabindex="-1" on:click={openPanel}>
  <button class="icon-button" tabindex="-1" style="padding-top: 2px;">
    <img src="/history.svg" alt="history" tabindex="-1" draggable="false" />
  </button>
</div>

<style>
  #container {
    padding: 0px 10px;
    height: 100%;
    transition: background-color 0.3s ease;
    cursor: pointer;
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
    width: 16px;
  }

  * {
    outline: none;
  }
</style>
