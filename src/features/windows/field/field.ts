import { writable } from "svelte/store";
import TetrisPlay from "./fields/tetrisPlay/tetrisPlay.svelte";
import TetrisEdit from "./fields/tetrisEdit/tetrisEdit.svelte";
import TetrisBlockSelect from "./panels/tetrisBlockSelect.svelte";
import TetrominoSelect from "./overlays/tetrominoSelect.svelte";
import TetrisNext from "./panels/tetrisNext.svelte";
import TetrisHold from "./panels/tetrisHold.svelte";
import TetrisBoardEdit from "./panels/tetrisBoardEdit.svelte";
import TetrisBot from "./panels/tetrisBot.svelte";
import TetrisSnapshot from "./panels/tetrisSnapshot.svelte";
import FumenImport from "./overlays/fumenImport.svelte";
import ImageImport from "./overlays/imageImport.svelte";
import CanvasSwap from "./panels/canvasSwap.svelte";

export enum FieldType {
	None,
	TetrisEdit,
	TetrisPlay
}

const Fields: Map<FieldType, any> = new Map();
const _fieldComponent = writable<any>(null);

export let currentField = writable<FieldType>(FieldType.None);
export const fieldComponent = {
	subscribe: _fieldComponent.subscribe,
};

export async function initializeFields(): Promise<void> {
	Fields.set(FieldType.TetrisPlay, TetrisPlay);
	Fields.set(FieldType.TetrisEdit, TetrisEdit);
}

currentField.subscribe(async (fieldType: FieldType) => {
	if (fieldType !== FieldType.None && Fields.has(fieldType)) {
		_fieldComponent.set(Fields.get(fieldType));
	} else {
		_fieldComponent.set(null);
	}
});

//-----
export enum OverlayFieldType {
	None,
	TetrominoSelectHold,
	TetrominoSelectNext,
	ImageImport,
	FumenImport,
}

const OverlayFields: Map<OverlayFieldType, any> = new Map();
const _overlayFieldComponent = writable<any>(null);

export let currentOverlayField = writable<OverlayFieldType>(OverlayFieldType.None);
export const overlayFieldComponent = {
	subscribe: _overlayFieldComponent.subscribe,
};

export async function initializeOverlayFields(): Promise<void> {
	OverlayFields.set(OverlayFieldType.None, null);
	OverlayFields.set(OverlayFieldType.TetrominoSelectHold, TetrominoSelect);
	OverlayFields.set(OverlayFieldType.TetrominoSelectNext, TetrominoSelect);
	OverlayFields.set(OverlayFieldType.ImageImport, ImageImport);
	OverlayFields.set(OverlayFieldType.FumenImport, FumenImport);
}
currentOverlayField.subscribe(async (overlayFieldType: OverlayFieldType) => {

	if (overlayFieldType !== OverlayFieldType.None && OverlayFields.has(overlayFieldType)) {
		_overlayFieldComponent.set(OverlayFields.get(overlayFieldType));
	} else {
		_overlayFieldComponent.set(null);
	}
});

//-----

export enum PanelType {
	TetrisBlockSelect = "TetrisBlockSelect",
	TetrisNext = "TetrisNext",
	TetrisHold = "TetrisHold",
	Snapshot = "Snapshot",
	TetrisFieldEditor = "TetrisFieldEditor",
	BotSuggestions = "BotSuggestions",
	CanvasSwap = "CanvasSwap"
}

//TODO: これ公開するより関数で取得できるようにした方がいい
export const Panels: Map<PanelType, any> = new Map();
export async function initializePanels(): Promise<void> {
	Panels.set(PanelType.TetrisBlockSelect, TetrisBlockSelect);
	Panels.set(PanelType.TetrisNext, TetrisNext);
	Panels.set(PanelType.TetrisHold, TetrisHold);
	Panels.set(PanelType.TetrisFieldEditor, TetrisBoardEdit);
	Panels.set(PanelType.BotSuggestions, TetrisBot);
	Panels.set(PanelType.Snapshot, TetrisSnapshot);
	Panels.set(PanelType.CanvasSwap, CanvasSwap);
}