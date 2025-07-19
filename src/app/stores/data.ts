import { writable } from "svelte/store";
import type { TetrisEnv } from "tetris/src/tetris_env";

export const fields = writable<TetrisEnv[]>([]);
export const fieldIndex = writable(-1);
export const fieldImages = writable<Map<number, HTMLImageElement>>(new Map());
export const fieldNodeConnections = writable<Map<number, Map<number, number[]>>>(new Map());
export const fieldPositions = writable<Map<number, { x: number; y: number }>>(new Map());