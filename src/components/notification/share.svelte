<script lang="ts">
	import { convertFileSrc } from "@tauri-apps/api/core";
	import { resolveResource } from "@tauri-apps/api/path";
	import { getCurrentWindow } from "@tauri-apps/api/window";
	import { io, Socket } from "socket.io-client";
	import {
		fieldIndex,
		fields,
		gameConfig,
		openedNotificationPanel,
		suppressFieldUpdateNotification,
	} from "../../store";
	import { get, writable } from "svelte/store";
	import Cursor from "../../cursor.svelte";
	import { TetrisEnv } from "tetris";
	import { emitTo } from "@tauri-apps/api/event";
	import { onMount, onDestroy } from "svelte";
	type CursorStruct = { x: number; y: number };

	let share_svg: string = "/share.svg";
	let showPanel = false;
	let isConnected = false;
	let socket: Socket | null = null;

	let ignoreSubscriber: boolean = false;
	let currentMousePosition: { x: number; y: number } | null = null;

	let socketId: string | null = null;
	let roomName: string = "";
	let players = writable<Set<{ id: string; name: string; color: string }>>(
		new Set(),
	);

	const COLORS = [
		"red",
		"orange",
		"yellow",
		"green",
		"blue",
		"indigo",
		"violet",
	];

	let userName: string = "";

	let showCursor = true;
	//let cursorPositions: { [id: string]: CursorStruct | null } = {};
	let cursors: {
		[id: string]: {
			name: string;
			color: string;
			x: number;
			y: number;
			opacity: number;
		};
	} = {};

	function handleShareClick(
		event: MouseEvent & { currentTarget: EventTarget & HTMLDivElement },
	) {
		showPanel = !showPanel;
		if (showPanel) {
			openedNotificationPanel.set("share");
		} else {
			openedNotificationPanel.set(null);
		}
	}

	function handleMouseMove(event: MouseEvent) {
		currentMousePosition = { x: event.clientX, y: event.clientY };
	}

	onMount(() => {
		window.addEventListener("mousemove", handleMouseMove);
	});

	onDestroy(() => {
		window.removeEventListener("mousemove", handleMouseMove);
	});

	openedNotificationPanel.subscribe((panel) => {
		if (panel !== "share") {
			showPanel = false;
		}
	});

	fields.subscribe((fields) => {
		if (
			socket == null ||
			ignoreSubscriber ||
			get(suppressFieldUpdateNotification)
		) {
			return;
		}

		const serializedField: Uint8Array = fields[get(fieldIndex)].serialize();

		socket?.emit("update_field", serializedField, get(fieldIndex));
	});

	function handleConnectClick() {
		socket = io(get(gameConfig)?.socketAddress!);
		socket.on("connect", () => {
			isConnected = true;
			socketId = socket!.id!;

			const start = Date.now();
			socket!.emit("ping", () => {
				const duration = Date.now() - start;
				console.log("ping:" + duration);
			});
		});
		socket.on("disconnect", () => {
			isConnected = false;
			socketId = null;
			players.set(new Set());
		});

		socket.on(
			"joined_room",
			(roomPlayers: { id: string; name: string; color: string }[]) => {
				players.set(new Set(roomPlayers));
			},
		);

		socket.on(
			"update_cursor",
			(cursorUpdates: { id: string; cursor: CursorStruct | null }[]) => {
				cursorUpdates.forEach(({ id, cursor }) => {
					if (cursors[id]) {
						if (cursor != null) {
							cursors[id].x = cursor.x ?? -1;
							cursors[id].y = cursor.y ?? -1;
							cursors[id].opacity = 1;
						} else {
							cursors[id].opacity = 0;
						}
					}
				});
			},
		);

		socket.on("request_fields", (socketId: string) => {
			const fieldsArray = Object.values(get(fields));

			const serializedFields: Uint8Array[] = [];
			fieldsArray.map((field) => {
				serializedFields.push(field.serialize());
			});
			const totalLength = serializedFields.reduce(
				(acc, arr) => acc + arr.length,
				0,
			);
			const result = new Uint8Array(1 + totalLength);
			//console.log(fieldsArray.length);

			result[0] = fieldsArray.length;

			let offset = 1;
			serializedFields.forEach((arr) => {
				result.set(arr, offset);
				offset += arr.length;
			});

			console.log(result);
			socket?.emit("get_fields", socketId, result);
		});

		//なぜかarraybufferになる
		socket.on("get_fields", (fieldsDataBuffer: ArrayBuffer) => {
			const fieldsData = new Uint8Array(fieldsDataBuffer);
			const fieldCount = fieldsData[0];
			let offset = 1;
			const deserializedFields = [];

			for (let i = 0; i < fieldCount; i++) {
				console.log(i);
				const field = TetrisEnv.deserialize({
					buffer: fieldsData,
					bufferIndex: offset,
				});
				deserializedFields.push(field);
			}

			fields.set(deserializedFields);
		});

		socket.on(
			"update_field",
			(
				fieldDataBuffer: ArrayBuffer,
				fieldIndex: number,
				isHost: boolean,
			) => {
				const fieldData = new Uint8Array(fieldDataBuffer);

				ignoreSubscriber = true;
				fields.update((fields) => {
					fields[fieldIndex] = TetrisEnv.deserialize({
						buffer: fieldData,
						bufferIndex: 0,
					});
					return fields;
				});
				ignoreSubscriber = false;

				if (isHost) {
					const serializedField: Uint8Array =
						get(fields)[fieldIndex].serialize();

					socket?.emit("update_field", serializedField, fieldIndex);
				}
			},
		);

		socket.on(
			"someone_join_room",
			(newPlayer: { id: string; name: string; color: string }) => {
				players.update((players) => {
					players.add(newPlayer);
					return players;
				});
			},
		);

		socket.on("someone_leave_room", (playerId: string) => {
			players.set(
				new Set(
					[...get(players)].filter(
						(player) => player.id !== playerId,
					),
				),
			);
		});

		console.log(!socket?.connected);
	}

	function handleJoinRoomClick(
		event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement },
	) {
		if (
			!roomName ||
			!userName ||
			roomName.length > 12 ||
			userName.length > 12
		) {
			alert(
				"Room Name and Username must be non-empty and less than 12 characters.",
			);
			return;
		}
		socket?.emit("join_room", roomName, userName);
	}

	/*function handleLeaveRoomClick() {
		socket?.disconnect();
		socket = null;
		players.set(new Set());
	}*/

	function handleDisconnectClick() {
		socket?.disconnect();
	}

	let lastSentPositionForSendCursorPosition: CursorStruct = { x: -1, y: -1 };

	function sendCursorPosition() {
		if (socket && isConnected) {
			const x = currentMousePosition?.x ?? -1;
			const y = currentMousePosition?.y ?? -1;

			if (
				x === lastSentPositionForSendCursorPosition.x &&
				y === lastSentPositionForSendCursorPosition.y
			) {
				return;
			}

			const cursor: CursorStruct | null =
				x == null || y == null ? null : { x, y };
			socket.emit("update_cursor", cursor);

			lastSentPositionForSendCursorPosition = { x, y };
		}
	}

	setInterval(sendCursorPosition, 50);

	$: cursors = Array.from($players)
		.filter((player) => player.id !== socketId) // Exclude the current user's cursor
		.reduce(
			(
				acc: {
					[key: string]: {
						name: string;
						color: string;
						x: number;
						y: number;
						opacity: number;
					};
				},
				player,
			) => {
				acc[player.id] = {
					name: player.name,
					color: player.color,
					x: -1,
					y: -1,
					opacity: 0,
				};
				return acc;
			},
			{},
		);
