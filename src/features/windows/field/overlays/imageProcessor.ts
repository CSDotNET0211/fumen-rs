export class ImageProcessor {
	static MINO_WIDTH_COUNT = 10;

	static getBlockChunks(width: number, height: number): Chunk[] {
		const chunks = [];
		const blockWidth = Math.round(width / this.MINO_WIDTH_COUNT);
		const heightCount = Math.round(height / blockWidth);

		for (let y = 0; y < heightCount; y++) {
			for (let x = 0; x < this.MINO_WIDTH_COUNT; x++) {
				chunks.push({
					x: x * blockWidth,
					y: y * blockWidth,
					width: blockWidth,
					height: blockWidth,
				});
			}
		}

		return chunks;
	}

	static getImageAvgColor(imageData: ImageData) {
		let sumR = 0, sumG = 0, sumB = 0;
		const { width, height, data } = imageData;

		for (let i = 0; i < data.length; i += 4) {
			sumR += data[i];
			sumG += data[i + 1];
			sumB += data[i + 2];
		}

		const totalPixels = width * height;
		return {
			r: Math.floor(sumR / totalPixels),
			g: Math.floor(sumG / totalPixels),
			b: Math.floor(sumB / totalPixels)
		};
	}

	static rbgToHsv(r: number, g: number, b: number) {
		r /= 255, g /= 255, b /= 255;
		const max = Math.max(r, g, b), min = Math.min(r, g, b);
		let h, s, v = max;

		const d = max - min;
		s = max === 0 ? 0 : d / max;

		if (max === min) {
			h = 0;
		} else {
			// hをsinで計算
			switch (max) {
				case r:
					h = Math.sin((g - b) / d + (g < b ? 6 : 0));
					break;
				case g:
					h = Math.sin((b - r) / d + 2);
					break;
				case b:
					h = Math.sin((r - g) / d + 4);
					break;
			}
			h! /= 6;
		}

		return { h: h!, s: s * 100, v: v * 100 };
	}

	static getMinoFromHsv(h: number, s: number, v: number) {
		if (v <= 20) return 'e';
		if (s <= 50 && v <= 50 || s <= 20) return 'g';
		if (22 <= h && h <= 35) return 'l';
		else if (35 < h && h <= 62) return 'o';
		else if (63 < h && h <= 146) return 's';
		else if (146 < h && h <= 196) return 'i';
		else if (196 < h && h <= 240) return 'j';
		else if (240 < h && h <= 330) return 't';
		else if (330 < h || h < 22) return 'z';
		return null;
	}

	static processImage(imageData: ImageData) {
		const field = [];
		const { width, height } = imageData;
		const chunks = this.getBlockChunks(width, height);

		for (const chunk of chunks) {
			const chunkData = this.getImageDataFromChunk(imageData, chunk);
			const { r, g, b } = this.getImageAvgColor(chunkData);
			const { h, s, v } = this.rbgToHsv(r, g, b);
			const mino = this.getMinoFromHsv(h, s, v);
			field.push(mino);
		}

		return field;
	}

	static getImageDataFromChunk(imageData: ImageData, chunk: Chunk): ImageData {
		const { x, y, width, height } = chunk;
		const data = imageData.data;
		const chunkData = new ImageData(width, height);

		for (let i = 0; i < height; i++) {
			for (let j = 0; j < width; j++) {
				const srcIndex = ((y + i) * imageData.width + (x + j)) * 4;
				const dstIndex = (i * width + j) * 4;
				chunkData.data.set(data.slice(srcIndex, srcIndex + 4), dstIndex);
			}
		}

		return chunkData;
	}

	static shrinkChunk(chunk: Chunk): Chunk {
		const newWidth = Math.round(chunk.width / 2);
		const newHeight = Math.round(chunk.height / 2);

		const shrunkChunk = {
			x: Math.round(chunk.x + chunk.width / 4),
			y: Math.round(chunk.y + chunk.height / 4),
			width: newWidth,
			height: newHeight
		};

		return shrunkChunk;
	}

	static createImageFromRGBA(
		rgba: Uint8Array,
		size: { width: number; height: number },
		resizeTo: { width: number; height: number } = size,
	): string {
		const canvas = document.createElement("canvas");
		canvas.width = size.width;
		canvas.height = size.height;
		const ctx = canvas.getContext("2d");
		const imageData = ctx!.createImageData(size.width, size.height);
		imageData.data.set(rgba);
		ctx!.putImageData(imageData, 0, 0);

		if (resizeTo.width !== size.width || resizeTo.height !== size.height) {
			const resizedCanvas = document.createElement("canvas");
			resizedCanvas.width = resizeTo.width;
			resizedCanvas.height = resizeTo.height;
			const resizedCtx = resizedCanvas.getContext("2d");
			resizedCtx!.drawImage(
				canvas,
				0,
				0,
				resizeTo.width,
				resizeTo.height,
			);
			return resizedCanvas.toDataURL("image/png");
		}

		return canvas.toDataURL("image/png");
	}

	static predict(
		hsv: { h: number; s: number; v: number },
		ranges: {
			[key: string]: {
				h: [number, number],
				s?: [number, number],
				v?: [number, number]
			}
		}
	): string | null {
		const { h, s, v } = hsv;
		for (const key in ranges) {
			const range = ranges[key];
			const hInRange = range.h[0] <= h && h <= range.h[1];
			const sInRange = range.s ? (range.s[0] <= s && s <= range.s[1]) : true;
			const vInRange = range.v ? (range.v[0] <= v && v <= range.v[1]) : true;
			if (hInRange && sInRange && vInRange) {
				return key;
			}
		}
		return null;
	}
}

export type Chunk = {
	x: number;
	y: number;
	width: number;
	height: number;
};
