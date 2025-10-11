<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<script>
  import { get } from "svelte/store";
  import { currentOpenedStatus, StatusPanelType } from "../../status";

  function openPanel() {
    if (get(currentOpenedStatus) === StatusPanelType.Login) {
      currentOpenedStatus.set(StatusPanelType.None);
    } else {
      currentOpenedStatus.set(StatusPanelType.Login);
    }
  }
</script>

<div id="container" tabindex="-1" on:click={openPanel}>
  <span id="status">Account</span>
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
