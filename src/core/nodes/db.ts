import type { Database } from "sql.js";
import initSqlJs from "sql.js";
import type { DatabaseNode } from "./DatabaseNode/databaseNode";
import { FieldDatabaseNode } from "./DatabaseNode/fieldDatabaseNode";
import { TetrisEnv } from "tetris/src/tetris_env";
import { TextDatabaseNode } from "./DatabaseNode/textDatabaseNode";
import { SHA256 } from "crypto-js";
import { getOffScreenCanvasImage } from "../../features/windows/field/modules/tetrisBoard.svelte";
import { nodeUpdater } from "./NodeUpdater/nodeUpdater";
import { get } from "svelte/store";
import { currentWindow, WindowFadeDuration, WindowType } from "../../app/stores/window";
import { currentFieldIndex } from "../../app/stores/data";
import { currentField, FieldType } from "../../features/windows/field/field";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../../features/windows/canvas/const";
let SQL: initSqlJs.SqlJsStatic;
let db: Database | null = null;


export function getDatabaseAsBinary(): Uint8Array<ArrayBufferLike> {
	const data = db?.export();
	if (!data) {
		throw new Error("Database is not initialized or empty.");
	}

	const cloned = new SQL.Database(data);
	cloned.run(`
	UPDATE field_data SET thumbnail = NULL, hash = NULL;
`);

	//	const allFieldData = cloned.exec("SELECT * FROM field_data");
	//	console.log("field_data table contents:", allFieldData);
	//TODO:
	return data;
}

export async function initializeDatabase() {
	SQL = await initSqlJs({
		// Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
		// You can omit locateFile completely when running in node
		locateFile: (file: any) => `${file}`
	});

	//resetDatabase();
	get(nodeUpdater)!.load(generateDefaultDatabaseAsBinary(), false);


}
/*
export function resetDatabase() {
	db?.close();
	db = new SQL.Database();

	get(nodeUpdater)!.load(generateDefaultDatabaseAsBinary());

//	let customEvent = new CustomEvent("databaseLoaded");
//	document.dispatchEvent(customEvent);

}

*/

export function generateDefaultDatabaseAsBinary(): Uint8Array<ArrayBufferLike> {
	let db: Database = new SQL.Database();
	db.run(`
		CREATE TABLE nodes (
			id INTEGER PRIMARY KEY,
			type TEXT NOT NULL
		);
	`);

	db.run(`
		CREATE TABLE connections (
			from_id INTEGER ,
			to_id INTEGER ,
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
			id INTEGER PRIMARY KEY,
			x REAL,
			y REAL,
			size INTEGER,
			text TEXT,
			color TEXT,
			backgroundColor TEXT,
			FOREIGN KEY (id) REFERENCES nodes(id) ON DELETE CASCADE
		);
	`);

	db.run(`
		CREATE TABLE config (
			version INTEGER
		);
	`);
	db.run(`INSERT INTO config (version) VALUES (1);`);

	// Enable foreign key constraints
	db.run(`PRAGMA foreign_keys = ON;`);


	const insertSql = `INSERT INTO nodes (type) VALUES (?)`;
	db.run(insertSql, ["field"]);
	const nodeIdResult = db.exec("SELECT last_insert_rowid()");
	const nodeId = nodeIdResult[0].values[0][0] as number;

	const fieldColumns: string[] = ["id"];
	const fieldValues: any[] = [nodeId];

	fieldColumns.push("data");
	fieldValues.push(JSON.stringify(new TetrisEnv()));

	fieldColumns.push("x");
	fieldValues.push(CANVAS_WIDTH / 2);

	fieldColumns.push("y");
	fieldValues.push(CANVAS_HEIGHT / 2);


	const fieldSql = `INSERT INTO field_data (${fieldColumns.join(", ")}) VALUES (${fieldColumns.map(() => "?").join(", ")})`;
	db.run(fieldSql, fieldValues);


	return db.export();
}
export async function loadDatabase(dbData: Uint8Array<ArrayBufferLike>, useSplash: boolean) {
	db = new SQL.Database(dbData);
	db.run(`PRAGMA foreign_keys = ON;`);

	if (useSplash) {
		const originalWindow = get(currentWindow);

		const waitForTransition = new Promise<void>((resolve) => {
			document.addEventListener("onWindowTransitionEnd", async () => {
				await new Promise(resolve => setTimeout(resolve, 100));
				resolve();
			}, { once: true });
		});

		//currentField.set(FieldType.TetrisEdit);
		currentWindow.set(WindowType.Splash);
		currentFieldIndex.set(-1);

		await waitForTransition;

		const firstFieldResult = getLatestFieldId()!;
		//if (firstFieldResult) {
		currentFieldIndex.set(firstFieldResult);
		currentWindow.set(originalWindow);
		WindowFadeDuration.set(300);
		//}


	} else {
		currentFieldIndex.set(-1);
		const firstFieldResult = getLatestFieldId();
		currentFieldIndex.set(firstFieldResult!);

	}


	const event = new CustomEvent("databaseLoaded", {
		detail: { id: getLatestFieldId() }
	});
	document.dispatchEvent(event);
}

