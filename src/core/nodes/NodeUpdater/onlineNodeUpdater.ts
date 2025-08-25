import { sendCreateNodeWS, sendDeleteNodeWS, sendUpdateNodeWS } from "../../../services/online";
import type { DatabaseNode } from "../DatabaseNode/databaseNode";
import { createNodeDatabase, deleteNodeDatabase, updateNodeDatabase } from "../db";
import { NodeUpdater } from "./nodeUpdater";

//
export class OnlineNodeUpdater extends NodeUpdater {
	async update(node: DatabaseNode): Promise<void> {

		await sendUpdateNodeWS(node);
	}
	async create(node: DatabaseNode): Promise<number> {

		return await sendCreateNodeWS(node);

	}
	async delete(nodeId: number): Promise<void> {

		await sendDeleteNodeWS(nodeId);
	}
}
