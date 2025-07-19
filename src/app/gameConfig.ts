import { RotationType } from "tetris/src/rotation_type";
import { Keymap } from "./keymap";
import { BaseDirectory, exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { PanelPresets as PanelPresets } from "./panelPresets";

type KeymapEntry = {
	key: string;
	editable: boolean;
	title: string;
};
export class GameConfig {


	keymaps: Map<string, Record<string, KeymapEntry>> | null;
	das!: number | null;
	arr!: number | null;
	sdf!: number | null;
	rotationType!: RotationType | null;
	color!: string | null;
	currentPreset!: string | null;
	socketAddress!: string | null;
	fumenImageRecognitionModelURL!: string | null;
	bgBorderOpacity!: number | null;
	language!: string | null;
	ghostPiece!: boolean | null;
	windowSize!: { width: number; height: number } | undefined;
	panelPresets: PanelPresets | null = null;

	constructor() {
		this.keymaps = new Map<string, Record<string, KeymapEntry>>();
	}
	static default(): GameConfig {
		let obj = new GameConfig();
		obj.keymaps!.set("TetrisEdit", {
			SelectSBlock: { key: "1", editable: false, title: "Select S Block" },
			SelectZBlock: { key: "2", editable: false, title: "Select Z Block" },
			SelectJBlock: { key: "3", editable: false, title: "Select J Block" },
			SelectLBlock: { key: "4", editable: false, title: "Select L Block" },
			SelectTBlock: { key: "5", editable: false, title: "Select T Block" },
			SelectOBlock: { key: "6", editable: false, title: "Select O Block" },
			SelectIBlock: { key: "7", editable: false, title: "Select I Block" },
		});
		obj.keymaps!.set("TetrisPlay", {
			Right: { key: "ArrowRight", editable: true, title: "Move Right" },
			Left: { key: "ArrowLeft", editable: true, title: "Move Left" },
			RotateCW: { key: "KeyC", editable: true, title: "Rotate Clockwise" },
			RotateCCW: { key: "KeyX", editable: true, title: "Rotate Counterclockwise" },
			Rotate180: { key: "KeyV", editable: true, title: "Rotate 180 Degrees" },
			Hold: { key: "KeyZ", editable: true, title: "Hold Piece" },
			HardDrop: { key: "ArrowUp", editable: true, title: "Hard Drop" },
			SoftDrop: { key: "ArrowDown", editable: true, title: "Soft Drop" },
			ResetGame: { key: "KeyR", editable: true, title: "Reset Game" },
		});

		obj.keymaps!.set("General", {
			Undo: { key: "Ctrl+Z", editable: false, title: "Undo Last Action" },
			Redo: { key: "Ctrl+Y", editable: false, title: "Redo Last Action" },
			Paste: { key: "Ctrl+V", editable: false, title: "Paste Fumen Code" },
		});

		obj.das = 7;
		obj.arr = 0;
		obj.sdf = 1;
		obj.rotationType = RotationType.SRS;
		obj.color = "#FFFFFF";
		obj.currentPreset = "Default";
		obj.socketAddress = "https://api.csdotnet.dev";
		obj.fumenImageRecognitionModelURL = "https://teachablemachine.withgoogle.com/models/cr0rQ-61V/";
		obj.bgBorderOpacity = 0.8;
		obj.language = "en";
		obj.ghostPiece = true;
		obj.windowSize = undefined;
		obj.panelPresets = PanelPresets.getDefault()

		return obj;
	}

	addKeymap(name: string, keymap: Record<string, KeymapEntry>) {
		this.keymaps!.set(name, keymap);
	}

	toJSON(): string {
		return JSON.stringify({
			keymaps: Array.from(this.keymaps!.entries()),
			das: this.das,
			arr: this.arr,
			sdf: this.sdf,
			rotationSystem: this.rotationType,
			color: this.color,
			currentPreset: this.currentPreset,
			socketAddress: this.socketAddress,
			language: this.language,
			fumenImageRecognitionModelURL: this.fumenImageRecognitionModelURL,
			bgBorderOpacity: this.bgBorderOpacity,
			ghostPiece: this.ghostPiece,
			windowSize: this.windowSize,
			panelPresets: this.panelPresets,
		});
	}

	static fromJSON(json: string): GameConfig {
		const data = JSON.parse(json);
		const obj = new GameConfig();

		obj.keymaps = new Map<string, Record<string, KeymapEntry>>(data.keymaps);
		obj.das = data.das;
		obj.arr = data.arr;
		obj.sdf = data.sdf;
		obj.rotationType = data.rotationSystem;
		obj.color = data.color;
		obj.currentPreset = data.currentPreset;
		obj.socketAddress = data.socketAddress;
		obj.language = data.language;
		obj.fumenImageRecognitionModelURL = data.fumenImageRecognitionModelURL;
		obj.bgBorderOpacity = data.bgBorderOpacity;
		obj.ghostPiece = data.ghostPiece;
		obj.windowSize = data.windowSize;
		obj.panelPresets = data.panelPresets;

		return obj;
	}

	/// IS_WEB_MODEの場合はlocalStorage、Desktopの場合はファイルに保存
	static async loadOrCreate(IS_WEB_MODE: boolean): Promise<GameConfig> {
		let gameConfig: GameConfig | null = null;

		if (IS_WEB_MODE) {
			let config = localStorage.getItem("config");
			if (!config) {
				let gameConfig = GameConfig.default();
				let locale = Intl.DateTimeFormat().resolvedOptions().locale;
				console.log(locale);
				if (locale === "ja-JP") {
					gameConfig.language = "ja";
				} else {
					gameConfig.language = "en";
				}

				this.save(IS_WEB_MODE, gameConfig);
			}

			gameConfig = this.fromJSON(localStorage.getItem("config")!);
		} else {
			let configExists = await exists("config.json", {
				baseDir: BaseDirectory.Resource,
			});
			if (!configExists) {
				let gameConfig = GameConfig.default();
				let locale = Intl.DateTimeFormat().resolvedOptions().locale;
				console.log(locale);
				if (locale === "ja-JP") {
					gameConfig.language = "ja";
				} else {
					gameConfig.language = "en";
				}

				this.save(IS_WEB_MODE, gameConfig);
			}

			let jsonStr = await readTextFile("config.json", {
				baseDir: BaseDirectory.Resource,
			});

			gameConfig = this.fromJSON(jsonStr);
		}

		return gameConfig!;
	}

	static save(IS_WEB_MODE: boolean, config: GameConfig) {
		if (IS_WEB_MODE) {
			localStorage.setItem("config", config.toJSON());
		} else {
			writeTextFile("config.json", config.toJSON(), {
				baseDir: BaseDirectory.Resource,
			});
		}
	}


}