import { get, writable } from "svelte/store";
import type { TetrisEnv } from "tetris/src/tetris_env";
import { FieldNode } from "../../features/windows/canvas/node";
import { CANVAS_WIDTH } from "../../features/windows/canvas/const";
//export const fields = writable<Map<number, TetrisEnv>>(new Map());
export const currentFieldIndex = writable(-1);
export const currentFieldNode = writable<TetrisEnv | null>(null);

currentFieldIndex.subscribe((id) => {
	console.log("Current field index changed to:", id);
	currentFieldNode.set(FieldNode.getFromDB(id));
});

currentFieldNode.subscribe((field) => {

	if (get(currentFieldIndex) < 1 || !field) {
		return;
	}
	FieldNode.updateDB(get(currentFieldIndex), field!);
});

// canvasのスクロール位置・ズームを保存するストア
export const canvasView = writable<{ x: number; y: number; zoom: number } | null>(null);
