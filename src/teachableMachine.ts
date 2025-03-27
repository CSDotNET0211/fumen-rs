import * as tf from '@tensorflow/tfjs';
import * as tmImage from '@teachablemachine/image';

export class TeachableMachine {
	private model!: tmImage.CustomMobileNet;
	private maxPredictions!: number;

	constructor(private modelURL: string, private metadataURL: string) { }

	async init() {
		this.model = await tmImage.load(this.modelURL, this.metadataURL);
		this.maxPredictions = this.model.getTotalClasses();
	}

	async predict(image: HTMLImageElement) {
		const prediction = await this.model.predict(image);
		const bestPrediction = prediction.reduce((best, current) =>
			current.probability > best.probability ? current : best
		);
		return bestPrediction.className;
	}
}
