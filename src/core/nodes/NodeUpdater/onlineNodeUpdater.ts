import { sendCreateNodeWS, sendUpdateNodeWS } from "../../../services/online";
import type { DatabaseNode } from "../DatabaseNode/databaseNode";
import { NodeUpdater } from "./nodeUpdater";

//
export class OnlineNodeUpdater extends NodeUpdater {
	async update(node: DatabaseNode): Promise<void> {
		await sendUpdateNodeWS(node);
	}
	async create(node: DatabaseNode): Promise<number> {
		const index = await sendCreateNodeWS(node);
		return index;
	}
	async delete(nodeId: number): Promise<void> {
		throw new Error("Method not implemented.");
	}
}
