<script lang="ts">
	/*
	import { Application, Container, Graphics } from "pixi.js";
	import { WIDTH, HEIGHT } from "tetris";
	import { CELL_SIZE } from "../../constants.js";

	const app = new Application();

	app.init({
		backgroundAlpha: 0,
		width: CELL_SIZE * WIDTH,
		height: CELL_SIZE * HEIGHT,
	})
		.then(() => {
			document.getElementById("canvas")?.appendChild(app.canvas);

			const redSprite = new Graphics();
			redSprite
				.fill(0xff0000)
				.rect(0, 0, CELL_SIZE * WIDTH, CELL_SIZE * HEIGHT);

			app.stage.addChild(redSprite);

			//window.addEventListener("onchangefield", onchangefield);
		})
		.catch((error) => {
			console.error("Application initialization failed", error);
		});*/
</script>

<div id="canvas"></div>

<style>
	#canvas {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
