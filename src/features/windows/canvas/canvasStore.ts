import { writable, get } from 'svelte/store';

export const selectedNodeIds = writable<number[]>([]);

