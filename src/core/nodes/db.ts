import type { Database } from "sql.js";
import initSqlJs from "sql.js";
import type { DatabaseNode } from "./UpdaterNode/databaseNode";
import { FieldDatabaseNode } from "./UpdaterNode/fieldDatabaseNode";
import { TetrisEnv } from "tetris/src/tetris_env";
let SQL: initSqlJs.SqlJsStatic;
let db: Database | null = null;


export function getDatabaseAsBinary(): Uint8Array<ArrayBufferLike> {
	const data = db?.export();
	if (!data) {
		throw new Error("Database is not initialized or empty.");
	}
	//writeFile("database.sqlite", data, { baseDir: BaseDirectory.Resource });
	return data;
}

export async function initializeDatabase() {
	SQL = await initSqlJs({
		// Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
		// You can omit locateFile completely when running in node
		locateFile: (file: any) => `${file}`
	});

	resetDatabase();

}
export function resetDatabase() {
	db?.close();
	db = new SQL.Database();

	db.run(`DROP TABLE IF EXISTS nodes;`);
	db.run(`DROP TABLE IF EXISTS connections;`);
	db.run(`DROP TABLE IF EXISTS field_data;`);
	db.run(`DROP TABLE IF EXISTS text_data;`);

	db.run(`
		CREATE TABLE nodes (
			id INTEGER PRIMARY KEY,
			type TEXT NOT NULL
		);
	`);

	db.run(`
		CREATE TABLE connections (
			from_id INTEGER,
			to_id INTEGER,
			direction_from TEXT, --  fromノードのどの方向から
			direction_to TEXT,   --  toノードのどの方向へ
			PRIMARY KEY (from_id, to_id, direction_from, direction_to),
			FOREIGN KEY (from_id) REFERENCES nodes(id) ON DELETE CASCADE,
			FOREIGN KEY (to_id) REFERENCES nodes(id) ON DELETE CASCADE
		);
	`);

	db.run(`
		CREATE TABLE field_data (
			id INTEGER PRIMARY KEY,
			data TEXT NOT NULL,
			thumbnail TEXT,
			hash TEXT,
			x REAL,
			y REAL,
			FOREIGN KEY (id) REFERENCES nodes(id) ON DELETE CASCADE
		);
	`);

	db.run(`
		CREATE TABLE text_data (
			id INTEGER PRIMARY KEY ,
			x REAL,
			y REAL,
			size INTEGER,
			text TEXT,
			color TEXT,
			backgroundColor TEXT,
			FOREIGN KEY (id) REFERENCES nodes(id) ON DELETE CASCADE
		);
	`);
}

export function loadDatabase(dbData: Uint8Array<ArrayBufferLike>) {
	if (!db) {
		throw new Error("Database is not initialized.");
	}

	db = new SQL.Database(dbData);
}



/**
 * dbを更新、通常の更新にはupdaterを経由して使用する。
 * @param updateNode 更新するノードの情報
 */
export function updateNodeDatabase(updateNode: DatabaseNode) {
	if (!db) {
		throw new Error("Database is not initialized.");
	}

	updateNode.updateNode(db);


}

export function createNodeDatabase(updateNode: DatabaseNode): number {
	if (!db) {
		throw new Error("Database is not initialized.");
	}

	const index = updateNode.createNode(db);
	return index;
}

export function deleteNodeDatabase(node: DatabaseNode) {
	if (!db) {
		throw new Error("Database is not initialized.");
	}

	if (node.id === undefined) {
		throw new Error("Node ID is undefined. Cannot delete node.");
	}

	node.deleteNode(db);
}

export function getNodeDatabase(id: number): DatabaseNode | null {
	if (!db) {
		throw new Error("Database is not initialized.");
	}

	let returnNode: DatabaseNode | null = null;

	const nodeResult = db.exec("SELECT * FROM nodes WHERE id = ?", [id]);

	if (!nodeResult.length || !nodeResult[0].values.length) {
		return null;
	}


	const type = nodeResult[0].values[0][1] as string;

	switch (type) {
		case 'field':
			const fieldResult = db.exec("SELECT * FROM field_data WHERE id = ?", [id]);

			if (fieldResult.length && fieldResult[0].values.length) {
				const fieldRow = fieldResult[0].values[0];

				const instance = new TetrisEnv();
				Object.assign(instance, JSON.parse(fieldRow[1] as string));

				returnNode = new FieldDatabaseNode(
					fieldRow[0] as number,
					fieldRow[4] as number | undefined,
					fieldRow[5] as number | undefined,
					fieldRow[2] as string | undefined,
					instance
				);
			}
			break;



		case 'text':
			const textResult = db.exec("SELECT * FROM text_data WHERE id = ?", [id]);

			if (textResult.length && textResult[0].values.length) {
				const textRow = textResult[0].values[0];
				console.log(textRow);
				throw new Error("TextDatabaseNode is not implemented yet.");
				/*returnNode = new TextDatabaseNode(
					textRow[0] as number,
					textRow[1] as number | undefined,
					textRow[2] as number | undefined,
					textRow[3] as string | undefined,
					textRow[4] as string | undefined,
					textRow[5] as string | undefined
				);

				node.fields.push({
					id: textRow[0] as number,
					type: 'text',
					data: textRow[4] as string,
					x: textRow[1] as number | undefined,
					y: textRow[2] as number | undefined,
					thumbnail: undefined
				});*/
			}
			break;
	}

	return returnNode;

}