export function getLatestFieldId(): number | null {
	if (!db) {
		throw new Error("Database is not initialized.");
	}

	const result = db.exec("SELECT id FROM field_data ORDER BY id DESC LIMIT 1");
	if (result.length && result[0].values.length) {
		return result[0].values[0][0] as number;
	}
	return null;
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



	const firstFieldResult = getLatestFieldId();
	if (firstFieldResult) {
		currentFieldIndex.set(firstFieldResult);
	}
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
					instance,
					fieldRow[3] as string | undefined
				);
			}
			break;



		case 'text':
			const textResult = db.exec("SELECT * FROM text_data WHERE id = ?", [id]);

			if (textResult.length && textResult[0].values.length) {
				const fieldRow = textResult[0].values[0];

				returnNode = new TextDatabaseNode(fieldRow[0] as number,
					fieldRow[1] as number | undefined,
					fieldRow[2] as number | undefined,
					fieldRow[4] as string | undefined,
					fieldRow[3] as number | undefined,
					fieldRow[5] as string | undefined
					, fieldRow[6] as string | undefined,
				);

			}
			break;
		default: throw new Error(`Unknown node type: ${type}`);
	}

	return returnNode;

}

export function getAllNodesDatabase(): DatabaseNode[] {
	if (!db) {
		throw new Error("Database is not initialized.");
	}

	const nodes: DatabaseNode[] = [];
	const result = db.exec("SELECT * FROM nodes");

	for (const row of result[0].values) {
		const node = getNodeDatabase(row[0] as number);
		if (node) {
			nodes.push(node);
		}
	}

	return nodes;
}

export function getAllFieldNodesDatabase(): FieldDatabaseNode[] {
	if (!db) {
		throw new Error("Database is not initialized.");
	}

	const fieldNodes: FieldDatabaseNode[] = [];
	const result = db.exec("SELECT * FROM field_data");

	if (result.length && result[0].values.length) {
		for (const row of result[0].values) {
			const instance = new TetrisEnv();
			Object.assign(instance, JSON.parse(row[1] as string));

			const fieldNode = new FieldDatabaseNode(
				row[0] as number,
				row[4] as number | undefined,
				row[5] as number | undefined,
				row[2] as string | undefined,
				instance,
				row[3] as string | undefined,
			);
			fieldNodes.push(fieldNode);
		}
	}

	return fieldNodes;
}



export function getAllTextNodesDatabase(): TextDatabaseNode[] {
	if (!db) {
		throw new Error("Database is not initialized.");
	}

	const textNodes: TextDatabaseNode[] = [];
	const result = db.exec("SELECT * FROM text_data");

	if (result.length && result[0].values.length) {
		for (const row of result[0].values) {
			const textNode = new TextDatabaseNode(
				row[0] as number,
				row[1] as number | undefined,
				row[2] as number | undefined,
				row[4] as string | undefined,
				row[3] as number | undefined,
				row[5] as string | undefined,
				row[6] as string | undefined
			);
			textNodes.push(textNode);
		}
	}

	return textNodes;
}

export async function updateThumbnailDatabase(id: number) {

	if (!db) {
		throw new Error("Database is not initialized.");
	}

	const node = getNodeDatabase(id);

	if (!node) {
		throw new Error(`Node with id ${id} not found.`);
	}

	if (node.type != "field") {
		throw new Error(`Node with id ${id} is not a FieldDatabaseNode.`);
	}
	const fieldNode = node as FieldDatabaseNode;


	const thumbnailHash = SHA256(JSON.stringify(fieldNode.data)).toString();

	if (thumbnailHash == fieldNode.hash && fieldNode.thumbnail != undefined) {
		return;
	}

	console.log("Updating thumbnail for node ID:", id);
	const thumbnail = await getOffScreenCanvasImage(fieldNode.data?.board, undefined, undefined) ?? "";

	await get(nodeUpdater)!.update(new FieldDatabaseNode(fieldNode.id, undefined, undefined, thumbnail, undefined, thumbnailHash));
}

export async function updateAllThumbnailsDatabase() {
	const fieldNodes = getAllFieldNodesDatabase();
	for (const fieldNode of fieldNodes) {
		await updateThumbnailDatabase(fieldNode.id!);
	}
}