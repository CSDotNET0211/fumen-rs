import { get } from "svelte/store";
import { TextDatabaseNode } from "../../../../core/nodes/DatabaseNode/textDatabaseNode";
import { deleteNodeDatabase, getNodeDatabase } from "../../../../core/nodes/db";
import { nodeUpdater } from "../../../../core/nodes/NodeUpdater/nodeUpdater";
import { CanvasNode } from "./canvasNode";
import type { DatabaseNode } from "../../../../core/nodes/DatabaseNode/databaseNode";

import { t } from "../../../../translations/translations";
import { selectedNodeIds } from "../canvasStore";

export class TextCanvasNode extends CanvasNode {
	constructor(id: number) {
		super(id, "text");
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

		div.ondblclick = (e) => this._dblClick(e as MouseEvent);
		div.onmousedown = (e) => super.handleMouseDown(e as MouseEvent);
		div.oncontextmenu = (e) => super.handleRightClick(e as MouseEvent);
		div.onclick = (e) => super.handleClick(e as MouseEvent);

		this.element = div;
	}

	_dblClick(e: MouseEvent): void {
		if (!this.element) return;
		this.handleTextNodeEdit(this);
		e.stopPropagation();
	}

	handleTextNodeEdit(textNode: TextCanvasNode) {
		if (!textNode.element) return;
		textNode.element.contentEditable = "true";
		textNode.element.style.userSelect = "text";
		textNode.element.focus();

		const range = document.createRange();
		const selection = window.getSelection();
		range.selectNodeContents(textNode.element);
		range.collapse(false);
		selection?.removeAllRanges();
		selection?.addRange(range);

		const oldText = textNode.element.textContent || "";

		async function cleanup() {
			if (textNode.element && textNode.element.parentNode) {
				textNode.element.parentNode.removeChild(textNode.element);
			}
			await deleteNodeDatabase(getNodeDatabase(textNode.id)!);

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
			confirm();
			textNode.element?.removeEventListener("blur", handler);
		});


	}

	/*
		private _onMouseDown(e: MouseEvent) {
			if (this.element && this.element.isContentEditable) {
				return;
			}
			this.handleMouseDown(e);
		}
	
	*/


}
