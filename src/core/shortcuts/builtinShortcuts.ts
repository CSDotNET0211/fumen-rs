
import { commands } from "../../core/commands/commands";
import { currentField, FieldType } from "../../features/windows/field/field";
import { Shortcut, shortcuts } from "./shortcuts";

export function registerShortcuts() {
	shortcuts.register(
		new Shortcut("fumen.shortcut.undo",
			"z",
			true,
			false,
			false,
			() => {
				commands.executeCommand("fumen.undo");
			}));

	shortcuts.register(
		new Shortcut("fumen.shortcut.redo",
			"y",
			true,
			false,
			false,
			() => {
				commands.executeCommand("fumen.redo");
			}));

	shortcuts.register(
		new Shortcut("fumen.shortcut.play",
			"F5",
			false,
			false,
			false,
			() => {
				currentField.set(FieldType.TetrisPlay);
			}));

	shortcuts.register(
		new Shortcut("fumen.shortcut.edit",
			"F5",
			false,
			true,
			false,
			() => {
				currentField.set(FieldType.TetrisEdit);
			}));

	shortcuts.register(
		new Shortcut("fumen.shortcut.paste",
			"v",
			true,
			false,
			false,
			() => {
				commands.executeCommand("fumen.paste");
			}));

	shortcuts.register(
		new Shortcut("fumen.shortcut.new",
			"n",
			true,
			false,
			false,
			() => {
				commands.executeCommand("fumen.new", true);
			}));

	shortcuts.register(
		new Shortcut("fumen.shortcut.open",
			"o",
			true,
			false,
			false,
			() => {
				commands.executeCommand("fumen.open");
			}));

	shortcuts.register(
		new Shortcut("fumen.shortcut.save",
			"s",
			true,
			false,
			false,
			() => {
				commands.executeCommand("fumen.save");
			}));

	shortcuts.register(
		new Shortcut("fumen.shortcut.saveas",
			"s",
			true,
			true,
			false,
			() => {
				commands.executeCommand("fumen.saveas");
			}));

	shortcuts.register(
		new Shortcut("fumen.shortcut.copy-as-fumen",
			"c",
			true,
			false,
			false,
			() => {
				commands.executeCommand("fumen.copy-as-fumen");
			}));
}

