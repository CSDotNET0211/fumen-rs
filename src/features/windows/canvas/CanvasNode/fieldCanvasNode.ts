import { get } from "svelte/store";
import type { DatabaseNode } from "../../../../core/nodes/DatabaseNode/databaseNode";
import { FieldDatabaseNode } from "../../../../core/nodes/DatabaseNode/fieldDatabaseNode";
import { nodeUpdater } from "../../../../core/nodes/NodeUpdater/nodeUpdater";
import { CANVAS_HEIGHT, CANVAS_WIDTH, GRID_SNAP_SIZE } from "../const";
import { clamp } from "../util";
import { CanvasNode } from "./canvasNode";
import { getNodeDatabase } from "../../../../core/nodes/db";
import { selectedNodeId } from "../selectionStore";
import { currentWindow, WindowType } from "../../../../app/stores/window";

export class FieldCanvasNode extends CanvasNode {
	isDragging: boolean;
	dragOffsetX: number;
	dragOffsetY: number;


	constructor(id: number) {
		super(id, "field");
		this.isDragging = false;
		this.dragOffsetX = 0;
		this.dragOffsetY = 0;
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
		img.className = "node-thumbnail";
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

		img.onclick = (e) => {
			e.stopPropagation();
			this.click(e as MouseEvent);
		};

		// 先にイベントを登録	
		img.ondblclick = (e) => this.dblClick(e as MouseEvent);
		img.oncontextmenu = (e) => this.rightClick(e as MouseEvent);
		img.onmousedown = (e) => this._onMouseDown(e as MouseEvent);

		// ondragstartはaddEventListenerで登録（ondragstartプロパティだとdblclickが効かなくなる場合がある）
		//img.addEventListener("dragstart", (e) => e.preventDefault());

		this.element = img;
	}

	dblClick(e: MouseEvent): void {
		e.stopPropagation();
		selectedNodeId.set(this.id);
		currentWindow.set(WindowType.Field);
	}

	click(e: MouseEvent): void {

	}


	_onMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		this.isDragging = true;
		const parent = (this.element as HTMLElement).parentElement;
		const parentRect = parent?.getBoundingClientRect();
		const scale =
			parent?.style.transform?.match(/scale\(([\d.]+)\)/)?.[1]
				? parseFloat(parent.style.transform.match(/scale\(([\d.]+)\)/)![1])
				: 1;

		// 基準点: ノードの現在位置とクリック位置の差分
		const fieldNode = getNodeDatabase(this.id) as FieldDatabaseNode;
		this.dragOffsetX = (e.clientX - (parentRect?.left ?? 0)) / scale - fieldNode.x!;
		this.dragOffsetY = (e.clientY - (parentRect?.top ?? 0)) / scale - fieldNode.y!;
		document.body.style.cursor = "grabbing";
		document.addEventListener("mousemove", this._onDragMove);
		document.addEventListener("mouseup", this._onDragEnd);
	}
	private _onDragMove = async (e: MouseEvent) => {
		if (!this.isDragging || !this.element) return;
		const parent = this.element.parentElement;
		if (!parent) return;
		const parentRect = parent.getBoundingClientRect();
		const scale =
			parent.style.transform?.match(/scale\(([\d.]+)\)/)?.[1]
				? parseFloat(parent.style.transform.match(/scale\(([\d.]+)\)/)![1])
				: 1;
		// クリックした場所を基準に、差分だけ移動
		let x = (e.clientX - parentRect.left) / scale - this.dragOffsetX;
		let y = (e.clientY - parentRect.top) / scale - this.dragOffsetY;
		x = clamp(x, 0, CANVAS_WIDTH);
		y = clamp(y, 0, CANVAS_HEIGHT);

		let newX = Math.round(x / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
		let newY = Math.round(y / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
		await get(nodeUpdater)!.update(new FieldDatabaseNode(this.id, newX, newY, undefined, undefined));
	};
	private _onDragEnd = (e: MouseEvent) => {
		this.isDragging = false;
		document.body.style.cursor = "";
		document.removeEventListener("mousemove", this._onDragMove);
		document.removeEventListener("mouseup", this._onDragEnd);

		// ここで保存
		// FieldNodeのみ保存（idがある場合のみ）
		//	if ("id" in this && typeof (this as any).id === "number") {
		//		FieldNode.updateCoordinatesDB((this as any).id, this.x, this.y);
		//updateCoodinatesToMySQL((this as any).id, this.x, this.y);
		//	}
	};

}