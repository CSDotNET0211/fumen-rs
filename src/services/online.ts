import { io, type Socket } from "socket.io-client";
import { gameConfig } from "../app/stores/config";
import { get, writable, type Writable } from "svelte/store";
import { currentFieldIndex } from "../app/stores/data";
import { TetrisEnv } from "tetris/src/tetris_env";
import { BSON } from "bson";
import { suppressFieldUpdateNotification } from "../app/stores/misc";
import { createNodeDatabase, deleteNodeDatabase, getDatabaseAsBinary, getLatestFieldId, loadDatabase, updateNodeDatabase } from "../core/nodes/db";
import { DatabaseNode } from "../core/nodes/DatabaseNode/databaseNode";
import { nodeUpdater } from "../core/nodes/NodeUpdater/nodeUpdater";
import { OnlineNodeUpdater } from "../core/nodes/NodeUpdater/onlineNodeUpdater";
import { LocalNodeUpdater } from "../core/nodes/NodeUpdater/localNodeUpdater";
import { FieldDatabaseNode } from "../core/nodes/DatabaseNode/fieldDatabaseNode";
import { resolveDatabaseNode } from "../core/nodes/DatabaseNode/resolver";
import { currentWindow, WindowFadeDuration } from "../app/stores/window";

type CursorStruct = { x: number; y: number };
export type CursorInfo = {
	name: string;
	color: string;
	x: number;
	y: number;
	opacity: number;
};

export let wsSocket: Socket | null = null;
export const players = writable<Set<{ id: string; name: string; color: string }>>(
	new Set()
);

export const cursors: Writable<{ [id: string]: CursorInfo }> = writable({});
export const isConnecting = writable(false);
export const isConnected = writable(false);

//export const isHost = writable(false);
//let ignoreSubscriber: boolean = false;

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


	const { roomPlayers, isHost }: { roomPlayers: { id: string; name: string; color: string }[], isHost: boolean } = await wsSocket?.emitWithAck("join_room", roomName, userName);
	players.set(new Set(roomPlayers));
	//	isHost.set(isHostValue);

	console.log("host:", isHost);
	if (!isHost) {
		const dbBin = await getHostDB();

		const window = get(currentWindow);

		document.addEventListener("onWindowTransitionEnd", async () => {
			await new Promise(resolve => setTimeout(resolve, 100));
			const firstFieldResult = getLatestFieldId();
			if (firstFieldResult) {
				currentFieldIndex.set(firstFieldResult);
				currentWindow.set(window);
				WindowFadeDuration.set(300);
			}
		}, { once: true });

		loadDatabase(dbBin);
	}
	nodeUpdater.set(new OnlineNodeUpdater());
}

export function throwErrorServer() {
	wsSocket?.emit("debug_throw_error");
}


export async function sendCreateNodeWS(node: DatabaseNode): Promise<any> {
	const response = await wsSocket?.emitWithAck("create_node", BSON.serialize(node));

	const uIntResponse = new Uint8Array(response);
	const databaseNode = resolveDatabaseNode(BSON.deserialize(uIntResponse));

	createNodeDatabase(databaseNode);
}

export async function sendUpdateNodeWS(node: DatabaseNode): Promise<any> {
	const response = await wsSocket?.emitWithAck("update_node", BSON.serialize(node));

	const uIntResponse = new Uint8Array(response);
	const databaseNode = resolveDatabaseNode(BSON.deserialize(uIntResponse));

	updateNodeDatabase(databaseNode);
}

export async function sendDeleteNodeWS(node: DatabaseNode): Promise<any> {
	throw new Error("Not implemented");
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
	const uIntResponse = new Uint8Array(response[0]);
	return uIntResponse;
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

		players.update((set) => {
			set.clear();
			return set;
		});

		nodeUpdater.set(new LocalNodeUpdater());
	});

	wsSocket.on("request_db", (callback) => {
		const data = getDatabaseAsBinary();
		callback(data);
	});

	wsSocket.on(
		"update_cursor",
		(cursorUpdates: { id: string; cursor: CursorStruct | null }[]) => {
			cursorUpdates.forEach(({ id, cursor }) => {
				cursors.update((current) => {
					if (current[id]) {
						if (cursor != null) {
							current[id] = {
								...current[id],
								x: cursor.x ?? -1,
								y: cursor.y ?? -1,
								opacity: 1,
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
				return players;
			});
		}
	);

	wsSocket.on("someone_leave_room", (playerId: string) => {
		players.set(
			new Set([...get(players)].filter((player) => player.id !== playerId))
		);
	});

	wsSocket.on("node_updated", (nodeBson: Uint8Array) => {
		const uIntResponse = new Uint8Array(nodeBson);
		const databaseNodeObj = BSON.deserialize(uIntResponse);
		const databaseNode = resolveDatabaseNode(databaseNodeObj);
		updateNodeDatabase(databaseNode);
	});

	wsSocket.on("node_created", (nodeBson: Uint8Array) => {
		const uIntResponse = new Uint8Array(nodeBson);
		const databaseNodeObj = BSON.deserialize(uIntResponse);
		const databaseNode = resolveDatabaseNode(databaseNodeObj);
		createNodeDatabase(databaseNode);
	});

	wsSocket.on("node_deleted", (nodeBson: Uint8Array) => {
		const uIntResponse = new Uint8Array(nodeBson);
		const databaseNodeObj = BSON.deserialize(uIntResponse);
		const databaseNode = resolveDatabaseNode(databaseNodeObj);
		deleteNodeDatabase(databaseNode);
	});

	wsSocket.on("error", (error) => {
		console.error("WebSocket error:", error);
	});

	wsSocket.on("update_node", async (nodeBson: Uint8Array, callback) => {
		const uIntResponse = new Uint8Array(nodeBson);
		const databaseNodeObj = BSON.deserialize(uIntResponse);

		const databaseNode = resolveDatabaseNode(databaseNodeObj);
		updateNodeDatabase(databaseNode);
		if (callback)
			callback(nodeBson);

	});
}

