import { sendCreateNodeWS, sendDeleteNodeWS, sendUpdateDatabaseWS, sendUpdateNodeWS } from "../../../services/online";
import type { DatabaseNode } from "../DatabaseNode/databaseNode";
import { createNodeDatabase, deleteNodeDatabase, updateNodeDatabase } from "../db";
import { NodeUpdater } from "./nodeUpdater";

//
export class OnlineNodeUpdater extends NodeUpdater {
	async load(dbBin: Uint8Array, useSplash: boolean): Promise<void> {
		await sendUpdateDatabaseWS(dbBin, useSplash);
	}
	async update(node: DatabaseNode): Promise<void> {
		await sendUpdateNodeWS(node);
	}
	async create(node: DatabaseNode): Promise<number> {
		const index = await sendCreateNodeWS(node);
		return index;

	}
	async delete(node: DatabaseNode): Promise<void> {

		await sendDeleteNodeWS(node);
	}
}
