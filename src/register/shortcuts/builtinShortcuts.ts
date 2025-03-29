import { boardViewContent, BoardViewContentType } from "../../store";
import { executeCommand } from "../../utils/commands";
import { BaseShortcut } from "../../utils/shortcuts";

export class UndoShortcut extends BaseShortcut {
	name = "undoShortcut";
	key = "z";
	ctrl = true;
	shift = false;
	alt = false;
	callback(): void {
		executeCommand("fumen.undo");
	}
}

export class RedoShortcut extends BaseShortcut {
	name = "redoShortcut";
	key = "y";
	ctrl = true;
	shift = false;
	alt = false;
	callback(): void {
		executeCommand("fumen.redo");
	}
}
export class PlayShortcut extends BaseShortcut {
	name = "playShortcut";
	key = "F5";
	ctrl = false;
	shift = false;
	alt = false;
	callback(): void {
		boardViewContent.set(BoardViewContentType.TetrisPlay);
	}
}

export class EditShortcut extends BaseShortcut {
	name = "editShortcut";
	key = "F5";
	ctrl = false;
	shift = true;
	alt = false;
	callback(): void {
		boardViewContent.set(BoardViewContentType.TetrisEdit);
	}
}

export class PasteShortcut extends BaseShortcut {
	name = "pasteShortcut";
	key = "v";
	ctrl = true;
	shift = false;
	alt = false;
	callback(): void {
		executeCommand("fumen.paste");
	}
}

export class NewShortcut extends BaseShortcut {
	name = "newShortcut";
	key = "n";
	ctrl = true;
	shift = false;
	alt = false;
	callback(): void {
		executeCommand("fumen.new", true);
	}
}

export class OpenShortcut extends BaseShortcut {
	name = "openShortcut";
	key = "o";
	ctrl = true;
	shift = false;
	alt = false;
	callback(): void {
		executeCommand("fumen.open");
	}
}

export class SaveShortcut extends BaseShortcut {
	name = "saveShortcut";
	key = "s";
	ctrl = true;
	shift = false;
	alt = false;
	callback(): void {
		executeCommand("fumen.save");
	}
}

export class CopyAsFumenShortcut extends BaseShortcut {
	name = "copyAsFumenShortcut";
	key = "c";
	ctrl = true;
	shift = false;
	alt = false;
	callback(): void {
		executeCommand("fumen.copy-as-fumen");
	}
}