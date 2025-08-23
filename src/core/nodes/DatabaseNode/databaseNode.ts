import type { Database } from "sql.js";
import { FieldDatabaseNode } from "./fieldDatabaseNode";
import { TextDatabaseNode } from "./textDatabaseNode";
import { TetrisEnv } from "tetris/src/tetris_env";

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

	static fromObj(obj: any): DatabaseNode {
		let instance: DatabaseNode;

		switch (obj.type) {
			case "field":
				const env = new TetrisEnv();
				Object.assign(env, obj.data);
				instance = new FieldDatabaseNode(obj.id, obj.x, obj.y, obj.thumbnail, env, obj.hash);
				break;
			case "text":
				instance = new TextDatabaseNode(obj.id, obj.x, obj.y, obj.text, obj.size, obj.color, obj.backgroundColor);
				break;
			default:
				throw new Error(`Unknown node type: ${obj.type}`);
		}

		return instance;
	}
}