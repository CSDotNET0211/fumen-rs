import { get } from "svelte/store";
import { FieldDatabaseNode } from "../../../../core/nodes/DatabaseNode/fieldDatabaseNode";
import { TextDatabaseNode } from "../../../../core/nodes/DatabaseNode/textDatabaseNode";
import { deleteNodeDatabase, getAllFieldNodesDatabase, getNodeDatabase } from "../../../../core/nodes/db";
import { nodeUpdater } from "../../../../core/nodes/NodeUpdater/nodeUpdater";
import { CANVAS_HEIGHT, CANVAS_WIDTH, GRID_SNAP_SIZE, } from "../const";
import { CanvasNode } from "./canvasNode";
import { clamp } from "../util";
import type { DatabaseNode } from "../../../../core/nodes/DatabaseNode/databaseNode";
import { open } from "../contextMenu.svelte";
import { t } from "../../../../translations/translations";

export class TextCanvasNode extends CanvasNode {
	isDragging: boolean;
	dragOffsetX: number;
	dragOffsetY: number;

	constructor(id: number) {
		super(id, "text");
		this.isDragging = false;
		this.dragOffsetX = 0;
		this.dragOffsetY = 0;
	}

	render(databaseNode: DatabaseNode): void {
		if (!(databaseNode instanceof TextDatabaseNode)) {
			throw new Error("Expected TextDatabaseNode but received different type");
		}

		if (this.element) {
			// 既存の要素を更新
			if (databaseNode.text !== undefined) {
				this.element.textContent = databaseNode.text;
			}
			if (databaseNode.x !== undefined) {
				this.element.style.left = `${databaseNode.x}px`;
			}
			if (databaseNode.y !== undefined) {
				this.element.style.top = `${databaseNode.y}px`;
			}
			if (databaseNode.color !== undefined) {
				this.element.style.color = databaseNode.color;
			}
			if (databaseNode.backgroundColor !== undefined) {
				this.element.style.backgroundColor = databaseNode.backgroundColor;
			}
			if (databaseNode.size !== undefined) {
				this.element.style.fontSize = `${databaseNode.size}px`;
				this.element.style.lineHeight = `${databaseNode.size}px`;
			}
			return;
		}

		const div = document.createElement("div");
		div.className = "canvas-text confirmed";
		div.style.position = "absolute";
		div.style.left = `${databaseNode.x}px`;
		div.style.top = `${databaseNode.y}px`;
		div.style.zIndex = "10";
		div.style.color = databaseNode.color || "";
		div.style.backgroundColor = databaseNode.backgroundColor || "";
		div.style.padding = "2px 8px";
		div.style.borderRadius = "4px";
		div.style.fontSize = `${databaseNode.size}px`;
		div.style.lineHeight = `${databaseNode.size}px`;
		div.style.whiteSpace = "pre-wrap";
		div.style.pointerEvents = "auto";
		div.style.cursor = "move";
		div.style.userSelect = "none";
		div.tabIndex = 0;
		div.contentEditable = "false";
		div.spellcheck = false;
		div.textContent = databaseNode.text || "";

		// Add click handler for selection
		div.onclick = (e) => {
			e.stopPropagation();
			//selectedNodeId.set(this.id);
		};

		// イベント
		div.ondblclick = (e) => this.dblClick(e as MouseEvent);
		/*	div.oncontextmenu = (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.onRightClick(e as MouseEvent);
			};*/
		div.onmousedown = (e) => this._onMouseDown(e as MouseEvent);
		div.oncontextmenu = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.rightClick(e as MouseEvent);
		};

