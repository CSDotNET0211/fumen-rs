import { writable, type Writable } from "svelte/store";
import type { DatabaseNode } from "../UpdaterNode/databaseNode";


export let nodeUpdater: Writable<NodeUpdater | null> = writable(null);

export abstract class NodeUpdater {


	constructor() {
	}

	abstract update(node: DatabaseNode): void;
	abstract create(node: DatabaseNode): number;
	abstract delete(nodeId: number): void;
}
