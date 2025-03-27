<script lang="ts">
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import { history } from "../../store";
	import type { TetrisEnv } from "tetris";

	const HISTORY_LIMIT = 40;

	type HistoryEntry = {
		entryName: String;
		entry: TetrisEnv;
		content: String;
	};

	class History {
		history: HistoryEntry[];
		historyIndex: number | undefined;

		constructor() {
			this.history = [];
		}

		add(entryName: String, entry: TetrisEnv, content: String) {
			if (this.historyIndex !== undefined) {
				console.assert(this.historyIndex >= 0);
				this.history = this.history.slice(0, this.historyIndex + 1);
			}
			this.history.push({ entryName, entry, content });
			if (HISTORY_LIMIT < this.history.length) {
				this.history.shift();
			}
			this.historyIndex = this.history.length - 1;
		}

		get() {
			return this.history;
		}

		get current() {
			return this.history[this.historyIndex ?? -1];
		}

		get latest() {
			return this.history[this.history.length - 1];
		}

		get length() {
			return this.history.length;
		}
	}

	let historyEntries = [];
	let startIndex = null;
	let endIndex = null;

	onMount(() => {
		// Fetch history entries
		historyEntries = get(history).get();
	});

	function handleEntryClick(index) {
		if (startIndex === null) {
			startIndex = index;
		} else if (endIndex === null) {
			endIndex = index;
			if (endIndex < startIndex) {
				// Swap start and end if end is before start
				[startIndex, endIndex] = [endIndex, startIndex];
			}
		} else {
			startIndex = index;
			endIndex = null;
		}
	}
</script>

<div
	id="container"
	tabindex="-1"
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
				class:selected-start={index === startIndex}
				class:selected-end={index === endIndex}
				class:selected-between={startIndex !== null &&
					endIndex !== null &&
					index > startIndex &&
					index < endIndex}
				onclick={() => handleEntryClick(index)}
			>
				{entry.entryName}
				{@html entry.content}
			</li>
		{/each}
	</ul>
</div>

<style>
	#container {
		width: 100%;
		height: 100%;
		backdrop-filter: blur(5px);
		position: absolute;
		top: 0;
		left: 0;
		background-color: rgba(0, 0, 0, 0.1);
		pointer-events: all;
	}
	ul {
		list-style-type: none; /* Hide list bullets */
		padding: 0;
	}
	li {
		width: 200px;
		padding: 5px;
		cursor: pointer;
	}
	li.selected-start,
	li.selected-end,
	li.selected-between {
		border-left: 3px solid #1c7ad2;
		background: linear-gradient(
			to right,
			#1c7ad2,
			#ffffff00
		); /* Gradient from left to right */
	}
</style>
