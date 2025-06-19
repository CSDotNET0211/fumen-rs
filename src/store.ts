import { get, writable } from 'svelte/store';
import type { TetrisEnv } from 'tetris/src/tetris_env';
import { History } from './history';
import { GameConfig } from './gameConfig';
import type { TeachableMachine } from './teachableMachine';


export enum BoardViewContentType {
	TetrisEdit,
	TetrisPlay,
	None,
}

export enum OverrideBoardViewContentType {
	None,
	TetrominoSelectNext,
	TetrominoSelectHold,
	ImportFumenText,
	GifExport,
	Preferences,
	ImportImage
}


export enum MenuItemType {
	Normal,
	Separator,
	Toggle,
}

export enum GameModeType {
	Tetris,
	PuyoPuyo
}

export class MenuItem {
	type: MenuItemType;
	name: string;
	shortcut: string;
	callback: () => void;
	submenu?: MenuItem[];
	checked: boolean;
	disabled: boolean;

	constructor(
		type: MenuItemType,
		name: string,
		shortcut: string,
		callback: () => void,
		submenu?: MenuItem[],
		checked?: boolean,
		disabled?: boolean
	) {
		this.type = type;
		this.name = name;
		this.shortcut = shortcut;
		this.callback = callback;
		this.submenu = submenu;
		this.checked = checked ?? false;
		this.disabled = disabled ?? false;
	}
}


export class SnapshotData {
	env: TetrisEnv;
	thumbnail: string;
	title: string;

	constructor(env: TetrisEnv, thumbnail: string, title: string) {
		this.env = env;
		this.thumbnail = thumbnail;
		this.title = title;
	}
}

export class WindowPreset {
	rightComponents: string[];
	leftComponents: string[];
	constructor(rightComponents: string[] = [], leftComponents: string[] = []) {
		this.rightComponents = rightComponents;
		this.leftComponents = leftComponents;
	}


}

//TetrisかPuyo
export const gameMode = writable<GameModeType>(GameModeType.Tetris);
//表示するメニューの項目
export const menuItems = writable<MenuItem[]>([]);

export const selectedMino = writable(0);

//オンラインの際に再帰更新に陥るのを防ぐ
export const suppressFieldUpdateNotification = writable(true);
//Board部分に表示されるコンテンツ
export const boardViewContent = writable<BoardViewContentType>(BoardViewContentType.TetrisEdit);
//Board部分のオーバーレイコンテンツ
export const overlayBoardViewContent = writable<OverrideBoardViewContentType>(OverrideBoardViewContentType.None);
//フィールドの状態
export const fields = writable<TetrisEnv[]>([]);
export const fieldIndex = writable(-1);
export const gameConfig = writable<GameConfig | null>(null);
export const history = writable<History>(new History());
//export const currentMousePosition = writable<{ x: number; y: number } | null>(null);
export const autoFillQueue = writable<boolean>(false);
export const autoApplyField = writable<boolean>(true);
export const openedNotificationPanel = writable<string | null>(null);
export const teachableMachineModel = writable<TeachableMachine | null>(null);
export const snapshot = writable<SnapshotData[]>([]);
//ショートカットとプレイのキーコンがかぶった際の対処
export const shortcutTriggered = writable(false);
export const windowPresets = writable<WindowPreset[]>([]);

//任意の変数を登録します
const globalState = writable<Record<string, any>>({});
