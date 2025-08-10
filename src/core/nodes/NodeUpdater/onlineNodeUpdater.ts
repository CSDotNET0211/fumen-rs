import type { DatabaseNode } from "../UpdaterNode/databaseNode";
import { NodeUpdater } from "./nodeUpdater";

export class OnlineNodeUpdater extends NodeUpdater {
	update(node: DatabaseNode): void {
		//socket.ioのupdateで送信
	}
	create(node: DatabaseNode): number {
		throw new Error("Method not implemented.");
	}
	delete(nodeId: number): void {
		throw new Error("Method not implemented.");
	}
}
