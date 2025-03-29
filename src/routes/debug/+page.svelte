<script lang="ts">
	import { Chart, registerables } from "chart.js";
	import { onDestroy, onMount } from "svelte";
	import { ImageProcessor } from "../../imageProcessor";
	import { open } from "@tauri-apps/plugin-dialog";
	import { Rectangle } from "pixi.js";

	Chart.register(...registerables);

	let imageSrc: string | null = null;
	let chart: Chart | null = null;
	let chartS: Chart | null = null;
	let chartV: Chart | null = null;
	let compressionFactor = 5;
	let sampleSize: number = 10;
	let imageList: { type: string; class: string; path: string }[] = [];

	const datasetColors = [
		"black",
		"gray",
		"cyan",
		"blue",
		"orange",
		"yellow",
		"green",
		"purple",
		"red",
	];

	async function handleFileInput(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];
			const img = new Image();
			img.src = URL.createObjectURL(file);
			await img.decode();

			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d")!;
			canvas.width = img.width;
			canvas.height = img.height;
			ctx.drawImage(img, 0, 0);

			const imageData = ctx.getImageData(
				0,
				0,
				canvas.width,
				canvas.height,
			);
			const chunks = ImageProcessor.getBlockChunks(
				canvas.width,
				canvas.height,
			).map((chunk) => ImageProcessor.shrinkChunk(chunk));

			const hueCounts = Array(360).fill(0);
			const saturationCounts = Array(100).fill(0);
			const valueCounts = Array(360).fill(0);

			for (const chunk of chunks) {
				const chunkData = ImageProcessor.getImageDataFromChunk(
					imageData,
					chunk,
				);
				const chunkCanvas = document.createElement("canvas");
				chunkCanvas.width = chunk.width;
				chunkCanvas.height = chunk.height;
				const chunkCtx = chunkCanvas.getContext("2d")!;
				chunkCtx.putImageData(chunkData, 0, 0);

				const chunkImageData = chunkCtx.getImageData(
					0,
					0,
					chunkCanvas.width,
					chunkCanvas.height,
				);

				for (let i = 0; i < chunkImageData.data.length; i += 4) {
					const r = chunkImageData.data[i];
					const g = chunkImageData.data[i + 1];
					const b = chunkImageData.data[i + 2];
					const { h, s, v } = ImageProcessor.convertToHsv(r, g, b);
					hueCounts[Math.floor(h)]++;
					saturationCounts[Math.floor(s)]++;
					valueCounts[Math.floor(v)]++;
				}
			}

			const compressedHueCounts = compressData(
				hueCounts,
				compressionFactor * 2,
			);
			const compressedSaturationCounts = compressData(
				saturationCounts,
				compressionFactor,
			);
			const compressedValueCounts = compressData(
				valueCounts,
				compressionFactor,
			);

			resetCharts();
			renderChart("myChart", "Hue Counts", compressedHueCounts);
			renderChart(
				"myChartS",
				"Saturation Counts",
				compressedSaturationCounts,
			);
			renderChart("myChartV", "Value Counts", compressedValueCounts);
		}
	}

	async function handleNewFileInput(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];
			const img = new Image();
			img.src = URL.createObjectURL(file);
			await img.decode();

			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d")!;
			canvas.width = img.width;
			canvas.height = img.height;
			ctx.drawImage(img, 0, 0);

			const imageData = ctx.getImageData(
				0,
				0,
				canvas.width,
				canvas.height,
			);
			const chunks = ImageProcessor.getBlockChunks(
				canvas.width,
				canvas.height,
			).map((chunk) => ImageProcessor.shrinkChunk(chunk));

			const hueCounts = Array(360).fill(0);
			const saturationCounts = Array(100).fill(0);
			const valueCounts = Array(360).fill(0);

			for (const chunk of chunks) {
				const chunkData = ImageProcessor.getImageDataFromChunk(
					imageData,
					chunk,
				);
				const chunkCanvas = document.createElement("canvas");
				chunkCanvas.width = chunk.width;
				chunkCanvas.height = chunk.height;
				const chunkCtx = chunkCanvas.getContext("2d")!;
				chunkCtx.putImageData(chunkData, 0, 0);

				const chunkImageData = chunkCtx.getImageData(
					0,
					0,
					chunkCanvas.width,
					chunkCanvas.height,
				);

				for (let i = 0; i < chunkImageData.data.length; i += 4) {
					const r = chunkImageData.data[i];
					const g = chunkImageData.data[i + 1];
					const b = chunkImageData.data[i + 2];
					const { h, s, v } = ImageProcessor.convertToHsv(r, g, b);
					hueCounts[Math.floor(h)]++;
					saturationCounts[Math.floor(s)]++;
					valueCounts[Math.floor(v)]++;
				}
			}

			const compressedHueCounts = compressData(
				hueCounts,
				compressionFactor * 2,
			);
			const compressedSaturationCounts = compressData(
				saturationCounts,
				compressionFactor,
			);
			const compressedValueCounts = compressData(
				valueCounts,
				compressionFactor,
			);

			resetCharts();
			renderChart("newChart", "Hue Counts (New)", compressedHueCounts);
			renderChart(
				"newChartS",
				"Saturation Counts (New)",
				compressedSaturationCounts,
			);
			renderChart(
				"newChartV",
				"Value Counts (New)",
				compressedValueCounts,
			);
		}
	}

	function compressData(data: number[], factor: number): number[] {
		const compressed = [];
		for (let i = 0; i < data.length; i += factor) {
			const sum = data
				.slice(i, i + factor)
				.reduce((acc, val) => acc + val, 0);
			compressed.push(sum);
		}
		return compressed;
	}

	function resetCharts() {
		if (chart) chart.destroy();
		if (chartS) chartS.destroy();
		if (chartV) chartV.destroy();
		chart = null;
		chartS = null;
		chartV = null;
	}

	function renderChart(canvasId: string, label: string, data: number[]) {
		const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
		const labels = Array.from({ length: data.length }, (_, i) =>
			(i * compressionFactor + 1).toString(),
		);
		console.log(labels);

		let targetChart: Chart | null = null;
		if (canvasId === "myChart") targetChart = chart;
		if (canvasId === "myChartS") targetChart = chartS;
		if (canvasId === "myChartV") targetChart = chartV;

		if (!targetChart) {
			const newChart = new Chart(ctx, {
				type: "line",
				data: {
					labels,
					datasets: [
						{
							label,
							data,
							borderWidth: 1,
							borderColor: datasetColors[0],
							backgroundColor: datasetColors[0],
						},
					],
				},
				options: {
					scales: {
						y: {
							beginAtZero: true,
						},
					},
				},
			});

			if (canvasId === "myChart") chart = newChart;
			if (canvasId === "myChartS") chartS = newChart;
			if (canvasId === "myChartV") chartV = newChart;
		} else {
			const colorIndex =
				targetChart.data.datasets.length % datasetColors.length;
			targetChart.data.datasets.push({
				label,
				data,
				borderWidth: 1,
				borderColor: datasetColors[colorIndex],
				backgroundColor: datasetColors[colorIndex],
			});
			targetChart.update();
		}
	}
	/*
	async function generateData() {
		const selectedFolder = await open({
			directory: true,
		});

		if (selectedFolder && typeof selectedFolder === "string") {
			imageList = [];

			const typeFolders = await readDir(selectedFolder, {
				dir: BaseDirectory.App,
			});

			for (const typeFolder of typeFolders) {
				if (typeFolder.children) {
					const type = typeFolder.name!;
					for (const classFolder of typeFolder.children) {
						if (classFolder.children) {
							const className = classFolder.name!;
							for (const file of classFolder.children) {
								if (
									file.name?.match(/\.(jpg|jpeg|png|bmp)$/i)
								) {
									imageList.push({
										type,
										class: className,
										path: file.path,
									});
								}
							}
						}
					}
				}
			}
			console.log("Image List:", imageList);
		}
	}*/

	onMount(() => {});

	onDestroy(() => {
		if (chart) chart.destroy();
		if (chartS) chartS.destroy();
		if (chartV) chartV.destroy();
	});
