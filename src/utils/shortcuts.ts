import { writable, get } from 'svelte/store';

export interface IShortcut {
	id: string;
	key: string;
	ctrl: boolean;
	shift: boolean;
	alt: boolean;
	callback(): void;
}

export class Shortcut implements IShortcut {
	constructor(
		public id: string,
		public key: string,
		public ctrl: boolean,
		public shift: boolean,
		public alt: boolean,
		public callback: () => void
	) { }
}

export interface IShortcutRegistry {
	register(shortcut: IShortcut): void;
	unregisterById(id: string): void;
	unregisterByKey(combinedKey: string): void;
	getKeyById(id: string): string | undefined;
	getIdByKey(combinedKey: string): string | undefined;
	clear(): void;
	unregisterShortcutByKey(key: string, ctrl: boolean, shift: boolean, alt: boolean): void;
	unregisterAllShortcuts(): void;
	handleShortcut(event: KeyboardEvent): void;
}

export const shortcuts = new class implements IShortcutRegistry {
	private _shortcuts = writable<Record<string, { callback: () => void }>>({});

	private idToKey = writable<Record<string, string>>({});
	private keyToId = writable<Record<string, string>>({});

	register(shortcut: IShortcut): void {
		const combinedKey = `${shortcut.ctrl ? 'Ctrl+' : ''}${shortcut.shift ? 'Shift+' : ''}${shortcut.alt ? 'Alt+' : ''}${shortcut.key.toUpperCase()}`;
		this.unregisterById(shortcut.id);
		this.unregisterByKey(combinedKey);

		this.idToKey.update((map) => ({ ...map, [shortcut.id]: combinedKey }));
		this.keyToId.update((map) => ({ ...map, [combinedKey]: shortcut.id }));

		this._shortcuts.update((sc) => ({
			...sc,
			[combinedKey]: { callback: shortcut.callback }
		}));
	}

	unregisterById(id: string): void {
		this.idToKey.update((map) => {
			const key = map[id];
			if (key) {
				this.keyToId.update((reverseMap) => {
					const { [key]: _, ...rest } = reverseMap;
					return rest;
				});
			}
			const { [id]: _, ...rest } = map;
			return rest;
		});
	}

	unregisterByKey(combinedKey: string): void {
		this.keyToId.update((map) => {
			const id = map[combinedKey];
			if (id) {
				this.idToKey.update((reverseMap) => {
					const { [id]: _, ...rest } = reverseMap;
					return rest;
				});
			}
			const { [combinedKey]: _, ...rest } = map;
			return rest;
		});
	}

	getKeyById(id: string): string | undefined {
		return get(this.idToKey)[id];
	}

	getIdByKey(combinedKey: string): string | undefined {
		return get(this.keyToId)[combinedKey];
	}

	clear(): void {
		this.idToKey.update(() => ({}));
		this.keyToId.update(() => ({}));
	}

	unregisterShortcutByKey(key: string, ctrl: boolean, shift: boolean, alt: boolean): void {
		const combinedKey = `${ctrl ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${alt ? 'Alt+' : ''}${key.toUpperCase()}`;
		this.unregisterByKey(combinedKey);
		this._shortcuts.update((sc) => {
			const { [combinedKey]: _, ...rest } = sc;
			return rest;
		});
	}

	unregisterAllShortcuts(): void {
		this._shortcuts.update(() => ({}));
		this.clear();
	}

	handleShortcut(event: KeyboardEvent): void {
		const combinedKey = `${event.ctrlKey ? 'Ctrl+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.altKey ? 'Alt+' : ''}${event.key.toUpperCase()}`;
		const sc = get(this._shortcuts);
		const shortcut = sc[combinedKey];
		if (shortcut) {
			event.preventDefault();
			shortcut.callback();
		}
	}
}
