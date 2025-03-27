import { writable, get } from 'svelte/store';

const shortcuts = writable<Record<string, { callback: () => void }>>({});
const idToKey = writable<Record<string, string>>({});
const keyToId = writable<Record<string, string>>({});

export function registerShortcut(
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

export function registerShortcutWithId(
	id: string,
	key: string,
	ctrl: boolean,
	shift: boolean,
	alt: boolean,
	callback: () => void
): void {
	const combinedKey = `${ctrl ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${alt ? 'Alt+' : ''}${key.toUpperCase()}`;

	unregisterShortcutById(id);
	unregisterShortcutByKey(id, ctrl, shift, alt);

	registerShortcut(key, ctrl, shift, alt, callback);
	idToKey.update((map) => ({ ...map, [id]: combinedKey }));
	keyToId.update((map) => ({ ...map, [combinedKey]: id }));
}

export function unregisterShortcutById(id: string): void {
	idToKey.update((map) => {
		const key = map[id];
		if (key) {
			keyToId.update((reverseMap) => {
				const { [key]: _, ...rest } = reverseMap;
				return rest;
			});
			unregisterShortcut(key, false, false, false); // 修飾キーは省略
		}
		const { [id]: _, ...rest } = map;
		return rest;
	});
}

export function unregisterShortcutByKey(
	key: string,
	ctrl: boolean,
	shift: boolean,
	alt: boolean
): void {
	keyToId.update((map) => {
		const id = map[key];
		if (id) {
			idToKey.update((reverseMap) => {
				const { [id]: _, ...rest } = reverseMap;
				return rest;
			});
			unregisterShortcut(key, ctrl, shift, alt);
		}
		const { [key]: _, ...rest } = map;
		return rest;
	});
}

export function getKeyById(id: string): string | undefined {
	return get(idToKey)[id];
}

export function getIdByKey(key: string): string | undefined {
	return get(keyToId)[key];
}

export function registerKeyById(
	id: string,
	key: string,
	ctrl: boolean,
	shift: boolean,
	alt: boolean,
	callback: () => void
): void {
	const existingKey = getKeyById(id);
	if (existingKey) {
		unregisterShortcut(existingKey, ctrl, shift, alt);
	}
	registerShortcutWithId(id, key, ctrl, shift, alt, callback);
}
