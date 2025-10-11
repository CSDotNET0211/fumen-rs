import { writable, type Writable } from "svelte/store";
import type { MenuItem } from "../../features/common/menu/MenuItem";
import type { SnapshotData } from "../snapShotData";
import type { Pages } from "tetris-fumen/lib/decoder";

export const selectedMino = writable<number>(0);
export const autoFillQueue = writable<boolean>(false);
export const autoApplyField = writable<boolean>(true);
//オンラインの際に再帰更新に陥るのを防ぐ
export const suppressFieldUpdateNotification = writable(true);
export const menuItems: Writable<null | MenuItem[]> = writable(null);
export const snapshot = writable<SnapshotData[]>([]);

export const fumenPages: Writable<Pages | null> = writable(null);
export const fumenImage: Writable<HTMLImageElement | null> = writable(null);

export const isAlwaysOnTop = writable<boolean>(false);
export const unknownThumbnailBase64 = writable<string>("");