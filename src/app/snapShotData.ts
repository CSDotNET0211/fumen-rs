import type { TetrisEnv } from "tetris/src/tetris_env";

export class SnapshotData {
	env: TetrisEnv;
	thumbnail: string;
	title: string;

	constructor(env: TetrisEnv, thumbnail: string, title: string) {
		this.env = env;
		this.thumbnail = thumbnail;
		this.title = title;
	}
}
