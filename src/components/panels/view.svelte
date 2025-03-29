<script lang="ts">
	import { onMount, setContext } from "svelte";
	import Panel from "../panel.svelte";
	import { boardViewContent, BoardViewContentType } from "../../store";
	import { get } from "svelte/store";

	let image_data: string;

	window.addEventListener("updateview", (event) => {
		image_data = event.detail;
	});

	//onMount(async () => {
	//	swap_clicked(void 0);
	//});

	function swap_clicked(event) {
		let new_mode;

		if (event === void 0) {
			new_mode = get(boardViewContent);
		} else {
			if (get(boardViewContent) === BoardViewContentType.TetrisEdit) {
				new_mode = "branch";
			} /* else if (get(board_view_content) === "branch") {
				new_mode = "tetris-edit";
			}*/
		}

		//	board_view_content.set(new_mode);
	}
</script>

<Panel title="View">
	<div id="container" role="button" tabindex="0" on:click={swap_clicked}>
		<img src={image_data} alt="field" />
	</div>
</Panel>

<style>
	#container {
		width: 90%;
		height: 200px;
		background-color: #1c1c1c;
		box-sizing: border-box;
	}

	#container img {
		width: 100%;
	}

	#container :hover {
		border: 1px solid #1c7ad2;
	}
</style>
