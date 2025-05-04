import { TetrisEnv } from "tetris/src/tetris_env";
import { boardViewContent, BoardViewContentType, fieldIndex, fields, history, overlayBoardViewContent, OverrideBoardViewContentType, snapshot } from "../../store.ts";
import { commands, Command } from "../../utils/commands.ts";
import { History } from "../../history.ts";
import { get } from "svelte/store";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readImage, readText, writeImage, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Tetromino } from "tetris/src/tetromino.ts";
import { getCanvasImage } from "../../components/fields/tetrisBoard.svelte";
import { decoder, encoder, Field, type Pages } from "tetris-fumen";
import { emitTo } from "@tauri-apps/api/event";
import { writeFile } from "@tauri-apps/plugin-fs";
import { t } from "../../translations/translations.ts";
import { ImageProcessor } from "../../imageProcessor.ts";
import { Image as TauriImage } from "@tauri-apps/api/image";
import { getCurrentWindow } from "@tauri-apps/api/window";


export let fumenPages: Pages | null = null;
export let fumenImage: HTMLImageElement | null = null;


async function setProcessImageMode(image: TauriImage | HTMLImageElement) {
	if (image instanceof TauriImage) {
		const rgba = await image.rgba();
		const size = await image.size();
		const base64Image = ImageProcessor.createImageFromRGBA(rgba, size);

		const imgElement = new Image();
		imgElement.src = base64Image;
		imgElement.onload = async () => {
			fumenImage = imgElement;
			overlayBoardViewContent.set(
				OverrideBoardViewContentType.ImportImage,
			);
		};
	} else {
		fumenImage = image;
		overlayBoardViewContent.set(
			OverrideBoardViewContentType.ImportImage,
		);
	}
}

export function registerCommands() {

	commands.registerCommand(
		new Command("fumen.new", async (showConfirmDialog: boolean) => {
			if (showConfirmDialog === true) {
				let confirmed = await confirm(get(t)("common.dialog-new-confirm"));
				if (!confirmed) return;
			}

			fields.update((currentFields) => {
				return {
					...currentFields,
					[0]: new TetrisEnv(),
				};
			});

			history.set(new History());
			history.update((history: History) => {
				history.add(
					get(t)("common.history-base"),
					get(fields)[get(fieldIndex)].clone(),
					"",
				);
				return history;
			});
			boardViewContent.set(BoardViewContentType.TetrisEdit);
			snapshot.set([]);
		}));

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
						extensions: ["vtr"],
					},
					{
						name: get(t)("common.dialog-image-files"),
						extensions: ["png", "jpg", "jpeg", "bmp"],
					},
				],
			});

			if (file !== null) {
				let webPath = convertFileSrc(file);
				console.log(webPath);

				if (
					file.endsWith(".png") ||
					file.endsWith(".jpg") ||
					file.endsWith(".jpeg") ||
					file.endsWith(".bmp")
				) {
					const img = new Image();
					img.crossOrigin = "anonymous";
					img.src = webPath;
					img.onload = async () => {
						await setProcessImageMode(img);
					};
				} else if (file.endsWith(".vtr")) {
					const response = await fetch(webPath);
					const blob = await response.blob();
					const arrayBuffer = await blob.arrayBuffer();
					const uint8Array = new Uint8Array(arrayBuffer);
					const env = TetrisEnv.deserialize({
						buffer: uint8Array,
						bufferIndex: 0,
					});

					await commands.executeCommand("fumen.new", false);

					fields.update(() => {
						return [env];
					});

					boardViewContent.set(BoardViewContentType.TetrisEdit);
				} else {
					console.error("Unsupported file type");
				}
			}

		}))

	commands.registerCommand(
		new Command("fumen.save", async () => {
			const path = await save({
				filters: [
					{
						name: "Fumen File",
						extensions: ["vtr"],
					},
				],
				defaultPath: "fumen.vtr",
			});

			if (path !== null) {
				let bin = get(fields)[get(fieldIndex)].serialize();
				await writeFile(path, bin);
			}
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
						fumenPages = decoder.decode(text);
						overlayBoardViewContent.set(
							OverrideBoardViewContentType.ImportFumenText,
						);
					}
				})
				.catch((e) => { });

			readImage()
				.then(async (img) => {
					await setProcessImageMode(img);
				})
				.catch((e) => { });
		}));

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
					emitTo("main", "applyfield", currentHistoryObj);
				}

				return history;
			});
		}));

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
					emitTo("main", "applyfield", currentHistoryObj);
				}

				return history;
			})
		}));

	commands.registerCommand(
		new Command("fumen.copy-as-fumen", async () => {
			const pages = [];
			let fieldStr = "";
			for (let y = 0; y < 23; y++) {
				for (let x = 0; x < 10; x++) {
					switch (get(fields)[get(fieldIndex)].board[y * 10 + x]) {
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