</script>

<!-- svelte-ignore a11y_missing_attribute -->
<div id="container">
	<input type="file" accept="image/*" on:change={handleFileInput} />
	<button on:click={resetCharts} style="margin-top: 1rem;"
		>Reset Charts</button
	>
	{#if imageSrc}
		<img src={imageSrc} style="max-width: 100%; margin-top: 1rem;" />
	{/if}
	<canvas id="myChart" style="margin-top: 1rem;"></canvas>
	<canvas id="myChartS" style="margin-top: 1rem;"></canvas>
	<canvas id="myChartV" style="margin-top: 1rem;"></canvas>
	<div style="margin-top: 1rem;">
		<label for="sampleSize">Sample Size:</label>
		<input
			id="sampleSize"
			type="number"
			bind:value={sampleSize}
			min="1"
			style="margin-left: 0.5rem;"
		/>
		<!--	<button on:click={generateData} style="margin-left: 1rem;">
			Generate Data
		</button>-->
	</div>
	<input
		type="file"
		accept="image/*"
		on:change={handleNewFileInput}
		style="margin-top: 1rem;"
	/>
	<canvas id="newChart" style="margin-top: 1rem;"></canvas>
	<canvas id="newChartS" style="margin-top: 1rem;"></canvas>
	<canvas id="newChartV" style="margin-top: 1rem;"></canvas>
</div>
