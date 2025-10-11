<script lang="ts">
  import { resolveResource } from "@tauri-apps/api/path";
  import { onMount } from "svelte";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { derived } from "svelte/store";
  import Panel from "../panel.svelte";
  import { selectedMino } from "../../../../app/stores/misc";

  let background_img: string;

  onMount(async () => {
    await getBlockImageURL().then((filePath) => {
      background_img = filePath;
    });
  });

  async function getBlockImageURL() {
    if (window.IS_WEB_MODE) {
      return "./blocks.png";
    } else {
      return convertFileSrc(await resolveResource("assets/images/blocks.png"));
    }
  }
</script>

<Panel title="Block">
  <div class="image-container">
    {#each Array(9) as _, index}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        role="button"
        tabindex="-1"
        class:selected={$selectedMino === index}
        id="block_{index}"
        on:click={() => {
          selectedMino.set(index);
        }}
      >
        <img
          src={background_img}
          alt="Block"
          style="object-position: calc(-24px * {index}) 0;"
          draggable="false"
        />
      </div>
    {/each}
  </div>
</Panel>

<style>
  .image-container {
    display: flex;
    flex-wrap: wrap;
    width: 95%;
    gap: 3px;
    justify-content: center;
  }

  .image-container div {
    width: 24px;
    height: 24px;
    overflow: hidden;
    border: 1px solid transparent;
    box-sizing: unset;
    transition:
      border 0.2s ease,
      filter 0.2s ease;
  }

  .image-container div.selected {
    border: 1px solid white;
  }

  .image-container div:hover {
    filter: brightness(80%);
  }

  .image-container img {
    width: 240px;
    height: 24px;
    object-fit: fill;
    object-position: 0 0;
  }

  * {
    outline: none;
  }
</style>
