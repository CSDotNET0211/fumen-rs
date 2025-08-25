
import { createNodeDatabase, deleteNodeDatabase, updateNodeDatabase } from "../db";
import type { DatabaseNode } from "../DatabaseNode/databaseNode";
import { NodeUpdater } from "./nodeUpdater";


export class LocalNodeUpdater extends NodeUpdater {


	async update(node: DatabaseNode): Promise<void> {
		//db updateにnodeを渡す
		updateNodeDatabase(node);
	}
	async create(node: DatabaseNode): Promise<number> {
		return createNodeDatabase(node);

	}
	async delete(nodeId: number): Promise<void> {
		deleteNodeDatabase(nodeId);
	}
}
