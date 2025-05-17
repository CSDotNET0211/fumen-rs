<script lang="ts">
  import { Chart, registerables } from "chart.js";
  import { onDestroy, onMount } from "svelte";
  import { ImageProcessor } from "../../imageProcessor";
  import { open } from "@tauri-apps/plugin-dialog";
  import { Rectangle } from "pixi.js";
  import { convertFileSrc } from "@tauri-apps/api/core";

  Chart.register(...registerables);

  let imageSrc: string | null = null;
  let chart: Chart | null = null;
  let chartS: Chart | null = null;
  let chartV: Chart | null = null;
  const compressionFactor = 5;
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

  let trainingStatus: string = "";
  let isTraining: boolean = false;
  let isTesting: boolean = false;

  // 仮の画像パスリスト（本来は所定の場所から取得する）
  let trainingImagePaths: string[] = [];

  let hsPairs: [number, number][] = []; // h, s
  let hsPairsColor: string[] = []; // indexで対応する色(rgb)

  // 画像ファイル選択時の処理
  async function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    // ファイルが選択されているか確認
    if (input.files && input.files[0]) {
      const file = input.files[0];
      // 画像を読み込む
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();

      // Canvasに画像を描画
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // 画像データを取得
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // 画像をチャンク（小領域）に分割し、さらに縮小
      const chunks = ImageProcessor.getBlockChunks(
        canvas.width,
        canvas.height
      ).map((chunk) => ImageProcessor.shrinkChunk(chunk));

      // HSVごとのカウント配列を初期化
      const hueCounts = Array(360).fill(0);
      const saturationCounts = Array(100).fill(0);
      const valueCounts = Array(360).fill(0);

      //チャンクごとに平均の色を出して、
      // h(sin)・sの2次元のデータをセットで作り、分類する
      //分類されたやつグループごとに平均を出し、nnでゲームを推論

      hsPairs = [];
      hsPairsColor = [];

      for (const chunk of chunks) {
        const chunkData = ImageProcessor.getImageDataFromChunk(
          imageData,
          chunk
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
          chunkCanvas.height
        );

        let totalR = 0,
          totalG = 0,
          totalB = 0,
          pixelCount = 0;

        for (let i = 0; i < chunkImageData.data.length; i += 4) {
          const r = chunkImageData.data[i];
          const g = chunkImageData.data[i + 1];
          const b = chunkImageData.data[i + 2];
          totalR += r;
          totalG += g;
          totalB += b;
          pixelCount++;
        }

        if (pixelCount > 0) {
          const avgR = totalR / pixelCount;
          const avgG = totalG / pixelCount;
          const avgB = totalB / pixelCount;

          // RGBからHSVに変換
          const { h, s, v } = ImageProcessor.convertToHsv(avgR, avgG, avgB);

          // h, sを配列としてまとめて配列に追加
          hsPairs.push([h, s]);
          // 色をrgb文字列で格納
          hsPairsColor.push(
            `rgb(${Math.round(avgR)},${Math.round(avgG)},${Math.round(avgB)})`
          );

          // hをsinに変換して新しい配列に格納
          const hSin = Math.sin((h * Math.PI) / 180); // hをラジアンに変換してsinを計算
          hueCounts.push(hSin);
          saturationCounts.push(s);
          valueCounts.push(v);
        }
      }

      console.log("HS Pairs:", hsPairs); // 確認用

      // データを圧縮（チャート描画用にまとめる）
      const compressedHueCounts = compressData(
        hueCounts,
        compressionFactor * 2
      );
      const compressedSaturationCounts = compressData(
        saturationCounts,
        compressionFactor
      );
      const compressedValueCounts = compressData(
        valueCounts,
        compressionFactor
      );

      // チャートをリセットして再描画
      resetCharts();
      renderChart("myChart", "Hue Counts", compressedHueCounts);
      renderChart("myChartS", "Saturation Counts", compressedSaturationCounts);
      renderChart("myChartV", "Value Counts", compressedValueCounts);
      renderChart("hsScatter", "HS Scatter", hsPairs, "scatter"); // scatter追加
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

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const chunks = ImageProcessor.getBlockChunks(
        canvas.width,
        canvas.height
      ).map((chunk) => ImageProcessor.shrinkChunk(chunk));

      const hueCounts = Array(360).fill(0);
      const saturationCounts = Array(100).fill(0);
      const valueCounts = Array(360).fill(0);

      for (const chunk of chunks) {
        const chunkData = ImageProcessor.getImageDataFromChunk(
          imageData,
          chunk
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
          chunkCanvas.height
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
        compressionFactor * 2
      );
      const compressedSaturationCounts = compressData(
        saturationCounts,
        compressionFactor
      );
      const compressedValueCounts = compressData(
        valueCounts,
        compressionFactor
      );

      resetCharts();
      renderChart("newChart", "Hue Counts (New)", compressedHueCounts);
      renderChart(
        "newChartS",
        "Saturation Counts (New)",
        compressedSaturationCounts
      );
      renderChart("newChartV", "Value Counts (New)", compressedValueCounts);
    }
  }

  async function startTraining() {
    isTraining = true;
    trainingStatus = "学習を開始します...";

    const selectedFolders = await open({
      directory: true,
      multiple: true,
    });

    if (!selectedFolders || !Array.isArray(selectedFolders)) {
      trainingStatus = "フォルダが選択されていません";
      isTraining = false;
      return;
    }

    const trainingData = await loadTrainingData(selectedFolders);

    for (let i = 0; i < trainingData.length; i++) {
      const { path, labels } = trainingData[i];
      trainingStatus = `画像 ${i + 1} / ${trainingData.length} を処理中...`;

      const { compressedHueCounts, compressedSaturationCounts } =
        await processImage(path);

      // TODO: 学習データとしてcompressedHueCountsとcompressedSaturationCountsを利用する処理を追加
      // await trainModelWithData(compressedHueCounts, compressedSaturationCounts, label);
    }

    trainingStatus = "学習完了";
    isTraining = false;
  }

  async function loadTrainingData(folders: string[]): Promise<any[]> {
    const trainingData = [];

    for (const folder of folders) {
      try {
        const response = await fetch(convertFileSrc(`${folder}/data.json`));
        const data = await response.json();

        if (Array.isArray(data)) {
          trainingData.push(
            ...data.map((item) => ({
              path: `${folder}/${item.name}`,
              labels: item.labels,
            }))
          );
        }
      } catch (error) {
        console.error(`Failed to load data.json from ${folder}:`, error);
      }
    }

    return trainingData;
  }

  async function processImage(path: string) {
    const img = new Image();
    img.src = convertFileSrc(path);
    await img.decode();

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const chunks = ImageProcessor.getBlockChunks(
      canvas.width,
      canvas.height
    ).map((chunk) => ImageProcessor.shrinkChunk(chunk));

    const hueCounts = Array(360).fill(0);
    const saturationCounts = Array(100).fill(0);

    for (const chunk of chunks) {
      const chunkData = ImageProcessor.getImageDataFromChunk(imageData, chunk);
      const chunkCanvas = document.createElement("canvas");
      chunkCanvas.width = chunk.width;
      chunkCanvas.height = chunk.height;
      const chunkCtx = chunkCanvas.getContext("2d")!;
      chunkCtx.putImageData(chunkData, 0, 0);

      const chunkImageData = chunkCtx.getImageData(
        0,
        0,
        chunkCanvas.width,
        chunkCanvas.height
      );

      for (let i = 0; i < chunkImageData.data.length; i += 4) {
        const r = chunkImageData.data[i];
        const g = chunkImageData.data[i + 1];
        const b = chunkImageData.data[i + 2];
        const { h, s } = ImageProcessor.convertToHsv(r, g, b);
        hueCounts[Math.floor(h)]++;
        saturationCounts[Math.floor(s)]++;
      }
    }

    const compressedHueCounts = compressData(hueCounts, compressionFactor * 2);
    const compressedSaturationCounts = compressData(
      saturationCounts,
      compressionFactor
    );

    return { compressedHueCounts, compressedSaturationCounts };
  }

  async function testModel() {
    isTesting = true;
    trainingStatus = "テスト中...";
    // TODO: テスト処理をここに追加
    await new Promise((res) => setTimeout(res, 500));
    trainingStatus = "テスト完了";
    isTesting = false;
  }

  function compressData(data: number[], factor: number): number[] {
    const compressed = [];
    for (let i = 0; i < data.length; i += factor) {
      const sum = data.slice(i, i + factor).reduce((acc, val) => acc + val, 0);
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

  function renderChart(
    canvasId: string,
    label: string,
    data: number[] | [number, number][],
    type: "line" | "scatter" = "line"
  ) {
    const ctx = document.getElementById(canvasId) as HTMLCanvasElement;

    let chartLabels: string[] = [];
    let datasets: any[] = [];
    if (type === "line") {
      chartLabels = Array.from({ length: (data as number[]).length }, (_, i) =>
        (i * compressionFactor + 1).toString()
      );
      datasets = [
        {
          label,
          data,
          borderWidth: 1,
          borderColor: datasetColors[0],
          backgroundColor: datasetColors[0],
        },
      ];
    } else if (type === "scatter") {
      chartLabels = [];
      // hsPairsColorを使って色を設定
      const scatterData = (data as [number, number][]).map(([x, y], i) => ({
        x,
        y,
      }));
      datasets = [
        {
          label,
          data: scatterData,
          showLine: false,
          pointBackgroundColor: hsPairsColor,
          pointBorderColor: hsPairsColor,
        },
      ];
    }

    let targetChart: Chart | null = null;
    if (canvasId === "myChart") targetChart = chart;
    if (canvasId === "myChartS") targetChart = chartS;
    if (canvasId === "myChartV") targetChart = chartV;

    if (!targetChart && type === "line") {
      const newChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: chartLabels,
          datasets,
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
    } else if (type === "scatter") {
      new Chart(ctx, {
        type: "scatter",
        data: {
          datasets,
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "top",
            },
            title: {
              display: true,
              text: label,
            },
          },
          scales: {
            x: {
              title: { display: true, text: "Hue" },
              min: 0,
              max: 360,
            },
            y: {
              title: { display: true, text: "Saturation" },
              min: 0,
              max: 100,
            },
          },
        },
      });
    } else if (targetChart) {
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
  <button on:click={resetCharts} style="margin-top: 1rem;">Reset Charts</button>
  {#if imageSrc}
    <img src={imageSrc} style="max-width: 100%; margin-top: 1rem;" />
  {/if}
  <canvas id="myChart" style="margin-top: 1rem;"></canvas>
  <canvas id="myChartS" style="margin-top: 1rem;"></canvas>
  <canvas id="myChartV" style="margin-top: 1rem;"></canvas>
  <canvas id="hsScatter" style="margin-top: 1rem;"></canvas>
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
  <div style="margin-top: 2rem;">
    <button on:click={startTraining} disabled={isTraining || isTesting}>
      学習開始
    </button>
    <button
      on:click={testModel}
      disabled={isTraining || isTesting}
      style="margin-left: 1rem;"
    >
      テスト
    </button>
    <span style="margin-left: 1rem; font-weight: bold;">
      {trainingStatus}
    </span>
  </div>
</div>
