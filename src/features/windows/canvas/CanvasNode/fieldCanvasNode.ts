import type { DatabaseNode } from "../../../../core/nodes/DatabaseNode/databaseNode";
import { FieldDatabaseNode } from "../../../../core/nodes/DatabaseNode/fieldDatabaseNode";
import { CanvasNode } from "./canvasNode";
import { currentWindow, WindowType } from "../../../../app/stores/window";
import { currentFieldIndex } from "../../../../app/stores/data";

import { get } from "svelte/store";
import { t } from "../../../../translations/translations";
import { selectedNodeIds } from "../canvasStore";

export class FieldCanvasNode extends CanvasNode {
	constructor(id: number) {
		super(id, "field");
	}
	render(databaseNode: DatabaseNode): void {
		if (!(databaseNode instanceof FieldDatabaseNode)) {
			throw new Error("Expected FieldDatabaseNode but received different type");
		}
		if (this.element) {
			// Update existing element
			if (databaseNode.x !== undefined) {
				this.element.style.left = `${databaseNode.x}px`;
			}
			if (databaseNode.y !== undefined) {
				this.element.style.top = `${databaseNode.y}px`;
			}
			if (databaseNode.thumbnail !== undefined) {
				(this.element as HTMLImageElement).src = databaseNode.thumbnail || "";
			}
			return;
		}

		const img = document.createElement("img");
		img.className = "node-thumbnail canvas-field";
		img.style.position = "absolute";
		img.style.left = `${databaseNode.x}px`;
		img.style.top = `${databaseNode.y}px`;
		img.style.cursor = "move";
		img.style.width = "50px";
		//	img.dataset.nodeId = String(this.id);
		img.src = databaseNode.thumbnail || "";
		img.alt = "thumbnail";
		img.draggable = false;
		img.style.transform = "translate(-50%, -50%)";

		img.ondblclick = (e) => this._dblClick(e as MouseEvent);
		img.oncontextmenu = (e) => super.handleRightClick(e as MouseEvent);
		img.onmousedown = (e) => super.handleMouseDown(e as MouseEvent);
		img.onclick = (e) => super.handleClick(e as MouseEvent);

		// ondragstartはaddEventListenerで登録（ondragstartプロパティだとdblclickが効かなくなる場合がある）
		//img.addEventListener("dragstart", (e) => e.preventDefault());

		this.element = img;
	}

	_dblClick(e: MouseEvent): void {
		super._dblClick(e);

		currentFieldIndex.set(this.id);
		currentWindow.set(WindowType.Field);
	}



}