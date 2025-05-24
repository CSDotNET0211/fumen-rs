//
/**
 * HSV値から3D空間上のx, y, z座標を計算する関数
 * @param h 色相 (0-360)
 * @param s 彩度 (0-100)
 * @param v 明度 (0-100)
 * @param displayMode "cone" | "cylinder"
 * @returns { x, y, z }
 */
export function hsvToPosition(
	h: number,
	s: number,
	v: number,
	displayMode: "cone" | "cylinder"
): { x: number; y: number; z: number } {
	const y = v / 100;
	const radians = h * (Math.PI / 180);
	// displayModeによって(s / 100)を使うかどうかを切り替え
	let r = displayMode === "cone" ? (s / 100) * 0.5 : (s / 100) * y * 0.5;
	const x = Math.sin(radians) * r;
	const z = Math.cos(radians) * r;
	return { x, y, z };
}

/**
 * 画像をHSVチャンク配列に変換
 * @param img HTMLImageElement
 * @param ImageProcessor ImageProcessorクラス
 * @returns チャンク配列
 */
export async function imageToChunks(
	img: HTMLImageElement,
	ImageProcessor: any
): Promise<{ h: number; s: number; v: number; color: string }[]> {
	const canvas = document.createElement("canvas");

	const ctx = canvas.getContext("2d")!;
	canvas.width = img.width;
	canvas.height = img.height;
	ctx.drawImage(img, 0, 0);

	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

	const chunks = ImageProcessor.getBlockChunks(
		canvas.width,
		canvas.height
	).map((chunk: any) => ImageProcessor.shrinkChunk(chunk));

	const result: { h: number; s: number; v: number; color: string }[] = [];

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

			const color = `#${Math.round(avgR)
				.toString(16)
				.padStart(2, "0")}${Math.round(avgG)
					.toString(16)
					.padStart(2, "0")}${Math.round(avgB)
						.toString(16)
						.padStart(2, "0")}`;

			result.push({ h, s, v, color });
		}
	}
	return result;
}