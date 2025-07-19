import { io, type Socket } from "socket.io-client";
import { gameConfig } from "../app/stores/config";
import { get, writable, type Writable } from "svelte/store";
import { fields } from "../app/stores/data";
import { TetrisEnv } from "tetris/src/tetris_env";

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
let lastSentPositionForSendCursorPosition: CursorStruct = { x: -1, y: -1 };


export const cursors: Writable<{ [id: string]: CursorInfo }> = writable({});
export const isConnecting = writable(false);
export const isConnected = writable(false);

let ignoreSubscriber: boolean = false;

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

	wsSocket.on("request_fields", (socketId: string) => {
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

		console.log(result);
		wsSocket?.emit("get_fields", socketId, result);
	});


	//なぜかarraybufferになる
	wsSocket.on("get_fields", (fieldsDataBuffer: ArrayBuffer) => {
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

	wsSocket.on(
		"update_field",
		(fieldDataBuffer: ArrayBuffer, fieldIndex: number, isHost: boolean) => {
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

				wsSocket?.emit("update_field", serializedField, fieldIndex);
			}
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


}