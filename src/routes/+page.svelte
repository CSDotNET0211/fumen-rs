<script lang="ts">
	// グローバル変数を一番上にまとめる
	import NotificationBar from "../components/notificationBar.svelte";
	import { open, save } from "@tauri-apps/plugin-dialog";
	import { onDestroy, onMount } from "svelte";
	import { get, writable, type Writable } from "svelte/store";
	import {
		readText,
		readImage,
		writeImage,
		writeText,
	} from "@tauri-apps/plugin-clipboard-manager";
	import { decoder, encoder, Field, type Pages } from "tetris-fumen";
	import {
		boardViewContent,
		fields,
		fieldIndex,
		history,
		gameConfig,
		menuItems,
		MenuItem as StoreMenuItem,
		MenuItemType,
		BoardViewContentType,
		overlayBoardViewContent,
		OverrideBoardViewContentType,
		teachableMachineModel,
	} from "../store.ts";
	import { TetrisEnv } from "tetris";
	import { Tetromino } from "tetris/src/tetromino";
	import {
		BaseDirectory,
		exists,
		readTextFile,
		writeFile,
		writeTextFile,
	} from "@tauri-apps/plugin-fs";
	import { History } from "../history.ts";
	import {
		getCanvasImage,
		initializeTetrisBoard,
	} from "../components/field/tetrisBoard.svelte";
	import { emitTo } from "@tauri-apps/api/event";
	import { GameConfig } from "../gameConfig.ts";
	import MenuBar from "../components/menuBar.svelte";
	import { openUrl } from "@tauri-apps/plugin-opener";
	import { convertFileSrc, invoke } from "@tauri-apps/api/core";
	import { ImageProcessor } from "../imageProcessor.ts";
	import { Image as TauriImage } from "@tauri-apps/api/image";
	import { loadTranslations, t } from "../translations/translations.ts";
	import { TeachableMachine } from "../teachableMachine.ts";
	import { exit, relaunch } from "@tauri-apps/plugin-process";
	import {
		executeCommand,
		registerCommand,
		unregisterCommand,
	} from "../utils/commands.ts";
	import {
		getKeyById,
		handleShortcut,
		registerShortcutWithId,
		unregisterShortcutById,
	} from "../utils/shortcuts.ts";

	// グローバル変数
	let fumenPages: Pages | null = null;
	let fumenImage: HTMLImageElement | null = null;
	let rightComponents: Writable<any[]>;
	let leftComponents: Writable<any[]>;
	let fieldComponents: Writable<Map<BoardViewContentType, any>>;
	let currentFieldComponent: any;
	let promise: Promise<void>;
	let splashScreenVisible = true;
	let splashScreenHidden = false;
	let statusText = "Preparing";
	let overrideComponents: Writable<Map<OverrideBoardViewContentType, any>>;
	let currentOverrideComponent: any;
	let showResetOption = false;
	fieldComponents = writable(new Map());
	overrideComponents = writable(new Map());

	setTimeout(() => (showResetOption = true), 5000);
	promise = initializeInSplash().then(() => {
		splashScreenVisible = false;
		setTimeout(() => (splashScreenHidden = true), 300);
	});

	onMount(async () => {
		await promise;

		console.log(
			$t("common.console-warning"),
			"color: red; font-size: 2em;",
		);

		fieldIndex.set(0);

		fields.update((currentFields) => ({
			...currentFields,
			[0]: new TetrisEnv(),
		}));

		window.addEventListener("contextmenu", handleContextMenu);
		window.addEventListener("keydown", handleShortcutInternal);

		const tetrisEdit = (
			await import(`../components/field/tetrisEdit.svelte`)
		).default;
		const tetrisPlay = (
			await import(`../components/field/tetrisPlay.svelte`)
		).default;

		fieldComponents.set(
			new Map([
				[BoardViewContentType.TetrisEdit, tetrisEdit],
				[BoardViewContentType.TetrisPlay, tetrisPlay],
			]),
		);

		const tetrominoSelect = (
			await import(`../components/field/tetrominoSelect.svelte`)
		).default;
		const fumenImportPanel = (
			await import(`../components/field/fumenImportPanel.svelte`)
		).default;
		const preferences = (
			await import(`../components/field/preferences.svelte`)
		).default;
		const gifExportPanel = (
			await import(`../components/field/gifExportPanel.svelte`)
		).default;
		const imageImportPanel = (
			await import(`../components/field/imageImportPanel.svelte`)
		).default;

		overrideComponents.set(
			new Map<OverrideBoardViewContentType, any>([
				[
					OverrideBoardViewContentType.TetrominoSelectHold,
					tetrominoSelect,
				],
				[
					OverrideBoardViewContentType.TetrominoSelectNext,
					tetrominoSelect,
				],
				[
					OverrideBoardViewContentType.ImportFumenText,
					fumenImportPanel,
				],
				[OverrideBoardViewContentType.Preferences, preferences],
				[OverrideBoardViewContentType.GifExport, gifExportPanel],
				[OverrideBoardViewContentType.ImportImage, imageImportPanel],
			]),
		);

		// Set the initial component
		currentFieldComponent = tetrisEdit;

		rightComponents = writable([]);
		leftComponents = writable([]);

		const components = [
			{ name: "tetrisNext", parent: rightComponents },
			{ name: "tetrisBlock", parent: rightComponents },
			{ name: "tetrisSnapshot", parent: rightComponents },
			{ name: "tetrisHold", parent: leftComponents },
			{ name: "tetrisBot", parent: leftComponents },
		];

		for (const { name, parent } of components) {
			await addBuiltinComponent(name, parent);
		}

		history.update((history: History) => {
			history.add(
				$t("common.history-base"),
				get(fields)[get(fieldIndex)].clone(),
				"",
			);
			return history;
		});
	});

	function registerCommands() {
		registerCommand("fumen.new", async () => {
			let confirmed = await confirm($t("common.dialog-new-confirm"));

			if (!confirmed) return;

			fields.update((currentFields) => {
				return {
					...currentFields,
					[0]: new TetrisEnv(),
				};
			});
			history.set(new History());
			history.update((history: History) => {
				history.add(
					$t("common.history-base"),
					get(fields)[get(fieldIndex)].clone(),
					"",
				);
				return history;
			});
			boardViewContent.set(BoardViewContentType.TetrisEdit);
		});
		registerCommand("fumen.open", async () => {
			const file = await open({
				multiple: false,
				directory: false,
				filters: [
					{
						name: $t("common.dialog-all-files"),
						extensions: ["*"],
					},
					{
						name: $t("common.dialog-fumen-files"),
						extensions: ["vtr"],
					},
					{
						name: $t("common.dialog-image-files"),
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

					fields.update((currentFields) => {
						return { ...currentFields, [0]: env };
					});

					history.set(new History());
					history.update((history: History) => {
						history.add(
							$t("common.history-base"),
							get(fields)[get(fieldIndex)].clone(),
							"",
						);
						return history;
					});
					boardViewContent.set(BoardViewContentType.TetrisEdit);
				} else {
					console.error("Unsupported file type");
				}
			}
		});
		registerCommand("fumen.save", async () => {
			const path = await save({
				filters: [
					{
						name: "Fumen File",
						extensions: ["bin"],
					},
				],
				defaultPath: "fumen.bin",
			});

			if (path !== null) {
				let bin = get(fields)[get(fieldIndex)].serialize();
				await writeFile(path, bin);
			}
		});
		registerCommand("fumen.paste", async () => {
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
				.catch((e) => {});

			readImage()
				.then(async (img) => {
					await setProcessImageMode(img);
				})
				.catch((e) => {});
		});
		registerCommand("fumen.undo", () => {
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
		});
		registerCommand("fumen.redo", () => {
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
			});
		});
		registerCommand("fumen.copy-as-fumen", async () => {
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
		});
		registerCommand("fumen.copy-as-image", async () => {
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
		});
	}

	function unregisterCommands() {
		unregisterCommand("fumen.new");
		unregisterCommand("fumen.open");
		unregisterCommand("fumen.save");
		unregisterCommand("fumen.paste");
		unregisterCommand("fumen.undo");
		unregisterCommand("fumen.redo");
		unregisterCommand("fumen.copy-as-fumen");
		unregisterCommand("fumen.copy-as-image");
	}

	function registerShortcuts() {
		registerShortcutWithId("undoShortcut", "z", true, false, false, () => {
			executeCommand("fumen.undo");
		});
		registerShortcutWithId("redoShortcut", "y", true, false, false, () => {
			executeCommand("fumen.redo");
		});
		registerShortcutWithId(
			"playShortcut",
			"F5",
			false,
			false,
			false,
			() => {
				boardViewContent.set(BoardViewContentType.TetrisPlay);
			},
		);
		registerShortcutWithId("editShortcut", "F5", false, true, false, () => {
			boardViewContent.set(BoardViewContentType.TetrisEdit);
		});
		registerShortcutWithId("pasteShortcut", "v", true, false, false, () => {
			executeCommand("fumen.paste");
		});
		registerShortcutWithId("newShortcut", "n", true, false, false, () => {
			executeCommand("fumen.new");
		});
		registerShortcutWithId("openShortcut", "o", true, false, false, () => {
			executeCommand("fumen.open");
		});
		registerShortcutWithId("saveShortcut", "s", true, false, false, () => {
			executeCommand("fumen.save");
		});
		registerShortcutWithId(
			"copyAsFumenShortcut",
			"c",
			true,
			false,
			false,
			() => {
				executeCommand("fumen.copy-as-fumen");
			},
		);
	}

	function unregisterShortcuts() {
		unregisterShortcutById("undoShortcut");
		unregisterShortcutById("redoShortcut");
		unregisterShortcutById("playShortcut");
		unregisterShortcutById("editShortcut");
		unregisterShortcutById("pasteShortcut");
		unregisterShortcutById("newShortcut");
		unregisterShortcutById("openShortcut");
		unregisterShortcutById("saveShortcut");
		unregisterShortcutById("copyAsFumenShortcut");
	}

	onDestroy(() => {
		unregisterCommands();
		unregisterShortcuts();

		window.removeEventListener("keydown", handleShortcutInternal);
		window.removeEventListener("contextmenu", handleContextMenu);
	});

	async function initializeInSplash() {
		statusText = "Loading config files (1/4)";
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

			await writeTextFile("config.json", gameConfig.toJSON(), {
				baseDir: BaseDirectory.Resource,
			});
		}

		let jsonStr = await readTextFile("config.json", {
			baseDir: BaseDirectory.Resource,
		});
		let configJson = GameConfig.fromJSON(jsonStr);

		gameConfig.set(configJson);

		gameConfig.subscribe((config) => {
			writeTextFile("config.json", config!.toJSON(), {
				baseDir: BaseDirectory.Resource,
			});
		});

		console.log(configJson.language);

		statusText = "Loading translations (2/4)";
		await loadTranslations(configJson.language ?? "en", "/");

		statusText = "Loading fumen recognizer (3/4)";
		await initializeTeachableMachine();

		statusText = "Loading the others (4/4)";
		await initializeTetrisBoard();

		registerCommands();
		registerShortcuts();

		menuItems.set([
			new StoreMenuItem(
				MenuItemType.Normal,
				$t("common.menu-file"),
				"",
				() => {},
				[
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-new"),
						getKeyById("newShortcut") ?? "",
						() => {
							executeCommand("fumen.new");
						},
					),
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-open") + "...",
						getKeyById("openShortcut") ?? "",
						() => {
							executeCommand("fumen.open");
						},
					),
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-save") + "...",
						getKeyById("saveShortcut") ?? "",
						() => {
							executeCommand("fumen.save");
						},
					),
					new StoreMenuItem(MenuItemType.Separator, "", "", () => {}),
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-exit"),
						"Alt+F4",
						async () => {
							await exit();
						},
					),
				],
			),
			new StoreMenuItem(
				MenuItemType.Normal,
				$t("common.menu-edit"),
				"",
				() => {},
				[
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-undo"),
						getKeyById("undoShortcut") ?? "",
						() => {
							executeCommand("fumen.undo");
						},
					),
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-redo"),
						getKeyById("redoShortcut") ?? "",
						() => {
							executeCommand("fumen.redo");
						},
					),
					new StoreMenuItem(MenuItemType.Separator, "", "", () => {}),

					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-copy-as-fumen"),
						getKeyById("copyAsFumenShortcut") ?? "",
						() => {
							executeCommand("fumen.copy-as-fumen");
						},
					),
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-copy-as-image"),
						getKeyById("copyAsImageShortcut") ?? "",
						() => {
							executeCommand("fumen.copy-as-image");
						},
					),
					/*new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-copy-as-gif"),
						"",
						() => {
							overrideBoardViewContent.set(
								OverrideBoardViewContentType.GifExport,
							);
						},
					),*/
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-paste"),
						getKeyById("pasteShortcut") ?? "",
						() => {
							executeCommand("fumen.paste");
						},
					),
					new StoreMenuItem(MenuItemType.Separator, "", "", () => {}),
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-preferences"),
						"",
						() =>
							overlayBoardViewContent.set(
								OverrideBoardViewContentType.Preferences,
							),
					),
				],
			),
			new StoreMenuItem(
				MenuItemType.Normal,
				$t("common.menu-run"),
				"",
				() => {},
				[
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-start"),
						getKeyById("playShortcut") ?? "",
						() =>
							boardViewContent.set(
								BoardViewContentType.TetrisPlay,
							),
					),
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-stop"),
						getKeyById("editShortcut") ?? "",
						() =>
							boardViewContent.set(
								BoardViewContentType.TetrisEdit,
							),
					),
				],
			),
			new StoreMenuItem(
				MenuItemType.Normal,
				$t("common.menu-help"),
				"",
				() => {},
				[
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-join-discord"),
						"",
						() => openUrl("https://discord.gg/F958vMFfcV"),
					),
					new StoreMenuItem(
						MenuItemType.Normal,
						$t("common.menu-support-me-on-ko-fi"),
						"",
						() => openUrl("https://ko-fi.com/csdotnet"),
					),
				],
			),
		]);

		statusText = "Done";
	}

	async function initializeTeachableMachine() {
		const URL = get(gameConfig)?.fumenImageRecognitionModelURL;
		const metadata = URL + "metadata.json";
		const model = URL + "model.json";

		const teachableMachine = new TeachableMachine(model, metadata);
		await teachableMachine.init();
		teachableMachineModel.set(teachableMachine);
	}

	function handleShortcutInternal(event: KeyboardEvent) {
		if (event.ctrlKey && event.key === "f") {
			event.preventDefault();
			return;
		}

		handleShortcut(event);
	}

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

	async function addBuiltinComponent(name: string, parent: Writable<any[]>) {
		const component = (
			await import(`../components/buildinPanels/${name}.svelte`)
		).default;
		parent.update((currentComponents) => {
			return [...currentComponents, component];
		});
	}

	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
	}

	$: {
		const components = get(fieldComponents);
		currentFieldComponent = components.get($boardViewContent) || null;
	}

	$: {
		const components = get(overrideComponents);
		currentOverrideComponent =
			components.get($overlayBoardViewContent) || null;
	}
