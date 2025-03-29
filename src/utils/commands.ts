import { writable, get } from 'svelte/store';

export abstract class BaseCommand {
	abstract name: string;
	abstract execute(...args: any[]): void | Promise<void>;
}

const commands = writable<Record<string, BaseCommand>>({});

function registerCommand(command: BaseCommand): void {
	if (!(command instanceof BaseCommand)) {
		throw new Error("Only instances of BaseCommand or its subclasses can be registered.");
	}
	commands.update((cmds) => {
		return { ...cmds, [command.name]: command };
	});
}

function unregisterCommand(name: string): void {
	commands.update((cmds) => {
		if (!cmds[name]) {
			throw new Error(`Command "${name}" is not registered.`);
		}
		const { [name]: _, ...rest } = cmds;
		return rest;
	});
}

function unregisterAllCommands(): void {
	commands.set({});
}

async function executeCommand(name: string, ...args: any[]): Promise<void> {
	const cmds = get(commands);
	const command = cmds[name];
	if (!command) {
		throw new Error(`Command "${name}" is not registered.`);
	}
	await command.execute(...args);
}

async function loadCommands(): Promise<void> {
	const context = import.meta.glob("../registry/commands/*.ts");
	for (const path in context) {
		const module = await context[path]();
		for (const key in module as Record<string, any>) {
			const CommandClass = (module as Record<string, any>)[key];

			if (typeof CommandClass === "function" && CommandClass.prototype instanceof BaseCommand) {
				registerCommand(new CommandClass());
			}
		}
	}
}

export {
	unregisterCommand,
	unregisterAllCommands,
	executeCommand,
	loadCommands,
};
