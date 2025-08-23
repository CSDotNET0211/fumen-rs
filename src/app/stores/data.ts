import { get, writable } from "svelte/store";
import type { TetrisEnv } from "tetris/src/tetris_env";
import { CANVAS_WIDTH } from "../../features/windows/canvas/const";
import { DatabaseNode } from "../../core/nodes/DatabaseNode/databaseNode";
import { FieldDatabaseNode } from "../../core/nodes/DatabaseNode/fieldDatabaseNode";
import { nodeUpdater } from "../../core/nodes/NodeUpdater/nodeUpdater";
import { getNodeDatabase } from "../../core/nodes/db";


export const currentFieldIndex = writable(-1);
export const currentFieldNode = writable<TetrisEnv | null>(null);

// canvasのスクロール位置・ズームを保存するストア
export const canvasView = writable<{ x: number; y: number; zoom: number } | null>(null);

currentFieldIndex.subscribe((id) => {
	console.log("Current field index changed to:", id);
	if (id < 0) {
		currentFieldNode.set(null);
		return;
	}


	const node = getNodeDatabase(id);
	console.log(node);
	if (!node) {
		throw new Error(`Node with id ${id} not found.`);
	}

	if (node instanceof FieldDatabaseNode) {
		if (!node.data) {
			throw new Error(`Node with id ${id} is not a FieldDatabaseNode or has no data.`);
		}

		currentFieldNode.set(node.data);
	} else {
		throw new Error(`Node with id ${id} is not a FieldDatabaseNode.`);
	}
});

currentFieldNode.subscribe(async (field) => {

	if (get(currentFieldIndex) < 1 || !field) {
		return;
	}

	const node = new FieldDatabaseNode(get(currentFieldIndex), undefined, undefined, undefined, field!);
	await get(nodeUpdater)!.update(node);
});
