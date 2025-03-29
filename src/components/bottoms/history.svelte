<script lang="ts">
	import { convertFileSrc } from "@tauri-apps/api/core";
	import { resolveResource } from "@tauri-apps/api/path";
	import { history, openedNotificationPanel } from "../../store";
	import { get } from "svelte/store";
	import type { History } from "../../history";
	import { emitTo } from "@tauri-apps/api/event";
	import panelXPos from "../bottomBar.svelte";

	let history_svg: string = "/history.svg";
	let showPanel = false;
	let historyEntries = get(history).get();
	let selectedIndex: number | null = null;

	function handleHistoryClick(
		event: MouseEvent & { currentTarget: EventTarget & HTMLDivElement },
	) {
		showPanel = !showPanel;
		if (showPanel) {
			openedNotificationPanel.set("history");
		} else {
			openedNotificationPanel.set(null);
		}
		historyEntries = get(history).get();
		if (showPanel) {
			setTimeout(() => {
				const panel = document.querySelector("#main-panel");
				if (panel) {
					panel.scrollTop = panel.scrollHeight;
				}
			}, 0);
		}
	}

	history.subscribe((history) => {
		historyEntries = history.get();
		selectedIndex = history.historyIndex as number;
	});

	function handleEntryClick(index: number) {
		selectedIndex = index;

		history.update((history: History) => {
			{
				history.historyIndex = index;
				const currentHistoryObj = history.current.entry.clone();
				emitTo("main", "applyfield", currentHistoryObj);
			}

			return history;
		});
	}

	openedNotificationPanel.subscribe((panel) => {
		if (panel !== "history") {
			showPanel = false;
		}
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div id="container" tabindex="-1" onclick={handleHistoryClick}>
	<button class="icon-button" tabindex="-1">
		<img src={history_svg} alt="history" tabindex="-1" draggable="false" />
	</button>
</div>

{#if showPanel}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_mouse_events_have_key_events -->
	<div
		id="main-panel"
		onmouseenter={(e) => e.stopPropagation()}
		onmouseup={(e) => e.stopPropagation()}
		onmousedown={(e) => e.stopPropagation()}
		onmouseout={(e) => e.stopPropagation()}
	>
		<div id="title">History</div>
		<ul>
			{#each historyEntries as entry, index}
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<li
					class:selected-after={selectedIndex !== null &&
						index > selectedIndex}
					onclick={() => handleEntryClick(index)}
				>
					{entry.entryName}
					{@html entry.content}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	#container {
		padding: 0px 10px;
		height: 100%;
		transition: background-color 0.3s ease;
		cursor: pointer;
	}

	#container:hover {
		background-color: #3788d4;
	}

	#main-panel {
		color: #f0f0f0;
		position: fixed;
		bottom: 30px;
		left: 10px;
		background-color: #1f1f1f;
		border: 1px solid #414141;
		border-radius: 3px;
		padding: 10px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
		width: 200px;
		max-height: 300px;
		overflow-y: auto;
		z-index: 1000;
		transition:
			opacity 0.3s ease,
			transform 0.3s ease;
		pointer-events: all;
	}

	#main-panel #title {
		margin-top: 0;
		margin-bottom: 10px;
		font-size: 15px;
		color: #fff;
	}

	#main-panel ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	#main-panel li {
		padding: 4px;
		font-size: 15px;
		border-bottom: 1px solid #555;
		cursor: pointer;
		color: #ddd;
	}

	#main-panel li:last-child {
		border-bottom: none;
	}

	#main-panel li.selected-after {
		color: #888;
	}

	.icon-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.icon-button img {
		width: 16px;
	}
</style>
