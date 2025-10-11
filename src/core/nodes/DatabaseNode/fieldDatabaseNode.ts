import { TetrisEnv } from "tetris/src/tetris_env";
import { DatabaseNode } from "./databaseNode";
import type { Database } from "sql.js";
import { nodeUpdater } from "../NodeUpdater/nodeUpdater";
import { get } from "svelte/store";
import { getAllFieldNodesDatabase } from "../db";

export class FieldDatabaseNode extends DatabaseNode {

	x: number | undefined;
	y: number | undefined;
	thumbnail: string | undefined;
	data: TetrisEnv | undefined;
	hash: string | undefined;

	constructor(
		id?: number,
		x?: number,
		y?: number,
		thumbnail?: string,
		data?: TetrisEnv,
		hash?: string

	) {
		super(id, "field");
		this.x = x;
		this.y = y;
		this.thumbnail = thumbnail;
		this.data = data;
		this.hash = hash;
	}


	updateNode(db: Database): void {

		if (this.id === undefined) {
			throw new Error("Node ID is undefined. Cannot update node.");
		}

		const updateFields: string[] = [];
		const values: any[] = [];

		if (this.data !== undefined) {
			updateFields.push("data = ?");
			values.push(JSON.stringify(this.data));
		}
		if (this.thumbnail !== undefined) {
			updateFields.push("thumbnail = ?");
			values.push(this.thumbnail);
		}
		if (this.x !== undefined) {
			updateFields.push("x = ?");
			values.push(this.x);
		}
		if (this.y !== undefined) {
			updateFields.push("y = ?");
			values.push(this.y);
		}


		if (updateFields.length > 0) {
			const fieldSql = `UPDATE field_data SET ${updateFields.join(", ")} WHERE id = ?`;
			values.push(this.id);
			db.run(fieldSql, values);

			const event = new CustomEvent("onUpdateFieldNode", { detail: this });
			document.dispatchEvent(event);

		}


	}
	createNode(db: Database): number {
		if (!this.type) {
			throw new Error("Node type is undefined. Cannot create node.");
		}

		const insertSql = `INSERT INTO nodes (type) VALUES (?)`;
		db.run(insertSql, [this.type]);
		const nodeIdResult = db.exec("SELECT last_insert_rowid()");
		const nodeId = nodeIdResult[0].values[0][0] as number;
		this.id = nodeId;

		const fieldColumns: string[] = ["id"];
		const fieldValues: any[] = [nodeId];

		if (this.data !== undefined) {
			fieldColumns.push("data");
			fieldValues.push(JSON.stringify(this.data));
		}
		if (this.thumbnail !== undefined) {
			fieldColumns.push("thumbnail");
			fieldValues.push(this.thumbnail);
		}
		if (this.x !== undefined) {
			fieldColumns.push("x");
			fieldValues.push(this.x);
		}
		if (this.y !== undefined) {
			fieldColumns.push("y");
			fieldValues.push(this.y);
		}

		const fieldSql = `INSERT INTO field_data (${fieldColumns.join(", ")}) VALUES (${fieldColumns.map(() => "?").join(", ")})`;
		db.run(fieldSql, fieldValues);

		const event = new CustomEvent("onCreateFieldNode", { detail: this });
		document.dispatchEvent(event);
		return nodeId;

	}
	deleteNode(db: Database): void {
		super.deleteNode(db);

		const event = new CustomEvent("onDeleteFieldNode", { detail: this });
		document.dispatchEvent(event);
	}

}