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
	createNode(db: Database): number {
		console.log("基底クラスだよ");
		if (!this.type) {
			throw new Error("Node type is undefined. Cannot create node.");
		}

		const insertSql = `INSERT INTO nodes (type) VALUES (?)`;
		db.run(insertSql, [this.type]);
		const nodeIdResult = db.exec("SELECT last_insert_rowid()");
		const nodeId = nodeIdResult[0].values[0][0] as number;
		return nodeId;
	}
	deleteNode(db: Database): void {
		if (this.id === undefined) {
			throw new Error("Node ID is undefined. Cannot delete node.");
		}
		const deleteSql = `DELETE FROM nodes WHERE id = ?`;
		db.run(deleteSql, [this.id]);


	}
}