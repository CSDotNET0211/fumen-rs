<script lang="ts">
	import { invoke } from "@tauri-apps/api/core";
	import { relaunch } from "@tauri-apps/plugin-process";

	export let visible: boolean;
	export let hidden: boolean;
	export let statusText: string;
	export let showResetOption: boolean;
</script>

<main
	id="splash-screen"
	style="z-index: 1000;"
	class:hidden={!visible}
	class:display-none={hidden}
	data-tauri-drag-region
>
	<div style="text-align: center; margin-top: 20vh;" data-tauri-drag-region>
		<img
			src="128x128.png"
			alt="App Logo"
			style="width: 150px; height: auto; margin-bottom: 20px;"
		/>
		<h1 data-tauri-drag-region style="font-size: 2.5em; margin: 0;">
			fumen-rs
		</h1>
		<p
			data-tauri-drag-region
			style="font-size: 0.9em; color: #aaa; margin-bottom: 0px;"
		>
			version 0.1.0
		</p>
		<p
			data-tauri-drag-region
			style="font-size: 0.8em;margin-top: 0px; color: #888;"
		>
			by CSDotNET
		</p>
		<p
			data-tauri-drag-region
			style="margin-top: 20px; font-size: 0.9em; color: #aaa;"
		>
			{statusText}
		</p>
		{#if showResetOption}
			<!-- svelte-ignore a11y_invalid_attribute -->
			<a
				href="#"
				style="display: block; margin-top: 10px; font-size: 0.8em; color: #00aaff; text-decoration: underline;"
				on:click={async () => {
					await invoke("delete_config_file_if_available");
					await relaunch();
				}}
			>
				Still loading? Reset the configuration file.
			</a>
		{/if}
	</div>
</main>

<style>
	main {
		width: 100%;
		height: 100%;
	}

	#splash-screen {
		background-color: #1c1c1c;
	}

	.hidden {
		opacity: 0;
		transition: opacity 0.3s ease-in-out;
	}

	.display-none {
		display: none;
	}
</style>
