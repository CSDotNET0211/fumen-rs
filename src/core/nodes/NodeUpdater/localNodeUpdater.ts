
import { createNodeDatabase, deleteNodeDatabase, loadDatabase, updateNodeDatabase } from "../db";
import type { DatabaseNode } from "../DatabaseNode/databaseNode";
import { NodeUpdater } from "./nodeUpdater";


export class LocalNodeUpdater extends NodeUpdater {
	async load(dbBin: Uint8Array, useSplash: boolean): Promise<void> {
		await loadDatabase(dbBin, useSplash);
	}
	async update(node: DatabaseNode): Promise<void> {
		updateNodeDatabase(node);
	}
	async create(node: DatabaseNode): Promise<number> {
		return createNodeDatabase(node);

	}
	async delete(node: DatabaseNode): Promise<void> {
		deleteNodeDatabase(node);
	}
}
