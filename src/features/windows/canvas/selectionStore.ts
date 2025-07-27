import { writable, get } from 'svelte/store';

export const selectedNodeId = writable<number | null>(null);
