import { writable, get } from 'svelte/store';

const commands = writable<Record<string, () => void>>({});

export function registerCommand(name: string, callback: () => void | Promise<void>): void {
	commands.update((cmds) => {
		return { ...cmds, [name]: callback }; // 既に存在している場合は更新
	});
}

export function unregisterCommand(name: string): void {
	commands.update((cmds) => {
		if (!cmds[name]) {
			throw new Error(`Command "${name}" is not registered.`);
		}
		const { [name]: _, ...rest } = cmds;
		return rest;
	});
}

export async function executeCommand(name: string): Promise<void> {
	const cmds = get(commands);
	const command = cmds[name];
	if (!command) {
		throw new Error(`Command "${name}" is not registered.`);
	}
	await command();
}
