import type { TetrisEnv } from "tetris/src/tetris_env";
import { DatabaseNode } from "./databaseNode";
import type { Database } from "sql.js";

export class FieldDatabaseNode extends DatabaseNode {
	updateNode(db: Database): void {

		if (this.id === undefined) {
			throw new Error("Node ID is undefined. Cannot update node.");
		}

		const updateFields: string[] = [];
		const values: any[] = [];

		if (this.data !== undefined) {
			updateFields.push("data = ?");
			values.push(this.data);
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
		const index = super.createNode(db);
		console.log("基底クラスで作られたよ");
		const fieldColumns: string[] = ["id"];
		const fieldValues: any[] = [index];

		if (this.data !== undefined) {
			fieldColumns.push("data");
			fieldValues.push(this.data);
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
		return index;

	}
	deleteNode(db: Database): void {
		throw new Error("Method not implemented.");
	}
	x: number | undefined;
	y: number | undefined;
	thumbnail: string | undefined;
	data: TetrisEnv | undefined;

	constructor(
		id?: number,
		x?: number,
		y?: number,
		thumbnail?: string,
		data?: TetrisEnv
	) {
		super(id, "field");
		this.x = x;
		this.y = y;
		this.thumbnail = thumbnail;
		this.data = data;
	}
}