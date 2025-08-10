import { io, type Socket } from "socket.io-client";
import { gameConfig } from "../app/stores/config";
import { get, writable, type Writable } from "svelte/store";
import { } from "../app/stores/data";
import { TetrisEnv } from "tetris/src/tetris_env";
import { BSON } from "bson";
import { suppressFieldUpdateNotification } from "../app/stores/misc";
import { getDatabaseAsBinary } from "../core/nodes/db";

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

export function connectWebSocket() {
	isConnecting.set(true);
	wsSocket = io(get(gameConfig)?.socketAddress!);
	registerEvents(wsSocket);

}

export function disconnectWebSocket() {
	wsSocket?.disconnect();
}


export function joinRoomWebSocket(
	roomName: string,
	userName: string
) {
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
	wsSocket?.emit("join_room", roomName, userName);
}

export function throwErrorServer() {
	wsSocket?.emit("debug_throw_error");
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

	wsSocket.on("disconnect", () => {
		isConnected.set(false);
		isConnecting.set(false);

		players.update((set) => {
			set.clear();
			return set;
		});
	});

	wsSocket.on(
		"joined_room",
		(roomPlayers: { id: string; name: string; color: string }[]) => {
			players.set(new Set(roomPlayers));
		}
	);

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

	wsSocket.on("request_db", (socketId: string) => {
		/*
				const fieldsArray = Object.values(get(fields));
		
				const serializedFields: Uint8Array[] = [];
				fieldsArray.map((field) => {
					serializedFields.push(field.serialize());
				});
				const totalLength = serializedFields.reduce(
					(acc, arr) => acc + arr.length,
					0
				);
				const result = new Uint8Array(1 + totalLength);
				//console.log(fieldsArray.length);
		
				result[0] = fieldsArray.length;
		
				let offset = 1;
				serializedFields.forEach((arr) => {
					result.set(arr, offset);
					offset += arr.length;
				});
		
				console.log(result);*/
		wsSocket?.emit("get_db", socketId, getDatabaseAsBinary());
	});


	wsSocket.on("get_db", (databaseBinary: Uint8Array<ArrayBufferLike>) => {
		updateDB(databaseBinary);
		/*
		
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
	
		fields.set(deserializedFields);	*/
	});

	wsSocket.on(
		"update_node",
		(nodeBin: Uint8Array, nodeId: number, isHost: boolean) => {
			const json = BSON.deserialize(nodeBin);
			suppressFieldUpdateNotification.set(true);
			FieldNode.updateDB(nodeId, json as TetrisEnv);
			suppressFieldUpdateNotification.set(false);

			if (isHost) {
				const serialized = BSON.serialize(FieldNode.getFromDB(nodeId)!);

				//	const serializedField: Uint8Array =
				//		get(fields)[fieldIndex].serialize();

				wsSocket?.emit("update_node", serialized, nodeId);
			}
		}
	);

	wsSocket.on("delete_node", (id: number) => {
		//TODO: ホストと送信元の人以外にも送信する
		//自分と送信元以外の全員に送る関数がいる？
		let type = Node.getNodeTypeById(id);
		switch (type) {
			case "text":
				FieldNode.deleteDB(id);
				break;
			case "field":
				FieldNode.deleteDB(id);
				break;
			default:
				throw new Error(`Unknown node type: ${type}`);
		}
	});


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


}