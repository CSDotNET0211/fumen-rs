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
	// テーブルを作成し、特定の値で初期化
	db.run(`
		CREATE TABLE IF NOT EXISTS shortcuts (
			shortcut_id TEXT PRIMARY KEY,
			shortcut_name TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS key_bindings (
			binding_id INTEGER PRIMARY KEY AUTOINCREMENT,
			shortcut_id TEXT NOT NULL,
			base_key TEXT NOT NULL,
			is_shift BOOLEAN  NOT NULL DEFAULT FALSE,
			is_ctrl BOOLEAN  NOT NULL DEFAULT FALSE,
			is_alt BOOLEAN  NOT NULL DEFAULT FALSE,
			FOREIGN KEY (shortcut_id) REFERENCES shortcuts(shortcut_id),
			UNIQUE (base_key, is_shift, is_ctrl, is_alt)
		);

		CREATE TABLE IF NOT EXISTS menu (
			menu_id TEXT PRIMARY KEY,
			menu_label TEXT NOT NULL,
			parent_id TEXT,
			shortcut_id TEXT,
			action TEXT,
			FOREIGN KEY (shortcut_id) REFERENCES shortcuts(shortcut_id)
		);

		-- Insert commands into the shortcuts table
		INSERT OR IGNORE INTO shortcuts (shortcut_id, shortcut_name) VALUES
			('fumen.new', '${get(t)("common.menu-new")}' ),
			('fumen.open', '${get(t)("common.menu-open")}' ),
			('fumen.save', '${get(t)("common.menu-save")}' ),
			('fumen.paste', '${get(t)("common.menu-paste")}' ),
			('fumen.undo', '${get(t)("common.menu-undo")}' ),
			('fumen.redo', '${get(t)("common.menu-redo")}' ),
			('fumen.copy-as-fumen', '${get(t)("common.menu-copy-as-fumen")}' ),
			('fumen.copy-as-image', '${get(t)("common.menu-copy-as-image")}' );

		-- Insert key bindings into the key_bindings table
		INSERT OR IGNORE INTO key_bindings (shortcut_id, base_key, is_ctrl, is_shift, is_alt) VALUES
			('fumen.undo', 'z', TRUE, FALSE, FALSE),
			('fumen.redo', 'y', TRUE, FALSE, FALSE),
			('fumen.play', 'F5', FALSE, FALSE, FALSE),
			('fumen.edit', 'F5', FALSE, TRUE, FALSE),
			('fumen.paste', 'v', TRUE, FALSE, FALSE),
			('fumen.new', 'n', TRUE, FALSE, FALSE),
			('fumen.open', 'o', TRUE, FALSE, FALSE),
			('fumen.save', 's', TRUE, FALSE, FALSE),
			('fumen.copy-as-fumen', 'c', TRUE, FALSE, FALSE),
			('fumen.copy-as-image', 'c', TRUE, TRUE, FALSE);

		-- Insert menu items into the menu table
		INSERT OR IGNORE INTO menu (menu_id, menu_label, parent_id, shortcut_id, action) VALUES
			('menu.file', '${get(t)("common.menu-file")}', NULL, NULL, NULL),
			('menu.new', '${get(t)("common.menu-new")}', 'menu.file', 'fumen.new', 'onNew'),
			('menu.open', '${get(t)("common.menu-open")}', 'menu.file', 'fumen.open', 'onOpen'),
			('menu.save', '${get(t)("common.menu-save")}', 'menu.file', 'fumen.save', 'onSave'),
			('menu.edit', '${get(t)("common.menu-edit")}', NULL, NULL, NULL),
			('menu.undo', '${get(t)("common.menu-undo")}', 'menu.edit', 'fumen.undo', 'onUndo'),
			('menu.redo', '${get(t)("common.menu-redo")}', 'menu.edit', 'fumen.redo', 'onRedo'),
			('menu.paste', '${get(t)("common.menu-paste")}', 'menu.edit', 'fumen.paste', 'onPaste'),
			('menu.copy-as-fumen', '${get(t)("common.menu-copy-as-fumen")}', 'menu.edit', 'fumen.copy-as-fumen', 'onCopyAsFumen'),
			('menu.copy-as-image', '${get(t)("common.menu-copy-as-image")}', 'menu.edit', 'fumen.copy-as-image', 'onCopyAsImage');
	`);

	// 実行される関数(action)を取得する例
	const actionsResult = db.exec(`
		SELECT menu_id, action
		FROM menu
		WHERE action IS NOT NULL;
	`);
	console.log("Menu actions:", actionsResult[0]?.values);

	// Get key bindings for 'fumen.new'
	const result = db.exec(`
		SELECT base_key, is_ctrl, is_shift, is_alt
		FROM key_bindings
		WHERE shortcut_id = 'fumen.new';
	`);
	console.log("Key bindings for 'fumen.new':", result[0]?.values);
}
