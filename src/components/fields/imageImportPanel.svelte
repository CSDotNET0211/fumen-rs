<script lang="ts">
	import {
		Application,
		Assets,
		Container,
		Rectangle,
		Sprite,
		Texture,
	} from "pixi.js";
	import { onDestroy, onMount } from "svelte";
	import {
		drawTetrisFieldBg,
		initializeBoard,
		initializeCells,
		initializePixijs,
		type CellSprite,
	} from "./tetrisBoard.svelte";
	import { Tetromino } from "tetris/src/tetromino";
	import {
		fieldIndex,
		fields,
		overlayBoardViewContent,
		OverrideBoardViewContentType,
		teachableMachineModel,
	} from "../../store";
	import { get } from "svelte/store";
	import { BaseDirectory, writeFile } from "@tauri-apps/plugin-fs";
	import { ImageProcessor } from "../../imageProcessor";
	import { HEIGHT, WIDTH, type TetrisEnv } from "tetris";
	import { TeachableMachine } from "../../teachableMachine";
	import { t } from "../../translations/translations.ts";

	export let fumenImage: HTMLImageElement | null;

	let isDragging = false;
	let startX = 0;
	let startY = 0;
	let offsetX = 0;
	let offsetY = 0;

	let app: Application;
	let boardSprites: CellSprite[];
	let boardContainer: Container;
	let loadedImage: Sprite;
	let bgImage: Sprite;

	let isLoading = false;
	let showDebugButton = false;

	function toggleDebugButton() {
		showDebugButton = !showDebugButton;
	}

	async function debugOutput() {
		const image = await app?.renderer.extract.image({
			target: app.stage,
			frame: new Rectangle(0, 0, app.renderer.width, app.renderer.height),
		});

		const canvas = document.createElement("canvas");
		canvas.width = image.width;
		canvas.height = image.height;
		const ctx = canvas.getContext("2d");
		ctx!.drawImage(image, 0, 0);

		const imageData = ctx!.getImageData(0, 0, image.width, image.height);
		const chunks = ImageProcessor.getBlockChunks(
			image.width,
			image.height,
		).map((chunk) => ImageProcessor.shrinkChunk(chunk));

		const chunkDataArray = [];

		for (const chunk of chunks) {
			const chunkData = ImageProcessor.getImageDataFromChunk(
				imageData,
				chunk,
			);
			chunkDataArray.push(new Uint8Array(chunkData.data.buffer));
		}

		saveChunkImages(chunkDataArray, {
			width: chunks[0].width,
			height: chunks[0].height,
		});
	}

	async function debugProcess() {}

	onMount(async () => {
		app = new Application();
		boardSprites = [];
		boardContainer = new Container();

		let texture = await Assets.load(fumenImage!);
		loadedImage = new Sprite(texture);

		app.stage.cursor = "grab";
		app.stage.eventMode = "static";
		app.stage.on("pointerdown", (e) => {
			isDragging = true;
			startX = e.data.global.x;
			startY = e.data.global.y;
			app.stage.cursor = "grabbing";
		});
		app.stage.on("pointerup", () => {
			isDragging = false;
			app.stage.cursor = "grab";
		});
		app.stage.on("pointerupoutside", () => {
			isDragging = false;
			app.stage.cursor = "grab";
		});
		app.stage.on("pointermove", (e) => {
			if (isDragging) {
				offsetX = e.data.global.x - startX;
				offsetY = e.data.global.y - startY;
				loadedImage.x += offsetX;
				loadedImage.y += offsetY;
				startX = e.data.global.x;
				startY = e.data.global.y;
			}
		});
		app.stage.on("wheel", (e) => {
			e.preventDefault();
			const zoomFactor = 1.01;

			if (e.deltaY < 0) {
				loadedImage.scale.x *= zoomFactor;
				loadedImage.scale.y *= zoomFactor;
			} else {
				loadedImage.scale.x /= zoomFactor;
				loadedImage.scale.y /= zoomFactor;
			}
		});

		await initializePixijs(
			app,
			document.getElementById("canvasParent") as HTMLCanvasElement,
		);

		const canvasWidth = app.canvas.width;
		const canvasHeight = app.canvas.height;
		if (loadedImage.width < canvasWidth) {
			const scaleFactor = canvasWidth / loadedImage.width;
			loadedImage.scale.set(scaleFactor, scaleFactor);
		}

		loadedImage.anchor.x = 0.5;
		loadedImage.anchor.y = 0.5;

		loadedImage.x = loadedImage.width / 2;
		loadedImage.y =
			loadedImage.height / 2 + (canvasHeight - loadedImage.height);

		app.stage.addChild(loadedImage);

		bgImage = drawTetrisFieldBg(app, 1, 0);
		boardContainer.addChild(bgImage);

		app.stage.addChild(boardContainer);

		initializeCells(boardContainer, boardSprites);

		boardSprites.forEach((sprite) => {
			sprite.eventMode = "none";
		});
	});

	onDestroy(() => {
		boardSprites = [];
		app.destroy();
	});

	async function saveChunkImages(
		chunks: Uint8Array[],
		size: { width: number; height: number },
	) {
		for (let i = 0; i < chunks.length; i++) {
			const base64Chunk = ImageProcessor.createImageFromRGBA(
				chunks[i],
				size,
				{
					width: 10,
					height: 10,
				},
			);
			const binaryString = atob(base64Chunk.split(",")[1]);
			const len = binaryString.length;
			const bytes = new Uint8Array(len);
			for (let j = 0; j < len; j++) {
				bytes[j] = binaryString.charCodeAt(j);
			}
			await writeFile(`test/chunk_${i}.png`, bytes, {
				baseDir: BaseDirectory.Resource,
			});
		}
	}

	function closePanel() {
		overlayBoardViewContent.set(OverrideBoardViewContentType.None);
	}

	function resetImage() {
		loadedImage.scale.set(1, 1);

		const canvasWidth = app.canvas.width;
		const canvasHeight = app.canvas.height;
		if (loadedImage.width < canvasWidth) {
			const scaleFactor = canvasWidth / loadedImage.width;
			loadedImage.scale.set(scaleFactor, scaleFactor);
		}

		loadedImage.anchor.x = 0.5;
		loadedImage.anchor.y = 0.5;

		loadedImage.x = loadedImage.width / 2;
		loadedImage.y =
			loadedImage.height / 2 + (canvasHeight - loadedImage.height);
	}

	async function applySelectedPage() {
		isLoading = true;
		let predictionFailed = false;

		const image = await app?.renderer.extract.image({
			target: app.stage,
			frame: new Rectangle(0, 0, app.renderer.width, app.renderer.height),
		});

		const canvas = document.createElement("canvas");
		canvas.width = image.width;
		canvas.height = image.height;
		const ctx = canvas.getContext("2d");
		ctx!.drawImage(image, 0, 0);

		const imageData = ctx!.getImageData(0, 0, image.width, image.height);
		const chunks = ImageProcessor.getBlockChunks(
			image.width,
			image.height,
		).map((chunk) => ImageProcessor.shrinkChunk(chunk));

		const chunkDataArray = [];

		for (const chunk of chunks) {
			const chunkData = ImageProcessor.getImageDataFromChunk(
				imageData,
				chunk,
			);
			chunkDataArray.push(new Uint8Array(chunkData.data.buffer));
		}

		const predictions: string[] = [];

		for (let i = 0; i < WIDTH * HEIGHT - chunkDataArray.length; i++) {
			predictions.push("empty");
		}

		console.log("start prediction");
		for (const chunkData of chunkDataArray) {
			const base64Chunk = ImageProcessor.createImageFromRGBA(
				chunkData,
				{
					width: chunks[0].width,
					height: chunks[0].height,
				},
				{
					width: 10,
					height: 10,
				},
			);
			try {
				const img = new Image();
				img.src = base64Chunk;
				await img.decode();
				const prediction = await get(teachableMachineModel)!.predict(
					img,
				);
				predictions.push(prediction);
			} catch (error) {
				predictions.push("empty");
				continue;
			}
		}

		if (predictionFailed) {
			return;
		}

		fields.update((tetris_fields: TetrisEnv[]) => {
			const field = tetris_fields[get(fieldIndex)].board;
			for (let i = 0; i < predictions.length; i++) {
				const prediction = predictions[i].toLowerCase();
				switch (prediction) {
					case "empty":
						field[i] = Tetromino.Empty;
						break;
					case "i":
						field[i] = Tetromino.I;
						break;
					case "l":
						field[i] = Tetromino.L;
						break;
					case "o":
						field[i] = Tetromino.O;
						break;
					case "z":
						field[i] = Tetromino.Z;
						break;
					case "t":
						field[i] = Tetromino.T;
						break;
					case "j":
						field[i] = Tetromino.J;
						break;
					case "s":
						field[i] = Tetromino.S;
						break;
					case "garbage":
						field[i] = Tetromino.Garbage;
						break;
					default:
						console.error("Invalid prediction");
						break;
				}
			}

			for (let i = predictions.length; i < WIDTH * HEIGHT; i++) {
				field[i] = Tetromino.Empty;
			}
			tetris_fields[get(fieldIndex)].board = field;
			return tetris_fields;
		});

		overlayBoardViewContent.set(OverrideBoardViewContentType.None);

		isLoading = false;
		//	if (predictionFailed) {
		//		// Show failure message
		//		document.getElementById("#howto")!.innerText = $t(
		//			"common.image-import-panel-process-failed",
		//		);
		//	}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div
	id="container"
	tabindex="-1"
	onmouseenter={(e) => e.stopPropagation()}
	onmouseup={(e) => e.stopPropagation()}
	onmousedown={(e) => e.stopPropagation()}
	onmouseout={(e) => e.stopPropagation()}
>
	<div id="canvasParent" tabindex="-1"></div>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="import-panel">
		<h2>{$t("common.image-import-panel-import-fumen")}</h2>

		{#if !isLoading}
			<div class="overlay-container">
				<div id="howto">
					{$t("common.image-import-panel-howto")}
				</div>
				<div class="button-container">
					<button
						tabindex="-1"
						class="secondary-button small-button"
						onclick={closePanel}
						>{$t("common.image-import-panel-cancel")}</button
					>
					<button
						tabindex="-1"
						class="secondary-button small-button"
						onclick={resetImage}
						>{$t("common.image-import-panel-reset")}</button
					>
					<button
						tabindex="-1"
						class="small-button"
						onclick={applySelectedPage}
						>{$t("common.image-import-panel-apply")}</button
					>
				</div>
			</div>
		{/if}
	</div>
	{#if isLoading}
		<div class="loading-overlay">
			<img src="loading.gif" alt="Loading..." />
			<p>{$t("common.image-import-panel-processing")}...</p>
		</div>
	{/if}
	{#if showDebugButton}
		<button
			tabindex="-1"
			class="debug-button"
			onclick={debugOutput}
			style="position: absolute; bottom: 50px; left: 10px;"
		>
			Debug Output
		</button>
	{/if}
	<!-- svelte-ignore a11y_consider_explicit_label -->
	<button
		tabindex="-1"
		class="transparent-button"
		onclick={toggleDebugButton}
		style="position: absolute; bottom: 10px; left: 10px; opacity: 0.5;"
	>
		&nbsp;
	</button>
</div>

<style>
	#container {
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		background-color: #1c1c1c;
		pointer-events: all;
	}

	#canvasParent {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}

	.import-panel {
		height: 100%;
		width: 100%;
		border-radius: 10px;
		text-align: center;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	button {
		margin-top: 8px;
		border: none;
		border-radius: 2px;
		background-color: #1c7ad2;
		color: #ffffff;
		cursor: pointer;
		width: 55px;
	}
	button:hover {
		background-color: #1a70bf;
	}

	.secondary-button {
		background-color: #2b2b2b;
	}
	.secondary-button:hover {
		background-color: #353535;
	}
	.small-button {
		padding: 5px 10px;
		font-size: 12px;
		pointer-events: all;
	}
	.loading-overlay {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background-color: rgba(0, 0, 0, 0.8);
		color: #cbcbcb;
		text-align: center;
		padding: 20px;
		border-radius: 10px;
		z-index: 1000;
		pointer-events: none;
	}
	.loading-overlay img {
		width: 50px;
		height: 50px;
	}

	#howto {
		text-align: center;
		pointer-events: none;
	}

	.transparent-button {
		width: 30px;
		height: 30px;
		background-color: transparent;
		border: none;
		cursor: pointer;
	}

	.transparent-button:hover {
		background-color: transparent;
	}

	.debug-button {
		padding: 5px 10px;
		background-color: #ff5722;
		color: #cbcbcb;
		border: none;
		border-radius: 3px;
		cursor: pointer;
	}
	.debug-button:hover {
		background-color: #e64a19;
	}

	.overlay-container {
		padding: 8px;
		background-color: #00000095;
		position: absolute;
		top: 45%;
		width: 200px;
		pointer-events: none;
	}

	.button-container {
		display: flex;
		gap: 5px;
		justify-content: center;
	}
</style>
