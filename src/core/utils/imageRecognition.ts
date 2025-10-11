// imageProcessor.ts

// ================================================================
// Tauri / 機械学習 ライブラリのインポート (実行環境に依存)
// ================================================================
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { join, documentDir } from '@tauri-apps/api/path';
import { RandomForestClassifier } from 'ml-random-forest';

// ================================================================
// 型定義
// ================================================================

/**
 * 画像の平均色情報を格納するインターフェース
 */
export interface RgbColor {
	r: number;
	g: number;
	b: number;
}

/**
 * 画像のチャンク情報（切り出し領域）を格納するインターフェース
 */
export interface BlockChunk {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * H S V 色空間の値を格納するインターフェース
 * h, s, v は 0.0 - 1.0 の範囲
 */
export interface HsvColor {
	h: number; // Hue (0.0 - 1.0)
	s: number; // Saturation (0.0 - 1.0)
	v: number; // Value (0.0 - 1.0)
}


/**
 * 訓練データのエントリの型
 * features: [H_sin, S, V]
 * label: ミノのタイプを表す文字列
 */
export interface TrainingEntry {
	features: number[];
	label: string;
}

// ================================================================
// 定数
// ================================================================

export const MINO_WIDTH_COUNT: number = 10;
export const MINO_TYPES: string[] = ["s", "z", "j", "l", "t", "o", "i", "g", "e"];
// ================================================================
// ユーティリティ関数
// ================================================================

/**
 * 画像を指定された数（MINO_WIDTH_COUNT）のブロックに分割するためのチャンク情報を計算
 */
export function getBlockChunks(width: number, height: number): BlockChunk[] {
	const chunks: BlockChunk[] = [];
	const blockWidth: number = Math.floor(width / MINO_WIDTH_COUNT);
	const heightCount: number = Math.floor(height / blockWidth);

	for (let y = 0; y < heightCount; y++) {
		for (let x = 0; x < MINO_WIDTH_COUNT; x++) {
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


export function shrinkChunk(chunk: BlockChunk): BlockChunk {
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


/**
 * ImageDataから平均色（RGB）を計算
 */
export function getImageAvgColor(imageData: ImageData): RgbColor {
	let sumR: number = 0, sumG: number = 0, sumB: number = 0;
	const { width, height, data } = imageData;

	for (let i = 0; i < data.length; i += 4) {
		sumR += data[i];
		sumG += data[i + 1];
		sumB += data[i + 2];
	}

	const totalPixels: number = width * height;
	return {
		r: Math.floor(sumR / totalPixels),
		g: Math.floor(sumG / totalPixels),
		b: Math.floor(sumB / totalPixels)
	};
}

/**
 * RGB値をHSV値に変換。H, S, V は 0.0 - 1.0 の範囲。
 */

export function rgbToHsv(r: number, g: number, b: number): HsvColor {
	const rNorm: number = r / 255;
	const gNorm: number = g / 255;
	const bNorm: number = b / 255;

	const max: number = Math.max(rNorm, gNorm, bNorm);
	const min: number = Math.min(rNorm, gNorm, bNorm);
	let h: number;
	const v: number = max;
	const d: number = max - min;
	const s: number = max === 0 ? 0 : d / max;

	// 彩度が 0 の場合は、H は 0 (色は無意味)
	if (d === 0) {
		h = 0;
	} else {
		// Hの計算を三角関数（atan2）で実行

		// Y (sin成分に対応する仮想軸)
		const Y = Math.sqrt(3) * (gNorm - bNorm) / 2;

		// X (cos成分に対応する仮想軸)
		const X = rNorm - (gNorm + bNorm) / 2;

		// atan2(Y, X) で角度（ラジアン）を計算
		let hRad: number = Math.atan2(Y, X);

		// 角度を 0 から 2π の範囲に調整
		if (hRad < 0) {
			hRad += 2 * Math.PI;
		}

		// 0.0 から 1.0 の範囲に正規化
		// hRad (0 〜 2π) を 2π で割る
		h = hRad / (2 * Math.PI);
	}

	return { h, s, v };
}

/**
 * 元のImageDataから指定されたチャンクのImageDataを切り出す
 */
export function getImageDataFromChunk(imageData: ImageData, chunk: BlockChunk): ImageData {
	const { x, y, width, height } = chunk;
	const data: Uint8ClampedArray = imageData.data;
	// ImageDataの生成はブラウザ依存のため、ここでは型の簡略化を維持
	const chunkData: ImageData = new ImageData(width, height) as ImageData;

	for (let i = 0; i < height; i++) {
		for (let j = 0; j < width; j++) {
			const srcIndex: number = ((y + i) * imageData.width + (x + j)) * 4;
			const dstIndex: number = (i * width + j) * 4;

			chunkData.data[dstIndex] = data[srcIndex];
			chunkData.data[dstIndex + 1] = data[srcIndex + 1];
			chunkData.data[dstIndex + 2] = data[srcIndex + 2];
			chunkData.data[dstIndex + 3] = data[srcIndex + 3];
		}
	}
	return chunkData;
}

// ----------------------------------------------------------------
// 機械学習関連関数
// ----------------------------------------------------------------


/**
 * ミノの分類モデルを学習する関数
 * @param trainingData 訓練データ（features, labelの配列）
 * @returns 学習済みモデル
 */
export function learnMinoModel(trainingData: TrainingEntry[]): any {
	const options = {
		maxFeatures: 1.0,
		replacement: false,
		nEstimators: 30
	};

	const classifier = new RandomForestClassifier(options);

	// featuresとlabelsに分割
	const features = trainingData.map(entry => entry.features);
	const labels = trainingData.map(entry => {
		const index = MINO_TYPES.indexOf(entry.label);
		if (index === -1) {
			throw new Error(`Invalid mino type: ${entry.label}. Must be one of: ${MINO_TYPES.join(', ')}`);
		}
		return index;
	});

	console.log("Training model with data:", { features, labels });
	classifier.train(features, labels);

	// モデルの性能評価
	const predictions = classifier.predict(features);
	const oobPredictions = classifier.predictOOB();

	// 正答率の計算
	let correctCount = 0;
	for (let i = 0; i < labels.length; i++) {
		if (predictions[i] === labels[i]) {
			correctCount++;
		}
	}
	const accuracy = correctCount / labels.length;

	// OOB正答率の計算
	let oobCorrectCount = 0;
	for (let i = 0; i < labels.length; i++) {
		if (oobPredictions[i] === labels[i]) {
			oobCorrectCount++;
		}
	}
	const oobAccuracy = oobCorrectCount / labels.length;

	console.log(`Training Accuracy: ${(accuracy * 100).toFixed(2)}%`);
	console.log(`OOB Accuracy: ${(oobAccuracy * 100).toFixed(2)}%`);

	// 混同行列も取得
	const confusionMatrix = classifier.getConfusionMatrix();
	console.log('Confusion Matrix:', confusionMatrix);

	return classifier.toJSON();

}

// ----------------------------------------------------------------
// Tauri連携・前処理関数
// ----------------------------------------------------------------

/**
 * tauriのファイルパスを読み込み、ImageDataオブジェクトを生成する
 */
async function loadFileToImageData(filePath: string): Promise<ImageData> {
	const { convertFileSrc } = await import('@tauri-apps/api/core');

	const imageUrl = convertFileSrc(filePath);

	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			try {
				const canvas = document.createElement('canvas');
				canvas.width = img.width;
				canvas.height = img.height;
				const ctx = canvas.getContext('2d');

				if (!ctx) {
					reject(new Error("Failed to get 2D context from canvas."));
					return;
				}

				ctx.drawImage(img, 0, 0);
				const imageData: ImageData = ctx.getImageData(0, 0, img.width, img.height);
				resolve(imageData);
			} catch (error) {
				reject(error);
			}
		};
		img.onerror = () => {
			reject(new Error(`Failed to load image from path: ${filePath}`));
		};
		img.src = imageUrl;
	});
}

/**
 * 機械学習の訓練データとして画像を前処理する
 * フォルダ名がミノのタイプ（'l', 'o', 'i', 'e'など）として使用される
 */
export async function preprocessTrainingData(selected: string): Promise<TrainingEntry[]> {



	if (!selected) return [];

	const separator = selected.includes('\\') ? '\\' : '/';

	let allTrainingData: TrainingEntry[] = [];

	// MINO_TYPESの各フォルダを処理
	const targetFolders = MINO_TYPES.map(minoType => {
		return `${selected}${separator}${minoType}`;
	});

	console.log("対象フォルダ:", targetFolders);

	for (const folderPath of targetFolders) {
		const folderName = folderPath.split(/[/\\]/).pop() || "";
		const dataJsonPath = `${folderPath}${separator}data.json`;

		console.log(`フォルダ "${folderName}" を処理中...`);

		// 各フォルダのdata.jsonの存在をチェック
		let existingData: TrainingEntry[] = [];
		let dataJsonExists = false;

		try {
			const existingDataJson = await readTextFile(dataJsonPath);
			existingData = JSON.parse(existingDataJson);
			dataJsonExists = true;
			console.log(`既存の前処理データを発見: ${existingData.length}個のエントリ`);
		} catch (error) {
			console.log(`フォルダ "${folderName}" の既存データが見つかりません。新規作成します。`);
		}

		// data.jsonが存在しない場合は当該フォルダを前処理
		if (!dataJsonExists || true) {
			await preprocessFolderImages(folderPath, folderName, dataJsonPath);

			// 処理後にdata.jsonを読み込み
			try {
				const processedDataJson = await readTextFile(dataJsonPath);
				existingData = JSON.parse(processedDataJson);
			} catch (error) {
				console.error(`フォルダ "${folderName}" の処理済みデータの読み込みに失敗しました:`, error);
				continue;
			}
		}

		// 全体の訓練データに追加
		allTrainingData = allTrainingData.concat(existingData);
	}

	console.log(`処理完了: ${allTrainingData.length}個の訓練データを取得`);
	return allTrainingData;
}

/**
 * 指定したフォルダーパス内の画像ファイルを前処理し、data.jsonに保存する関数
 * @param folderPath 前処理対象のフォルダーパス
 * @param label 保存時に付与するラベル（通常はフォルダ名）
 * @param dataJsonPath 保存先のdata.jsonファイルパス
 * @param existingData 既存のTrainingEntry配列（追記する場合）
 */
export async function preprocessFolderImages(
	folderPath: string,
	label: string,
	dataJsonPath: string,
) {
	const { invoke } = await import('@tauri-apps/api/core');

	let existingData: TrainingEntry[] = [];

	// フォルダ内の画像ファイルを取得
	const imageFiles = await invoke("get_folder_children_absolute_path", {
		folderPath: folderPath
	}) as string[];

	// 画像ファイルのみをフィルタリング
	const filteredImageFiles = imageFiles.filter(file => {
		const extension = file.split('.').pop()?.toLowerCase();
		return ['png', 'jpeg', 'jpg'].includes(extension || "");
	});

	for (const filePath of filteredImageFiles) {
		try {
			const imageData: ImageData = await loadFileToImageData(filePath);
			const avgRgb: RgbColor = getImageAvgColor(imageData);
			const hsv: HsvColor = rgbToHsv(avgRgb.r, avgRgb.g, avgRgb.b);

			const features: number[] = [
				hsv.h,
				hsv.s,
				hsv.v
			];

			existingData.push({ features, label });

		} catch (error) {
			console.error(`Error processing file ${filePath}:`, error);
		}
	}

	// 処理後にdata.jsonを保存
	try {
		await writeTextFile(dataJsonPath, JSON.stringify(existingData, null, 2));
		console.log(`前処理データを保存しました: ${dataJsonPath}`);
	} catch (error) {
		console.error("前処理データの保存に失敗しました:", error);
	}

}
