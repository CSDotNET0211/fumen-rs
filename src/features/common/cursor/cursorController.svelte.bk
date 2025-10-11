<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { cursors, players } from "../../../services/online";
  import Cursor from "./cursor.svelte";
  import {
    leftPosition,
    topPosition,
  } from "../../windows/field/modules/tetrisBoard.svelte";

  interface CursorData {
    name: string;
    color: string;
    x: number;
    y: number;
    opacity: number;
  }

  let trackedCursors: { [id: string]: CursorData } = {};
  let showCursor = true;

  onMount(() => {
    cursors.subscribe((cursors) => {
      const offsetX = leftPosition ?? 0;
      const offsetY = topPosition ?? 0;

      trackedCursors = {};
      for (const [id, cursor] of Object.entries(cursors)) {
        trackedCursors[id] = {
          name: cursor.name,
          color: cursor.color,
          x: (cursor.x ?? 0) + offsetX,
          y: (cursor.y ?? 0) + offsetY,
          opacity: 1,
        };
      }
    });
  });

  onDestroy(() => {
    trackedCursors = {};
  });
</script>

{#if showCursor}
  {#each Object.values(trackedCursors) as cursor}
    <Cursor
      name={cursor.name}
      color={cursor.color}
      x={cursor.x}
      y={cursor.y}
      opacity={cursor.opacity}
    ></Cursor>
  {/each}
{/if}
