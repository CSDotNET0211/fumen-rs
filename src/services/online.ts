import { io, type Socket } from "socket.io-client";
import { gameConfig } from "../app/stores/config";
import { get, writable, type Writable } from "svelte/store";
import { } from "../app/stores/data";
import { TetrisEnv } from "tetris/src/tetris_env";
import { BSON } from "bson";
import { suppressFieldUpdateNotification } from "../app/stores/misc";
import { getDatabaseAsBinary, loadDatabase, updateNodeDatabase } from "../core/nodes/db";
import { DatabaseNode } from "../core/nodes/DatabaseNode/databaseNode";
import { nodeUpdater } from "../core/nodes/NodeUpdater/nodeUpdater";
import { OnlineNodeUpdater } from "../core/nodes/NodeUpdater/onlineNodeUpdater";
import { LocalNodeUpdater } from "../core/nodes/NodeUpdater/localNodeUpdater";
import { FieldDatabaseNode } from "../core/nodes/DatabaseNode/fieldDatabaseNode";

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

	if (!isHost) {
		const dbBin = await getHostDB();
		loadDatabase(dbBin);
		nodeUpdater.set(new OnlineNodeUpdater());
	}
}

export function throwErrorServer() {
	wsSocket?.emit("debug_throw_error");
}


export async function sendCreateNodeWS(node: DatabaseNode): Promise<any> {
	throw new Error("Not implemented");
	return new Promise((resolve, reject) => {
		wsSocket?.once("node_created", (response: any) => {
			resolve(response);
		});
		wsSocket?.emit("create_node", BSON.serialize(node));
	});
}

export async function sendUpdateNodeWS(node: DatabaseNode): Promise<any> {
	console.log("Sending update for node:", node);
	const response = await wsSocket?.emitWithAck("update_node", BSON.serialize(node));
	const databaseNode = BSON.deserialize(response[0]) as DatabaseNode;
	console.log("Received update response:", response);
	console.log(databaseNode);
	console.log(get(nodeUpdater));
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



	wsSocket.on("error", (error) => {
		console.error("WebSocket error:", error);
	});

	wsSocket.on("update_node", async (nodeBson: Uint8Array, callback) => {
		console.log("Received update for node:", nodeBson);
		const uIntResponse = new Uint8Array(nodeBson);
		console.log(uIntResponse);
		const databaseNodeObj = BSON.deserialize(uIntResponse) as DatabaseNode;
		console.log(databaseNodeObj);
		console.log(get(nodeUpdater));
		const databaseNode = DatabaseNode.fromObj(databaseNodeObj);
		updateNodeDatabase(databaseNode);
		callback();
	});
}

