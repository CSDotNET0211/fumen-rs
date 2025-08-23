import { writable, type Writable } from "svelte/store";
import type { DatabaseNode } from "../DatabaseNode/databaseNode";


export let nodeUpdater: Writable<NodeUpdater | null> = writable(null);

export abstract class NodeUpdater {


	constructor() {
	}

	abstract update(node: DatabaseNode): Promise<void>;
	abstract create(node: DatabaseNode): Promise<number>;
	abstract delete(nodeId: number): Promise<void>;
}
