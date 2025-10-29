import { io, type Socket } from "socket.io-client";
import { gameConfig } from "../app/stores/config";
import { get, writable, type Writable } from "svelte/store";
import { currentFieldIndex } from "../app/stores/data";
import { TetrisEnv } from "tetris/src/tetris_env";
import { BSON } from "bson";
import { createNodeDatabase, deleteNodeDatabase, getDatabaseAsBinary, getLatestFieldId, loadDatabase, updateNodeDatabase } from "../core/nodes/db";
import { DatabaseNode } from "../core/nodes/DatabaseNode/databaseNode";
import { nodeUpdater } from "../core/nodes/NodeUpdater/nodeUpdater";
import { OnlineNodeUpdater } from "../core/nodes/NodeUpdater/onlineNodeUpdater";
import { LocalNodeUpdater } from "../core/nodes/NodeUpdater/localNodeUpdater";
import { FieldDatabaseNode } from "../core/nodes/DatabaseNode/fieldDatabaseNode";
import { resolveDatabaseNode } from "../core/nodes/DatabaseNode/resolver";
import { currentWindow, DEFAULT_TETRIS_CANVAS_HEIGHT, DEFAULT_TETRIS_CANVAS_WIDTH, WindowFadeDuration } from "../app/stores/window";
import { tetrisBoardApp } from "../features/windows/field/modules/tetrisBoard.svelte";

type CursorStruct = { x: number; y: number, location: number | null };
export type CursorInfo = {
	name: string;
	color: string;
	x: number;
	y: number;
	location: number | null;
};

export let wsSocket: Socket | null = null;
export const players = writable<Set<{ id: string; name: string; color: string }>>(
	new Set()
);
export const cursors: Writable<{ [id: string]: CursorInfo }> = writable({});

//export const cursors: Writable<{ [id: string]: CursorInfo }> = writable({});
export const isConnecting = writable(false);
export const isConnected = writable(false);

//export const isHost = writable(false);
//let ignoreSubscriber: boolean = false;

const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'];

function assignColors(playersList: { id: string; name: string; color: string }[]) {
	cursors.update(() => {
		const newCursors: { [id: string]: CursorInfo } = {};
		playersList.forEach((player, index) => {
			newCursors[player.id] = {
				name: player.name,
				color: COLORS[index % COLORS.length],
				x: -100,
				y: -100,
				location: null
			};
		});
		return newCursors;
	});
}

export function connectWS() {
	isConnecting.set(true);
	wsSocket = io(get(gameConfig)?.socketAddress!, {
		reconnection: false
	});
	registerEvents(wsSocket);

}

export function disconnectWS() {
	wsSocket?.disconnect();
}

// 自分のIDを保存する変数を追加
let myPlayerId: string | null = null;

export async function joinRoomWS(
	roomName: string,
	userName: string
): Promise<void> {
	if (
		!roomName ||
		!userName ||
		roomName.length > 12 ||
		userName.length > 12
	) {
		alert(
			"Roomname and Username must be non-empty and less than 12 characters."
		);
		return;
	}

	const { roomPlayers, isHost, playerId }: { roomPlayers: { id: string; name: string; color: string }[], isHost: boolean, playerId: string } = await wsSocket?.emitWithAck("join_room", roomName, userName);
	//console.log(roomPlayers, isHost, playerId);

	players.set(new Set(roomPlayers));

	// Register cursors for all players in the room with local colors (自分以外)

	myPlayerId = wsSocket?.id ?? "";

	assignColors(roomPlayers.filter(player => player.id !== myPlayerId));

	// Register tetris board move event listener
	document.addEventListener("onTetrisBoardMove", onTetrisBoardMove);

	// Start position update interval
	positionSendInterval = setInterval(sendPositionIfChanged, 50);

	if (!isHost) {
		const dbBin = await getHostDB();
		loadDatabase(dbBin, true);
	}
	nodeUpdater.set(new OnlineNodeUpdater());
}


export async function sendUpdateDatabaseWS(dbBin: Uint8Array, useSplash: boolean): Promise<void> {
	const response = await wsSocket?.emitWithAck("update_db", dbBin, useSplash);
	const uIntResponse = new Uint8Array(response);

	loadDatabase(uIntResponse, true);
}



export function throwErrorServer() {
	wsSocket?.emit("debug_throw_error");
}


export async function sendCreateNodeWS(node: DatabaseNode): Promise<any> {
	const response = await wsSocket?.emitWithAck("create_node", BSON.serialize(node));

	const uIntResponse = new Uint8Array(response);
	const databaseNode = resolveDatabaseNode(BSON.deserialize(uIntResponse));
	return createNodeDatabase(databaseNode);
}

export async function sendUpdateNodeWS(node: DatabaseNode): Promise<any> {
	const data = BSON.serialize(node);
	const response = await wsSocket?.emitWithAck("update_node", data);

	const uIntResponse = new Uint8Array(response);
	const databaseNode = resolveDatabaseNode(BSON.deserialize(uIntResponse));

	updateNodeDatabase(databaseNode);
}

export async function sendDeleteNodeWS(node: DatabaseNode): Promise<any> {
	throw new Error("Not implemented");
	//TODO: aaa
	return new Promise((resolve, reject) => {
		wsSocket?.once("node_deleted", (response: any) => {
			resolve(response);
		});
		wsSocket?.emit("delete_node", BSON.serialize(node));
	});

	deleteNodeDatabase(node);
}

export async function getHostDB(): Promise<Uint8Array> {
	const response = await wsSocket?.emitWithAck("request_db");
	console.log(response);
	const uint8Array = new Uint8Array(response);
	//const uIntResponse = new Uint8Array(response[0]);
	return uint8Array;
}

