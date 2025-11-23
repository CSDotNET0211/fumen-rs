import { get } from "svelte/store";
import type { DatabaseNode } from "../../../../core/nodes/DatabaseNode/databaseNode";
import { FieldDatabaseNode } from "../../../../core/nodes/DatabaseNode/fieldDatabaseNode";
import { TextDatabaseNode } from "../../../../core/nodes/DatabaseNode/textDatabaseNode";
import { getNodeDatabase } from "../../../../core/nodes/db";
import { nodeUpdater } from "../../../../core/nodes/NodeUpdater/nodeUpdater";
import { selectedNodeIds } from "../canvasStore";
import { CANVAS_HEIGHT, CANVAS_WIDTH, GRID_SNAP_SIZE } from "../const";
import { clamp } from "../util";
import { close } from "../contextMenu.svelte";

export class CanvasNode {
	id: number;
	type: string;
	element: HTMLElement | null;
	active: boolean;
	isDragging: boolean;
	dragOffsetX: number;
	dragOffsetY: number;
	// ドラッグ開始時の各ノードの初期位置を保存
	private initialNodePositions: Map<number, { x: number; y: number }> = new Map();

	constructor(id: number, type: string) {
		this.id = id;
		this.type = type;
		this.element = null;
		this.active = false;
		this.isDragging = false;
		this.dragOffsetX = 0;
		this.dragOffsetY = 0;
	}

	render(DatabaseNode: DatabaseNode): void {
		throw new Error("Method not implemented");
	}

	_pointerDown(e: MouseEvent): void {
		throw new Error("Method not implemented");
	}

	_dblClick(e: MouseEvent): void {
		e.stopPropagation();
	}

	// 共通の右クリック処理
	protected handleRightClick(e: MouseEvent): void {
		e.stopPropagation();
		e.preventDefault();

		// 右クリック時の選択処理
		if (e.ctrlKey) {
			// Ctrlキーが押されている場合は追加選択
			const currentSelection = get(selectedNodeIds);
			if (currentSelection.includes(this.id)) {
				selectedNodeIds.set(currentSelection.filter(id => id !== this.id));
			} else {
				selectedNodeIds.set([...currentSelection, this.id]);
			}
		} else {
			// Ctrlキーが押されていない場合
			const currentSelection = get(selectedNodeIds);
			// 既に選択されていない場合のみ、このノードのみを選択
			if (!currentSelection.includes(this.id)) {
				selectedNodeIds.set([this.id]);
			}
		}

		// コンテキストメニューを開くためのイベントを発行
		const contextMenuEvent = new CustomEvent('openNodeContextMenu', {
			detail: {
				x: e.clientX,
				y: e.clientY,
				id: this.id
			}
		});
		document.dispatchEvent(contextMenuEvent);
	}

	// 共通のマウスダウン処理
	protected handleMouseDown(e: MouseEvent): void {
		if (e.button !== 0) return;
		e.stopPropagation();

		close();

		const currentSelection = get(selectedNodeIds);

		if (e.ctrlKey) {
			if (currentSelection.includes(this.id)) {
				selectedNodeIds.set(currentSelection.filter(id => id !== this.id));
			} else {
				selectedNodeIds.set([...currentSelection, this.id]);
			}
		} else {
			// 既に選択されている場合は何もしない
			if (!currentSelection.includes(this.id)) {
				selectedNodeIds.set([this.id]);
			}
		}

		this.isDragging = true;
		const parent = (this.element as HTMLElement).parentElement;
		const parentRect = parent?.getBoundingClientRect();
		const scale =
			parent?.style.transform?.match(/scale\(([\d.]+)\)/)?.[1]
				? parseFloat(parent.style.transform.match(/scale\(([\d.]+)\)/)![1])
				: 1;

		// 基準点: マウスの押した位置を記録
		this.dragOffsetX = (e.clientX - (parentRect?.left ?? 0)) / scale;
		this.dragOffsetY = (e.clientY - (parentRect?.top ?? 0)) / scale;

		// ドラッグ開始時に選択されているすべてのノードの初期位置を記録
		this.initialNodePositions.clear();
		const selectedIds = get(selectedNodeIds);
		for (const nodeId of selectedIds) {
			const node = getNodeDatabase(nodeId);
			if (node && this.isMovableNode(node)) {
				this.initialNodePositions.set(nodeId, { x: node.x!, y: node.y! });
			}
		}

		document.body.style.cursor = "grabbing";
		document.addEventListener("mousemove", this.handleDragMove);
		document.addEventListener("mouseup", this.handleDragEnd);
	}

	// 共通のドラッグ移動処理
	private handleDragMove = async (e: MouseEvent) => {
		if (!this.isDragging || !this.element) return;
		const parent = this.element.parentElement;
		if (!parent) return;
		const parentRect = parent.getBoundingClientRect();
		const scale =
			parent.style.transform?.match(/scale\(([\d.]+)\)/)?.[1]
				? parseFloat(parent.style.transform.match(/scale\(([\d.]+)\)/)![1])
				: 1;
		// 現在のマウス位置を取得
		const currentMouseX = (e.clientX - parentRect.left) / scale;
		const currentMouseY = (e.clientY - parentRect.top) / scale;

		// ドラッグ開始からの移動量を計算
		const deltaX = currentMouseX - this.dragOffsetX;
		const deltaY = currentMouseY - this.dragOffsetY;

		// 選択されているすべてのノードを移動
		const selectedIds = get(selectedNodeIds);

		// 選択されているノードを一括更新（異なる種類のノードも含む）
		for (const nodeId of selectedIds) {
			const node = getNodeDatabase(nodeId);
			if (node && this.isMovableNode(node)) {
				// ドラッグ開始時の初期位置を取得
				const initialPos = this.initialNodePositions.get(nodeId);
				if (!initialPos) continue;

				// 初期位置 + マウスの移動量で絶対位置を計算
				const newX = clamp(initialPos.x + deltaX, 0, CANVAS_WIDTH);
				const newY = clamp(initialPos.y + deltaY, 0, CANVAS_HEIGHT);
				const snappedX = Math.round(newX / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;
				const snappedY = Math.round(newY / GRID_SNAP_SIZE) * GRID_SNAP_SIZE;

				// ノードの種類に応じて適切な更新を行う
				await this.updateNodePosition(node, nodeId, snappedX, snappedY);
			}
		}
	};

	private handleDragEnd = (e: MouseEvent) => {
		this.isDragging = false;
		document.body.style.cursor = "";
		document.removeEventListener("mousemove", this.handleDragMove);
		document.removeEventListener("mouseup", this.handleDragEnd);
	};

	protected handleClick(e: MouseEvent): void {
		if (e.button !== 0) return;
		e.stopPropagation();

		// Ctrlキーが押されていない場合は、このノードのみを選択
		if (!e.ctrlKey) {
			selectedNodeIds.set([this.id]);
		}
	}

	private isMovableNode(node: DatabaseNode): node is FieldDatabaseNode | TextDatabaseNode {
		return node instanceof FieldDatabaseNode || node instanceof TextDatabaseNode;
	}

	private async updateNodePosition(node: DatabaseNode, nodeId: number, x: number, y: number): Promise<void> {
		console.log(x, y);

		if (node instanceof FieldDatabaseNode) {
			await get(nodeUpdater)!.update(new FieldDatabaseNode(nodeId, x, y, undefined, undefined));
		} else if (node instanceof TextDatabaseNode) {
			await get(nodeUpdater)!.update(new TextDatabaseNode(nodeId, x, y, undefined, undefined, undefined, undefined));
		} else {
			throw new Error("Unsupported node type for movement");
		}
	}

}
