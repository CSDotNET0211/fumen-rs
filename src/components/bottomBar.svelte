<script>
	import { writable } from "svelte/store";
	import History from "./bottoms/history.svelte";
	import Share from "./bottoms/share.svelte";

	export const panelXPos = writable(0);
</script>

<div class="panel">
	<History />
	<Share />
</div>

<style>
	.panel {
		position: relative;
		display: flex;
		width: 100%;
		height: 20px;
		background-color: #1c7ad2;
		flex-direction: row;
	}
</style>
