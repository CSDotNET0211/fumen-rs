import { TetrisEnv } from "tetris/src/tetris_env";
import { commands, Command } from "./commands.ts";
import { History } from "../../history.ts";
import { get } from "svelte/store";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readImage, readText, writeImage, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Tetromino } from "tetris/src/tetromino.ts";
import { decoder, encoder, Field, type Pages } from "tetris-fumen";
import { writeFile } from "@tauri-apps/plugin-fs";
import { t } from "../../translations/translations.ts";
import { ImageProcessor } from "../../features/windows/field/overlays/imageProcessor.ts";
import { Image as TauriImage } from "@tauri-apps/api/image";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { currentField, currentOverlayField, FieldType, OverlayFieldType } from "../../features/windows/field/field.ts";
import { currentFieldIndex, currentFieldNode } from "../../app/stores/data.ts";
import { getCanvasImage } from "../../features/windows/field/modules/tetrisBoard.svelte";
import { history } from "../../app/stores/history.ts";
import { currentProjectPath, fumenImage, fumenPages, snapshot } from "../../app/stores/misc.ts";
import { currentWindow, WindowType } from "../../app/stores/window.ts";
import { generateDefaultDatabaseAsBinary, getDatabaseAsBinary, getLatestFieldId, loadDatabase, } from "../nodes/db.ts";
import { nodeUpdater } from "../nodes/NodeUpdater/nodeUpdater.ts";
import { FieldDatabaseNode } from "../nodes/DatabaseNode/fieldDatabaseNode.ts";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../../features/windows/canvas/const.ts";
import { sendUpdateDatabaseWS, wsSocket } from "../../services/online.ts";



async function setProcessImageMode(image: TauriImage | HTMLImageElement) {
	if (image instanceof TauriImage) {
		const rgba = await image.rgba();
		const size = await image.size();
		const base64Image = ImageProcessor.createImageFromRGBA(rgba, size);

		const imgElement = new Image();
		imgElement.src = base64Image;
		imgElement.onload = async () => {
			fumenImage.set(imgElement);
			currentOverlayField.set(OverlayFieldType.ImageImport);
		};
	} else {
		fumenImage.set(image);
		currentOverlayField.set(OverlayFieldType.ImageImport);
	}
}

