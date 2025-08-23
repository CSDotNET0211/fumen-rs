
import { createNodeDatabase, updateNodeDatabase } from "../db";
import type { DatabaseNode } from "../DatabaseNode/databaseNode";
import { NodeUpdater } from "./nodeUpdater";


export class LocalNodeUpdater extends NodeUpdater {


	async update(node: DatabaseNode): Promise<void> {
		//db updateにnodeを渡す
		updateNodeDatabase(node);
	}
	async create(node: DatabaseNode): Promise<number> {
		const index = createNodeDatabase(node);

		return index;
	}
	async delete(nodeId: number): Promise<void> {
		throw new Error("Method not implemented.");
	}
}
