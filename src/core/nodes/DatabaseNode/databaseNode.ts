import type { Database } from "sql.js";


/* 
 * アップデート通知用ノードの基底クラス
 */
export abstract class DatabaseNode {
	id: number | undefined;
	type: string | undefined;

	constructor(id: number | undefined, type: string | undefined) {
		this.id = id;
		this.type = type;
	}

	abstract updateNode(db: Database): void;
	abstract createNode(db: Database): number;
	deleteNode(db: Database): void {
		if (this.id === undefined) {
			throw new Error("Node ID is undefined. Cannot delete node.");
		}
		const deleteSql = `DELETE FROM nodes WHERE id = ?`;
		db.run(deleteSql, [this.id]);
	};

}