		this.element = div;
	}

	dblClick(e: MouseEvent): void {
		if (!this.element) return;
		this.handleTextNodeEdit(this);
		e.stopPropagation();
	}

	handleTextNodeEdit(textNode: TextCanvasNode) {
		if (!textNode.element) return;
		textNode.element.contentEditable = "true";
		textNode.element.style.userSelect = "text"; // 編集モードで選択可
		textNode.element.focus();
		//textを全選択
		const range = document.createRange();
		const selection = window.getSelection();
		range.selectNodeContents(textNode.element);
		range.collapse(false); // false means collapse to end
		selection?.removeAllRanges();
		selection?.addRange(range);

		const oldText = textNode.element.textContent || "";

		async function cleanup() {
			if (textNode.element && textNode.element.parentNode) {
				textNode.element.parentNode.removeChild(textNode.element);
			}
			// nodes配列からも削除
			await deleteNodeDatabase(getNodeDatabase(textNode.id)!);
			//TextNode.deleteDB(textNode.id);
		}

		const confirm = async () => {
			if (!textNode.element) return;
			const newText = (textNode.element.textContent || "").trim();
			if (!newText) {
				await cleanup();
				return;
			}

			//this.render(new TextDatabaseNode(textNode.id, undefined, undefined, newText, undefined, undefined, undefined));

			//	textNode.text = newText;
			textNode.element.contentEditable = "false";
			textNode.element.style.userSelect = "none";
			textNode.element.blur();
			textNode.element.className = "canvas-text confirmed";

			//console.log("confirmed text:", textNode.text);
			get(nodeUpdater)!.update(new TextDatabaseNode(textNode.id, undefined, undefined, newText, undefined, undefined, undefined));
			//TextNode.updateDB(textNode.id, textNode.x, textNode.y, textNode.size, textNode.text, textNode.color, textNode.backgroundColor);
		}
		const cancel = async () => {
			if (!textNode.element) return;
			if (oldText.trim()) {
				textNode.element.textContent = oldText;
				textNode.element.contentEditable = "false";
				textNode.element.style.userSelect = "none";
				textNode.element.className = "canvas-text confirmed";
			} else {
				await cleanup();
			}
		}

		textNode.element.addEventListener("keydown", function handler(ev) {
			if (ev.key === "Escape") {
				ev.preventDefault();
				cancel();
				textNode.element?.removeEventListener("keydown", handler);
			} else if (ev.key === "Enter" && !ev.shiftKey) {
				ev.preventDefault();
				//confirm();
				textNode.element?.blur();
				//textNode.element?.removeEventListener("keydown", handler);
			}
		});

		textNode.element.addEventListener("blur", function handler() {
			console.log("blur");
			confirm();
			textNode.element?.removeEventListener("blur", handler);
		});


	}

	rightClick(e: MouseEvent): void {
		open({
			x: e.clientX,
			y: e.clientY,
			items: [
				{
					name: get(t)("common.context-menu-duplicate"),
					action: async () => {
						const node = getNodeDatabase(this.id);
						node!.id = undefined;
						const newIndex = await get(nodeUpdater)?.create(node!)!;
						const newNode = (getNodeDatabase(newIndex) as TextDatabaseNode)!;
						get(nodeUpdater)?.update(new TextDatabaseNode(newIndex, newNode.x! + 50, newNode.y! + 50, undefined, undefined, undefined, undefined));
					}
				},
				/*
				{
					name: get(t)("context-menu-delete-connections-from"),
					action: () => {
						// Delete connections where this node is the source
						if (db) {
							db.run(`DELETE FROM connections WHERE from_id = ?;`, [this.id]);
						}
					}
				},
				{
					name: get(t)("context-menu-delete-connections-to"),
					action: () => {
						// Delete connections where this node is the target
						if (db) {
							db.run(`DELETE FROM connections WHERE to_id = ?;`, [this.id]);
						}
					}
				},*/
				{
					name: get(t)("common.context-menu-delete"),
					action: () => {
						get(nodeUpdater)?.delete(getNodeDatabase(this.id)!);
					}
				}
			]
		});
	}

	private _onMouseDown(e: MouseEvent) {
		// 編集モード中はドラッグしない
		if (this.element && this.element.isContentEditable) {
			return;
		}
		if (e.button !== 0) return;
		this.isDragging = true;
		const parent = (this.element as HTMLElement).parentElement;
		const parentRect = parent?.getBoundingClientRect();
		const scale =
			parent?.style.transform?.match(/scale\(([\d.]+)\)/)?.[1]
				? parseFloat(parent.style.transform.match(/scale\(([\d.]+)\)/)![1])
				: 1;
		// 差分移動

		const fieldNode = getNodeDatabase(this.id)! as unknown as TextDatabaseNode;
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

		await get(nodeUpdater)!.update(new TextDatabaseNode(this.id, newX, newY, undefined, undefined, undefined, undefined));
		//	this.x = newX;
		//	this.y = newY;
		//	this.element.style.left = `${newX}px`;
		//	this.element.style.top = `${newY}px`;
	};

	private _onDragEnd = (e: MouseEvent) => {
		this.isDragging = false;
		document.body.style.cursor = "";
		document.removeEventListener("mousemove", this._onDragMove);
		document.removeEventListener("mouseup", this._onDragEnd);
		// ここで保存 
		//	if ("id" in this && typeof (this as any).id === "number") {
		//		TextNode.updateDB((this as any).id, this.x, this.y, this.size, this.text, this.color, this.backgroundColor);
		//		//updateCoodinatesToMySQL((this as any).id, this.x, this.y);
		//}
	};


}
