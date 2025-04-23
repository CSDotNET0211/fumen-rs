<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { resolveResource } from "@tauri-apps/api/path";
  import { onMount } from "svelte";
  import { writable } from "svelte/store";

  export let name: string;
  export let color: string;
  export let x: number;
  export let y: number;
  export let opacity: number;

  let cursor_svg: string;
  let inactivityTimeout: NodeJS.Timeout;

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

  function resetInactivityTimer() {
    clearTimeout(inactivityTimeout);
    opacity = 1;
    inactivityTimeout = setTimeout(() => {
      opacity = 0.5;
    }, 5000);
  }

  onMount(() => {
    updateNameTagColor();
    resetInactivityTimer();
  });

  $: {
    updateNameTagColor();
    resetInactivityTimer();
  }
</script>

<div
  style="will-change: left,right;position: fixed; left: {x}px; top: {y}px; opacity: {opacity}; transition: opacity 0.5s; pointer-events: none;"
>
  <img id="cursor_img" src={cursor_svg} alt="cursor" />
  <div id="cursor_nametag" style="background-color: {color};">{name}</div>
</div>

<style>
  #cursor_img {
    position: absolute;
    width: 25px;
  }

  #cursor_nametag {
    position: absolute;
    left: 22px;
    top: 22px;
    padding-left: 4px;
    padding-right: 4px;
    font-size: 12px;
    text-align: center;
  }
</style>
