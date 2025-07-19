import type { ICopyPaste } from "./ICopyPaste.ts";
import type { IEventListener } from "./IEventListener.ts";
import type { IUndoRedo } from "./IUndoRedo.ts";

export abstract class WindowBase implements ICopyPaste, IUndoRedo, IEventListener {
	constructor(content: any) {
		this.content = content;
	}

	content: any;

	abstract copy(): void;
	abstract paste(): void;
	abstract undo(): void;
	abstract redo(): void;
	abstract registerAll(): void;
	abstract unregisterAll(): void;

}