<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { resolveResource } from "@tauri-apps/api/path";
  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import { currentFieldIndex } from "../../../app/stores/data";
  import {
    DEFAULT_TETRIS_CANVAS_HEIGHT,
    DEFAULT_TETRIS_CANVAS_WIDTH,
  } from "../../../app/stores/window";

  export let name: string;
  export let color: string;
  export let x: number;
  export let y: number;
  export let location: number | null;
  //export let opacity: number;

  let cursor_svg: string;
  let inactivityTimeout: NodeJS.Timeout;

  // currentFieldIndexとlocationが同じかどうかを判定
  $: isVisible = location !== null && $currentFieldIndex === location;

  // 実際の表示位置を計算
  $: actualX = (() => {
    if (location === -1) {
      return x;
    } else {
      const canvas = document.querySelector("canvas"); // 適切なcanvas要素のセレクタに変更してください
      if (canvas) {
        const scaleX = DEFAULT_TETRIS_CANVAS_WIDTH / canvas.clientWidth;
        return x / scaleX + (canvas.getBoundingClientRect().left ?? 0);
      }
      return x;
    }
  })();

  $: actualY = (() => {
    if (location === -1) {
      return y;
    } else {
      const canvas = document.querySelector("canvas"); // 適切なcanvas要素のセレクタに変更してください
      if (canvas) {
        const scaleY = DEFAULT_TETRIS_CANVAS_HEIGHT / canvas.clientHeight;
        return y / scaleY + (canvas.getBoundingClientRect().top ?? 0);
      }
      return y;
    }
  })();

  function updateNameTagColor() {
    resolveResource("assets/images/cursor.svg").then((result) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = convertFileSrc(result);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          ctx.globalCompositeOperation = "source-in";
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          cursor_svg = canvas.toDataURL();
        }
      };
    });
  }

  onMount(() => {
    updateNameTagColor();
  });
</script>

{#if isVisible}
  <div
    style="will-change: transform; position: fixed; top: 0; left: 0; transform: translate({actualX}px, {actualY}px); opacity: {1}; transition: opacity 0.5s; pointer-events: none;"
  >
    <div style="position: absolute;">
      <img id="cursor_img" src={cursor_svg} alt="cursor" />
      <div id="cursor_nametag" style="background-color: {color};">{name}</div>
    </div>
  </div>
{/if}

<style>
  #cursor_img {
    position: absolute;
    transform: translate(-35%, -45%);
    width: 25px;
  }

  #cursor_nametag {
    position: absolute;
    transform: translate(50%, 75%);
    color: white;
    padding-left: 5px;
    padding-right: 5px;
    font-size: 12px;
    text-align: center;
  }
</style>