export function registerCommands() {
	commands.registerCommand(
		new Command("fumen.new", async (showConfirmDialog: boolean) => {
			if (showConfirmDialog === true) {
				let confirmed = await confirm(get(t)("common.dialog-new-confirm"));
				if (!confirmed) return;
			}

			//1 -> 1のときは更新されないので、強制的に-1にしておく
			currentFieldIndex.set(-1);
			await get(nodeUpdater)!.load(generateDefaultDatabaseAsBinary(), get(currentWindow) !== WindowType.Splash);
			history.set(new History());
			/*	history.update((history: History) => {
					history.add(
						get(t)("common.history-base"),
						currentFieldNode.get()!.clone(),
						"",
					);
					return history;
				});*/

			//	get(nodeUpdater)!.load


			//	currentField.set(FieldType.TetrisEdit);
			//	currentWindow.set(WindowType.Field);

			snapshot.set([]);
			currentProjectPath.set(null);

		}));

	// Command: fumen.open
	commands.registerCommand(
		new Command("fumen.open", async () => {
			const file = await open({
				multiple: false,
				directory: false,
				filters: [
					{
						name: get(t)("common.dialog-all-files"),
						extensions: ["*"],
					},
					{
						name: get(t)("common.dialog-fumen-files"),
						extensions: ["sqlite"],
					},
					{
						name: get(t)("common.dialog-image-files"),
						extensions: ["png", "jpg", "jpeg", "bmp"],
					},
				],
			});

			if (file !== null) {
				let webPath = convertFileSrc(file);
				const ext = file.split('.').pop()?.toLowerCase();
				switch (ext) {
					case "png":
					case "jpg":
					case "jpeg":
					case "bmp": {
						const img = new Image();
						img.crossOrigin = "anonymous";
						img.src = webPath;
						img.onload = async () => {
							await setProcessImageMode(img);
						};
						break;
					}
					case "sqlite": {
						const response = await fetch(webPath);
						const blob = await response.blob();
						const arrayBuffer = await blob.arrayBuffer();
						const uint8Array = new Uint8Array(arrayBuffer);

						currentFieldIndex.set(-1);
						await get(nodeUpdater)!.load(uint8Array, false);

						// Set current project path
						currentProjectPath.set(file);

						//currentFieldIndex.set(getLatestFieldId()!);
						//	currentField.set(FieldType.TetrisEdit);
						//	currentWindow.set(WindowType.Field);


						break;
					}
					default:
						console.error("Unsupported file type");
				}
			}

		}))

	commands.registerCommand(
		new Command("fumen.saveas", async () => {
			const currentPath = get(currentProjectPath);
			let defaultPath = "fumen";
			console.log(currentPath);

			// If there's a current project path, use its directory
			if (currentPath !== null) {
				const pathParts = currentPath.split('\\');
				pathParts.pop(); // Remove filename
				defaultPath = pathParts.join('\\') + '\\fumen';
			}

			const path = await save({
				filters: [
					{
						name: "SQLite File",
						extensions: ["sqlite"],
					},
				],
				defaultPath: defaultPath,
			});

			if (path !== null) {
				//let bin = currentFieldNode.get()!.serialize();
				let bin = await getDatabaseAsBinary();
				await writeFile(path, bin);

				// Set current project path
				currentProjectPath.set(path);
			}
		}));

	commands.registerCommand(
		new Command("fumen.save", async () => {
			let path = get(currentProjectPath);

			if (path === null) {
				await commands.executeCommand("fumen.saveas");
				return;
			}

			//let bin = currentFieldNode.get()!.serialize();
			let bin = await getDatabaseAsBinary();
			await writeFile(path, bin);
		}));

	commands.registerCommand(
		new Command("fumen.paste", async () => {
			readText()
				.then(async (text) => {
					if (text != null && text != "") {
						if (text.includes("tinyurl.com")) {
							await invoke("get_redirect_url", {
								url: text,
							}).then((response) => {
								text = response as string;
							});
						}
						fumenPages.set(decoder.decode(text));
						currentOverlayField.set(OverlayFieldType.FumenImport);
					}
				})
				.catch((e) => { });

			readImage()
				.then(async (img) => {
					await setProcessImageMode(img);
				})
				.catch((e) => { });
		}));

	// Command: fumen.undo
	commands.registerCommand(
		new Command("fumen.undo", async () => {
			let currentHistoryObj = null;

			history.update((history: History) => {
				if (
					history.historyIndex !== undefined &&
					history.historyIndex > 0
				) {
					history.historyIndex--;

					currentHistoryObj = history.current.entry.clone();
					const event = new CustomEvent("applyfield", { detail: currentHistoryObj });
					document.dispatchEvent(event);
				}

				return history;
			});
		}));

	// Command: fumen.redo
	commands.registerCommand(
		new Command("fumen.redo", async () => {
			let currentHistoryObj;
			history.update((history: History) => {
				if (
					history.historyIndex !== undefined &&
					history.historyIndex < history.length - 1
				) {
					history.historyIndex += 1;
					//TODO: なぜかjsonオブジェクトになるから注意
					currentHistoryObj = history.current.entry.clone();
					const event = new CustomEvent("applyfield", { detail: currentHistoryObj });
					document.dispatchEvent(event);
				}

				return history;
			})
		}));

	// Command: fumen.copy-as-fumen
	commands.registerCommand(
		new Command("fumen.copy-as-fumen", async () => {
			const pages = [];
			let fieldStr = "";
			for (let y = 0; y < 23; y++) {
				for (let x = 0; x < 10; x++) {
					switch (currentFieldNode.get()!.board[y * 10 + x]) {
						case Tetromino.S:
							fieldStr += "S";
							break;
						case Tetromino.Z:
							fieldStr += "Z";
							break;
						case Tetromino.L:
							fieldStr += "L";
							break;
						case Tetromino.J:
							fieldStr += "J";
							break;
						case Tetromino.T:
							fieldStr += "T";
							break;
						case Tetromino.O:
							fieldStr += "O";
							break;
						case Tetromino.I:
							fieldStr += "I";
							break;
						case Tetromino.Garbage:
							fieldStr += "X";
							break;
						case Tetromino.Empty:
							fieldStr += "_";
							break;
					}
				}
			}

			pages.push({
				field: Field.create(fieldStr),
				comment: "Generated by fumen-rs",
			});

			const str = encoder.encode(pages);
			await writeText(str);
		}));

	// Command: fumen.copy-as-image
	commands.registerCommand(
		new Command("fumen.copy-as-image", async () => {
			getCanvasImage().then(async (image) => {
				if (image === undefined) return;
				const binaryString = atob(image.split(",")[1]);
				const len = binaryString.length;
				const bytes = new Uint8Array(len);
				for (let i = 0; i < len; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}

				const { Image } = await import("@tauri-apps/api/image");
				await writeImage(await Image.fromBytes(bytes));
			});
		}));

}
