import type { Database } from "sql.js";
import { DatabaseNode } from "./databaseNode";

export class TextDatabaseNode extends DatabaseNode {
	updateNode(db: Database): void {
		if (this.id === undefined) {
			throw new Error("Node ID is undefined. Cannot update node.");
		}

		const updates: string[] = [];
		const values: any[] = [];

		if (this.x !== undefined) {
			updates.push("x = ?");
			values.push(this.x);
		}
		if (this.y !== undefined) {
			updates.push("y = ?");
			values.push(this.y);
		}
		if (this.text !== undefined) {
			updates.push("text = ?");
			values.push(this.text);
		}
		if (this.size !== undefined) {
			updates.push("size = ?");
			values.push(this.size);
		}
		if (this.color !== undefined) {
			updates.push("color = ?");
			values.push(this.color);
		}
		if (this.backgroundColor !== undefined) {
			updates.push("backgroundColor = ?");
			values.push(this.backgroundColor);
		}

		if (updates.length > 0) {
			values.push(this.id);
			const sql = `UPDATE text_data SET ${updates.join(", ")} WHERE id = ?`;
			db.run(sql, values);

			const event = new CustomEvent("onUpdateTextNode", { detail: this });
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

		const textColumns: string[] = ["id"];
		const textValues: any[] = [nodeId];
		if (this.x !== undefined) {
			textColumns.push("x");
			textValues.push(this.x);
		}
		if (this.y !== undefined) {
			textColumns.push("y");
			textValues.push(this.y);
		}
		if (this.size !== undefined) {
			textColumns.push("size");
			textValues.push(this.size);
		}
		if (this.text !== undefined) {
			textColumns.push("text");
			textValues.push(this.text);
		}
		if (this.color !== undefined) {
			textColumns.push("color");
			textValues.push(this.color);
		}
		if (this.backgroundColor !== undefined) {
			textColumns.push("backgroundColor");
			textValues.push(this.backgroundColor);
		}
		const textSql = `INSERT INTO text_data (${textColumns.join(", ")}) VALUES (${textColumns.map(() => "?").join(", ")})`;
		db.run(textSql, textValues);

		const event = new CustomEvent("onCreateTextNode", { detail: this });
		document.dispatchEvent(event);
		return this.id!;
	}
	deleteNode(db: Database): void {
		super.deleteNode(db);

		const event = new CustomEvent("onDeleteTextNode", { detail: this });
		document.dispatchEvent(event);
	}
	x: number | undefined;
	y: number | undefined;
	text: string | undefined;
	size: number | undefined;
	color: string | undefined;
	backgroundColor: string | undefined;

	constructor(
		id: number | undefined,
		x: number | undefined,
		y: number | undefined,
		text: string | undefined,
		size: number | undefined,
		color: string | undefined,
		backgroundColor: string | undefined
	) {
		super(id, "text");
		this.x = x;
		this.y = y;
		this.text = text;
		this.size = size;
		this.color = color;
		this.backgroundColor = backgroundColor;
	}
}
