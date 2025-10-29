import initSqlJs from 'sql.js';
import { get } from 'svelte/store';
import { t } from '../../translations/translations';

export async function initialize() {
	const SQL = await initSqlJs({
		// Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
		// You can omit locateFile completely when running in node
		locateFile: (file: any) => `${file}`
	});

	const db = new SQL.Database();
	db.run(`PRAGMA foreign_keys = ON;`);


	db.run(`
		CREATE TABLE menu (
			location TEXT NOT NULL,
			shortcut_id INTEGER,
			name TEXT NOT NULL,
			order_num INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY (location),
			FOREIGN KEY (shortcut_id) REFERENCES shortcut(id)
		);

		CREATE TABLE shortcut (
			id INTEGER PRIMARY KEY,
			ctrl BOOLEAN,
			alt BOOLEAN,
			shift BOOLEAN,
			key TEXT NOT NULL,
			action_id TEXT NOT NULL
		);

		CREATE INDEX idx_menu_location ON menu (location);
		CREATE INDEX idx_menu_order ON menu (order_num);

		CREATE UNIQUE INDEX idx_shortcut_composite
		ON shortcut (ctrl, alt, shift, key);

		INSERT INTO shortcut (id, ctrl, alt, shift, key, action_id) VALUES
		(0, TRUE, FALSE, FALSE, 'n', 'fumen.new');

		INSERT INTO menu (location, shortcut_id, name, order_num) VALUES
		('panel', 0, 'パネル', 1),
		('panel.preset', NULL, 'プリセット', 2),
		('panel.preset.item1', NULL, 'Default', 3);
	`);
}

export function getShortcut(
	db: any,
	ctrl: boolean | null,
	alt: boolean | null,
	shift: boolean | null,
	key: string
): { id: number; action_id: string } | null {
	const stmt = db.prepare(`
		SELECT id, action_id 
		FROM shortcut 
		WHERE ctrl IS ? AND alt IS ? AND shift IS ? AND key = ?
	`);

	const result = stmt.get([ctrl, alt, shift, key]);
	stmt.free();

	return result || null;
}

export function getShortcutById(
	db: any,
	id: number
): { keys: string; action_id: string } | null {
	const stmt = db.prepare(`
		SELECT ctrl, alt, shift, key, action_id 
		FROM shortcut 
		WHERE id = ?
	`);

	const result = stmt.get([id]);
	stmt.free();

	if (!result) return null;

	const keyParts: string[] = [];
	if (result.ctrl) keyParts.push('Ctrl');
	if (result.alt) keyParts.push('Alt');
	if (result.shift) keyParts.push('Shift');
	keyParts.push(result.key.toUpperCase());

	return {
		keys: keyParts.join('+'),
		action_id: result.action_id
	};
}

export function addMenu(
	db: any,
	location: string,
	name: string,
	orderNum: number,
	shortcutId?: number
): boolean {
	try {
		const stmt = db.prepare(`
			INSERT INTO menu (location, shortcut_id, name, order_num) 
			VALUES (?, ?, ?, ?)
		`);
		stmt.run([location, shortcutId || null, name, orderNum]);
		stmt.free();
		return true;
	} catch (error) {
		return false;
	}
}

export function addShortcut(
	db: any,
	ctrl: boolean | null,
	alt: boolean | null,
	shift: boolean | null,
	key: string,
	actionId: string
): number | null {
	try {
		const stmt = db.prepare(`
			INSERT INTO shortcut (ctrl, alt, shift, key, action_id) 
			VALUES (?, ?, ?, ?, ?)
		`);
		const result = stmt.run([ctrl, alt, shift, key, actionId]);
		stmt.free();
		return result.lastInsertRowid as number;
	} catch (error) {
		return null;
	}
}