</script>

<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	id="container"
	onmouseenter={(e) => e.stopPropagation()}
	onmouseup={(e) => e.stopPropagation()}
	onmousedown={(e) => e.stopPropagation()}
	onmouseout={(e) => e.stopPropagation()}
	onclick={handleShareClick}
>
	<button
		class="icon-button"
		tabindex="-1"
		onmousedown={(e) => e.preventDefault()}
	>
		<img src={share_svg} alt="share" tabindex="-1" />
	</button>
	{#if $players.size > 0}
		<span class="participant-count">{$players.size}</span>
	{/if}
</div>

<!-- svelte-ignore a11y_mouse_events_have_key_events -->
{#if showPanel}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		id="main-panel"
		onmouseenter={(e) => e.stopPropagation()}
		onmouseup={(e) => e.stopPropagation()}
		onmousedown={(e) => e.stopPropagation()}
		onmouseout={(e) => e.stopPropagation()}
	>
		<div class="title">Online</div>
		{#if !isConnected}
			<button class="connect-button" onclick={handleConnectClick}
				>Connect</button
			>
		{:else if $players.size === 0}
			<div class="connected-info">
				<p>Socket ID: {socketId}</p>
				<input
					type="text"
					placeholder="Enter Room Name"
					class="room-input"
					bind:value={roomName}
					onkeydown={(e) => e.stopPropagation()}
				/>
				<input
					type="text"
					placeholder="Enter Username"
					class="username-input"
					bind:value={userName}
					onkeydown={(e) => e.stopPropagation()}
				/>
				<button class="join-button" onclick={handleJoinRoomClick}
					>Join Room</button
				>
				<button
					class="disconnect-button"
					onclick={handleDisconnectClick}
					>Disconnect From Server</button
				>
			</div>
		{:else}
			<div class="room-info">
				<p>Room: {roomName}</p>
				<p>Players: {$players.size}</p>
				<ul>
					{#each Array.from($players) as player}
						<li>{player.name}</li>
					{/each}
				</ul>

				<label class="cursor-toggle">
					<input type="checkbox" bind:checked={showCursor} />
					Show Cursor
				</label>

				<button class="leave-button" onclick={handleDisconnectClick}
					>Disconnect</button
				>
			</div>
		{/if}
	</div>
{/if}

{#if showCursor}
	{#each Object.values(cursors) as cursor}
		<Cursor
			name={cursor.name}
			color={cursor.color}
			x={cursor.x}
			y={cursor.y}
			opacity={cursor.opacity}
		></Cursor>
	{/each}
{/if}

<style>
	#container {
		padding: 0px 10px;
		height: 100%;
		pointer-events: all;
		cursor: pointer;
	}

	#container:hover {
		background-color: #3788d4;
	}

	#main-panel {
		color: #cbcbcb;
		position: fixed;
		bottom: 0;
		left: 0;
		bottom: 30px;
		left: 10px;
		background-color: #1f1f1f;
		border: 1px solid #414141;
		border-radius: 3px;
		padding: 10px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		width: 200px;
		max-height: 300px;
		overflow-y: auto;
		z-index: 1000;
		transition:
			opacity 0.3s ease,
			transform 0.3s ease;

		pointer-events: auto;
	}

	#main-panel .title {
		margin-top: 0;
		margin-bottom: 10px;
		font-size: 15px;
		color: #fff;
	}

	.connect-button {
		width: 100%;
		padding: 8px;
		background-color: #007bff;
		color: #fff;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.connect-button:hover {
		background-color: #0056b3;
	}

	.icon-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.icon-button img {
		width: 14px;
	}

	.connected-info {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.room-input {
		width: calc(100% - 20px);
		padding: 8px;
		margin-bottom: 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.username-input {
		width: calc(100% - 20px);
		padding: 8px;
		margin-bottom: 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.join-button {
		width: 100%;
		padding: 8px;
		background-color: #28a745;
		color: #cbcbcb;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.join-button:hover {
		background-color: #218838;
	}

	.room-info {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.leave-button {
		width: 100%;
		padding: 8px;
		background-color: #dc3545;
		color: #cbcbcb;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.leave-button:hover {
		background-color: #c82333;
	}

	.disconnect-button {
		width: 100%;
		padding: 8px;
		background-color: #6c757d;
		color: #cbcbcb;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.disconnect-button:hover {
		background-color: #5a6268;
	}

	.participant-count {
		color: #cbcbcb;
		font-size: 14px;
		margin: 5px 0; /* Added equal top and bottom margins */
	}
</style>