</script>

<main
	id="splash-screen"
	style="z-index: 1000;"
	class:hidden={!splashScreenVisible}
	class:display-none={splashScreenHidden}
	data-tauri-drag-region
>
	<div style="text-align: center; margin-top: 20vh;" data-tauri-drag-region>
		<img
			src="128x128.png"
			alt="App Logo"
			style="width: 150px; height: auto; margin-bottom: 20px;"
		/>
		<h1 data-tauri-drag-region style="font-size: 2.5em; margin: 0;">
			fumen-rs
		</h1>
		<p
			data-tauri-drag-region
			style="font-size: 0.9em; color: #aaa; margin-bottom: 0px;"
		>
			version 0.1.0
		</p>
		<p
			data-tauri-drag-region
			style="font-size: 0.8em;margin-top: 0px; color: #888;"
		>
			by CSDotNET
		</p>
		<p
			data-tauri-drag-region
			style="margin-top: 20px; font-size: 0.9em; color: #aaa;"
		>
			{statusText}
		</p>
		{#if showResetOption}
			<!-- svelte-ignore a11y_invalid_attribute -->
			<a
				href="#"
				style="display: block; margin-top: 10px; font-size: 0.8em; color: #00aaff; text-decoration: underline;"
				on:click={async () => {
					await invoke("delete_config_file_if_available");
					await relaunch();
				}}
			>
				Still loading? Reset the configuration file.
			</a>
		{/if}
	</div>
</main>
{#await promise then _}
	<main>
		<MenuBar></MenuBar>

		<div id="main-container">
			<div class="side_panel">
				{#each $leftComponents as Component}
					<div>
						<Component></Component>
					</div>
				{/each}
			</div>

			<div style="flex:1;position:relative;" id="main_panel">
				<!-- Board Override -->
				{#if currentOverrideComponent}
					<svelte:component
						this={currentOverrideComponent}
						{...$overlayBoardViewContent ===
						OverrideBoardViewContentType.ImportFumenText
							? { fumenPages }
							: $overlayBoardViewContent ===
								  OverrideBoardViewContentType.ImportImage
								? { fumenImage }
								: {}}
					></svelte:component>
				{/if}

				<!-- Dynamic Board -->
				{#if currentFieldComponent}
					<svelte:component this={currentFieldComponent}
					></svelte:component>
				{/if}

				<div id="cursors"></div>
			</div>
			<div class="side_panel">
				{#each $rightComponents as Component}
					<div>
						<Component></Component>
					</div>
				{/each}
			</div>
		</div>
		<NotificationBar></NotificationBar>
	</main>
{/await}

<style>
	@font-face {
		font-family: "Inter";
		src: url("../assets/fonts/inter.ttf") format("ttf");
	}

	#splash-screen {
		background-color: #1c1c1c;
	}

	.side_panel {
		background-color: #2f2f2f;
		width: 110px;
		border-left: 1px solid #3e3e3e;
	}

	:root {
		user-select: none;
		-webkit-user-drag: none;
		font-family: Inter, sans-serif;
		font-size: 16px;
		line-height: 24px;
		font-weight: 400;

		color: #f6f6f6;
		background-color: #1c1c1c;

		font-synthesis: none;
		text-rendering: optimizeLegibility;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		-webkit-text-size-adjust: 100%;
		cursor: url("src/assets/images/cursor.svg");

		overflow: hidden;
	}

	main {
		position: absolute;
		left: 0;
		top: 0;
		padding: 0;
		width: 100vw;
		height: 100vh;
		margin: 0;

		display: flex;
		flex-direction: column;
	}

	#main-container {
		width: 100%;
		height: calc(100% - 20px - 30px - 5px);
		display: flex;
		border-top: 1px solid #3e3e3e;
		border-bottom: 1px solid #3e3e3e;
		box-sizing: border-box;
	}

	#cursors {
		width: 100%;
		height: 100%;
	}

	.hidden {
		opacity: 0;
		transition: opacity 0.3s ease-in-out;
	}

	.display-none {
		display: none;
	}
</style>
