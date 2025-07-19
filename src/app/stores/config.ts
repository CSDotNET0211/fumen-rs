import { writable } from "svelte/store";
import { GameConfig } from "../gameConfig";

export let gameConfig = writable<GameConfig | null>(null);

export async function loadGameConfigOrInitialize() {
	let configJson = await GameConfig.loadOrCreate(window.IS_WEB_MODE);

	gameConfig = writable<GameConfig | null>(configJson);
	gameConfig.subscribe((config) => {
		GameConfig.save(window.IS_WEB_MODE, config!);
	});


}

