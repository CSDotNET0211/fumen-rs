import { writable, get } from 'svelte/store';

export interface ICommand {
	id: string;
	execute: (...args: any[]) => void | Promise<void>;
}

export class Command implements ICommand {
	constructor(
		public id: string,
		public execute: (...args: any[]) => void | Promise<void>
	) { }
}

export interface ICommandRegistry {
	registerCommand(command: ICommand): void;
	unregisterCommand(name: string): void;
	unregisterAllCommands(): void;
	executeCommand(name: string, ...args: any[]): Promise<void>;
}

export const commands: ICommandRegistry = new class implements ICommandRegistry {
	private _commands = writable<Record<string, ICommand>>({});

	registerCommand(command: ICommand): void {
		this._commands.update((cmds) => {
			return { ...cmds, [command.id]: command };
		});
	}

	unregisterCommand(name: string): void {
		this._commands.update((cmds) => {
			if (!cmds[name]) {
				throw new Error(`Command "${name}" is not registered.`);
			}
			const { [name]: _, ...rest } = cmds;
			return rest;
		});
	}

	unregisterAllCommands(): void {
		this._commands.set({});
	}

	async executeCommand(name: string, ...args: any[]): Promise<void> {
		const cmds = get(this._commands);
		const command = cmds[name];
		if (!command) {
			throw new Error(`Command "${name}" is not registered.`);
		}
		await command.execute(...args);
	}
}();
