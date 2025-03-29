import { BaseCommand } from "../../utils/commands.ts";

export class ExampleCommand extends BaseCommand {
	name = "example.command";

	async execute() {
		console.log("Example command executed!");
	}
}