let currentMousePosition: { x: number; y: number; location: number | null } = { x: -1, y: -1, location: null };
let lastSentPosition: { x: number; y: number; location: number | null } = { x: -1, y: -1, location: null };
let positionSendInterval: NodeJS.Timeout | null = null;

function onTetrisBoardMove(event: Event) {
	const data = (event as CustomEvent).detail;
	//console.log((event as CustomEvent).detail);

	//元のwindowsizeの比率に変換して、送信
	//受信側では、clientXとclientYを元のcanvasのサイズで割って、比率を求める
	const canvas = tetrisBoardApp?.canvas;
	if (!canvas) return;

	const scaleX = DEFAULT_TETRIS_CANVAS_WIDTH / canvas.clientWidth;
	const scaleY = DEFAULT_TETRIS_CANVAS_HEIGHT / canvas.clientHeight;
	currentMousePosition = {
		x: (data.clientX - (tetrisBoardApp?.canvas.getBoundingClientRect().left ?? 0)) * scaleX,
		y: (data.clientY - (tetrisBoardApp?.canvas.getBoundingClientRect().top ?? 0)) * scaleY,
		location: get(currentFieldIndex)
	};
}

function sendPositionIfChanged() {
	if (currentMousePosition.x !== lastSentPosition.x || currentMousePosition.y !== lastSentPosition.y || currentMousePosition.location !== lastSentPosition.location) {
		wsSocket?.emit("update_cursor", currentMousePosition);

		lastSentPosition = { ...currentMousePosition };
	}
}

function registerEvents(wsSocket: Socket) {
	wsSocket.on("connect", () => {
		isConnected.set(true);
		isConnecting.set(false);

		const start = Date.now();
		wsSocket!.emit("ping", () => {
			const duration = Date.now() - start;
			console.log("ping:" + duration);
		});
	});

	wsSocket.on("connect_error", () => {
		isConnecting.set(false);
	});

	wsSocket.on("disconnect", () => {
		isConnected.set(false);
		isConnecting.set(false);

		// 自分のIDをリセット
		myPlayerId = null;

		players.update((set) => {
			set.clear();
			return set;
		});

		// Clear all cursors on disconnect
		cursors.set({});

		// Remove tetris board move event listener
		document.removeEventListener("onTetrisBoardMove", onTetrisBoardMove);

		// Clear position update interval
		if (positionSendInterval) {
			clearInterval(positionSendInterval);
			positionSendInterval = null;
		}

		nodeUpdater.set(new LocalNodeUpdater());
	});
	wsSocket.on("request_db", async (args, ack) => {
		console.log(args, ack);
		const data = getDatabaseAsBinary();
		ack(data);
	});

	wsSocket.on(
		"update_cursor",
		(updateCursors: { id: string; cursor: CursorStruct | null }[]) => {
			updateCursors.forEach(({ id, cursor }) => {
				if (id === myPlayerId) return;

				cursors.update((current) => {
					if (current[id]) {
						if (cursor != null) {
							current[id] = {
								...current[id],
								x: cursor.x,
								y: cursor.y,
								location: cursor.location
							};

						} else {
							delete current[id];
						}
					}
					return current;
				});
			});
		}
	);

	wsSocket.on(
		"someone_join_room",
		(newPlayer: { id: string; name: string; color: string }) => {
			players.update((players) => {
				players.add(newPlayer);
				console.log(players);
				return players;
			});
			console.log("someone_join_room", newPlayer, myPlayerId);
			// Reassign colors for all players (自分以外)
			assignColors([...get(players)].filter(player => player.id !== myPlayerId));
		}
	);

	wsSocket.on("someone_leave_room", (playerId: string) => {
		console.log("someone_leave_room", playerId, myPlayerId);
		console.log(players);
		players.set(
			new Set([...get(players)].filter((player) => player.id !== playerId))
		);

		// Reassign colors for remaining players (自分以外)
		assignColors([...get(players)].filter(player => player.id !== myPlayerId));
	});


	wsSocket.on("error", (error) => {
		console.error("WebSocket error:", error);
	});


	wsSocket.on("update_db", (dbBin: ArrayBuffer, useSplash: boolean, ack) => {
		const uIntResponse = new Uint8Array(dbBin);


		loadDatabase(uIntResponse, true);

		if (ack)
			ack(uIntResponse);
	});


	wsSocket.on("update_node", async (nodeBson: Uint8Array, callback) => {
		const uIntResponse = new Uint8Array(nodeBson);
		const databaseNodeObj = BSON.deserialize(uIntResponse);

		const databaseNode = resolveDatabaseNode(databaseNodeObj);
		updateNodeDatabase(databaseNode);
		if (callback)
			callback(nodeBson);

	});

	wsSocket.on("create_node", async (nodeBson: Uint8Array, callback) => {
		const uIntResponse = new Uint8Array(nodeBson);
		const databaseNodeObj = BSON.deserialize(uIntResponse);

		const databaseNode = resolveDatabaseNode(databaseNodeObj);
		createNodeDatabase(databaseNode);
		if (callback)
			callback(nodeBson);
	});

	wsSocket.on("delete_node", async (nodeBson: Uint8Array, callback) => {
		const uIntResponse = new Uint8Array(nodeBson);
		const databaseNodeObj = BSON.deserialize(uIntResponse);

		const databaseNode = resolveDatabaseNode(databaseNodeObj);
		deleteNodeDatabase(databaseNode);
		if (callback)
			callback(nodeBson);
	});
}