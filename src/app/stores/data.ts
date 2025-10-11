import { derived, get, writable, type Writable } from "svelte/store";
import { TetrisEnv } from "tetris/src/tetris_env";
import { CANVAS_WIDTH } from "../../features/windows/canvas/const";
import { DatabaseNode } from "../../core/nodes/DatabaseNode/databaseNode";
import { FieldDatabaseNode } from "../../core/nodes/DatabaseNode/fieldDatabaseNode";
import { nodeUpdater } from "../../core/nodes/NodeUpdater/nodeUpdater";
import { getNodeDatabase } from "../../core/nodes/db";
import { Tetromino } from "tetris/src/tetromino";
import { createUpdateStore } from "./internalUpdateStore";


export const currentFieldIndex = writable(-1);

//let _currentFieldNode: TetrisEnv | null = null;
export const currentFieldNode = createUpdateStore<TetrisEnv | null>(null);

// canvasのスクロール位置・ズームを保存するストア
export const canvasView = writable<{ x: number; y: number; zoom: number } | null>(null);

currentFieldIndex.subscribe((id) => {
	if (id < 0) {
		currentFieldNode.set(null);
		return;
	}

	const node = getNodeDatabase(id);
	if (!node) {
		throw new Error(`Node with id ${id} not found.`);
	}

	if (node instanceof FieldDatabaseNode) {
		if (!node.data) {
			throw new Error(`Node with id ${id} is not a FieldDatabaseNode or has no data.`);
		}

		currentFieldNode.setQuietly(node.data);
	} else {
		throw new Error(`Node with id ${id} is not a FieldDatabaseNode.`);
	}
});



// Event listener for onUpdateFieldNode
document.addEventListener('onUpdateFieldNode', (event: Event) => {

	if ((event as CustomEvent)?.detail?.id != get(currentFieldIndex)) return;

	const customEvent = event as CustomEvent;
	if (customEvent.detail.data) {
		const node = getNodeDatabase(customEvent.detail.id) as FieldDatabaseNode;
		if (node) {
			currentFieldNode.setQuietly(node.data ?? null);
		}
	}
});

currentFieldNode.subscribe(async (field) => {


	if (get(currentFieldIndex) < 1 || !field) {
		return;
	}

	const node = new FieldDatabaseNode(get(currentFieldIndex), undefined, undefined, undefined, field!, undefined);
	await get(nodeUpdater)!.update(node);
});
