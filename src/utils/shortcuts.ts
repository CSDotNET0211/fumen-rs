import { writable, get } from 'svelte/store';

export abstract class BaseShortcut {
	abstract name: string;
	abstract key: string;
	abstract ctrl: boolean;
	abstract shift: boolean;
	abstract alt: boolean;
	abstract callback(): void;

}

class ShortcutRegistry {
	private idToKey = writable<Record<string, string>>({});
	private keyToId = writable<Record<string, string>>({});

	register(id: string, combinedKey: string): void {
		this.unregisterById(id);
		this.unregisterByKey(combinedKey);

		this.idToKey.update((map) => ({ ...map, [id]: combinedKey }));
		this.keyToId.update((map) => ({ ...map, [combinedKey]: id }));
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
}

const shortcuts = writable<Record<string, { callback: () => void }>>({});
const registry = new ShortcutRegistry();

export async function loadShortcuts(): Promise<void> {
	const context = import.meta.glob("../registry/shortcuts/*.ts");
	for (const path in context) {
		const module = await context[path]();
		for (const key in module as Record<string, any>) {
			const ShortcutClass = (module as Record<string, any>)[key];

			if (typeof ShortcutClass === "function" && ShortcutClass.prototype instanceof BaseShortcut) {
				registerShortcutWithId(new ShortcutClass());
			}
		}
	}
}

function registerShortcut(
	key: string,
	ctrl: boolean,
	shift: boolean,
	alt: boolean,
	callback: () => void
): void {
	const combinedKey = `${ctrl ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${alt ? 'Alt+' : ''}${key.toUpperCase()}`;
	shortcuts.update((sc) => {
		return { ...sc, [combinedKey]: { callback } };
	});
}

export function unregisterShortcut(key: string, ctrl: boolean, shift: boolean, alt: boolean): void {
	const combinedKey = `${ctrl ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${alt ? 'Alt+' : ''}${key.toUpperCase()}`;
	shortcuts.update((sc) => {
		if (!sc[combinedKey]) {
			throw new Error(`Shortcut "${combinedKey}" is not registered.`);
		}
		const { [combinedKey]: _, ...rest } = sc;
		return rest;
	});
}

export function handleShortcut(event: KeyboardEvent): void {
	const combinedKey = `${event.ctrlKey ? 'Ctrl+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.altKey ? 'Alt+' : ''}${event.key.toUpperCase()}`;
	const sc = get(shortcuts);
	const shortcut = sc[combinedKey];
	if (shortcut) {
		event.preventDefault();
		shortcut.callback();
	}
}

function registerShortcutWithId(
	shortcut: BaseShortcut
): void {
	const combinedKey = `${shortcut.ctrl ? 'Ctrl+' : ''}${shortcut.shift ? 'Shift+' : ''}${shortcut.alt ? 'Alt+' : ''}${shortcut.key.toUpperCase()}`;

	registry.register(shortcut.name, combinedKey);
	registerShortcut(shortcut.key, shortcut.ctrl, shortcut.shift, shortcut.alt, shortcut.callback);
}

export function unregisterShortcutById(id: string): void {
	const combinedKey = registry.getKeyById(id);
	if (combinedKey) {
		unregisterShortcut(combinedKey, false, false, false);
	}
	registry.unregisterById(id);
}

export function unregisterShortcutByKey(
	key: string,
	ctrl: boolean,
	shift: boolean,
	alt: boolean
): void {
	const combinedKey = `${ctrl ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${alt ? 'Alt+' : ''}${key.toUpperCase()}`;
	registry.unregisterByKey(combinedKey);
	unregisterShortcut(key, ctrl, shift, alt);
}

export function getKeyById(id: string): string | undefined {
	return registry.getKeyById(id);
}

export function getIdByKey(key: string): string | undefined {
	return registry.getIdByKey(key);
}

export function registerKeyById(
	shortcut: BaseShortcut,
): void {
	const existingKey = getKeyById(shortcut.name);
	if (existingKey) {
		unregisterShortcut(existingKey, shortcut.ctrl, shortcut.shift, shortcut.alt);
	}
	registerShortcutWithId(shortcut);
}

export function unregisterAllShortcuts(): void {
	shortcuts.update(() => ({}));
	registry.clear();
}
