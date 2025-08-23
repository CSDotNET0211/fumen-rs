import type { DatabaseNode } from "../../../../core/nodes/DatabaseNode/databaseNode";

export class CanvasNode {
	id: number;
	type: string;
	element: HTMLElement | null;
	active: boolean;

	constructor(id: number, type: string) {
		this.id = id;
		this.type = type;
		this.element = null;
		this.active = false;
	}

	render(DatabaseNode: DatabaseNode): void {
		throw new Error("Method not implemented");
	}

	click(e: MouseEvent): void {
		throw new Error("Method not implemented");
	}

	dblClick(e: MouseEvent): void {
		throw new Error("Method not implemented");
	}

	rightClick(e: MouseEvent): void {
		throw new Error("Method not implemented");
	}

}
