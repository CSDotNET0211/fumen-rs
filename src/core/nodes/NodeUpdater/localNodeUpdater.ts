
import { createNodeDatabase, updateNodeDatabase } from "../db";
import type { DatabaseNode } from "../UpdaterNode/databaseNode";
import { NodeUpdater } from "./nodeUpdater";


export class LocalNodeUpdater extends NodeUpdater {


	update(node: DatabaseNode): void {
		//db updateにnodeを渡す
		updateNodeDatabase(node);
	}
	create(node: DatabaseNode): number {
		return createNodeDatabase(node);
	}
	delete(nodeId: number): void {

	}
}
