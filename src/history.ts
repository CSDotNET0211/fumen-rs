import { get } from "svelte/store";
import type { TetrisEnv } from "tetris/src/tetris_env";

const HISTORY_LIMIT = 40;

export type HistoryEntry = {
	entryName: String;
	entry: TetrisEnv;
	content: String;
};

export class History {

	history: HistoryEntry[];
	historyIndex: number | undefined;

	constructor() {
		this.history = [];
	}

	add(entryName: String, entry: TetrisEnv, content: String) {
		if (this.historyIndex !== undefined) {
			console.assert(this.historyIndex >= 0);
			this.history = this.history.slice(0, this.historyIndex + 1);
		}
		this.history.push({ entryName, entry, content });
		if (HISTORY_LIMIT < this.history.length) {
			this.history.shift();
		}
		this.historyIndex = this.history.length - 1;
	}

	get() {
		return this.history;
	}

	get current() {
		return this.history[this.historyIndex ?? -1];
	}

	get latest() {
		return this.history[this.history.length - 1];
	}

	get length() {
		return this.history.length;
	}

}