import type { ISerializable } from "../core/interfaces/ISerializable";
import { PanelType } from "../features/windows/field/field";


// PanelPresetSettings型を追加
type PanelPresetList = Record<string, {
	left: string[];
	right: string[];
}>;

export class PanelPresets {
	currentPreset: string;
	presets: PanelPresetList;

	constructor(name: string, settings: PanelPresetList = {}) {
		this.currentPreset = name;
		this.presets = settings;
	}
	static getDefault(): PanelPresets {
		return new PanelPresets("Default", {
			Default: {
				right: [PanelType.TetrisNext, PanelType.TetrisBlockSelect, PanelType.Snapshot].map(String),
				left: [PanelType.TetrisHold, PanelType.BotSuggestions].map(String)
			},
			Advanced: {
				right: [PanelType.TetrisNext, PanelType.TetrisBlockSelect, PanelType.Snapshot].map(String),
				left: [PanelType.TetrisHold, PanelType.BotSuggestions, PanelType.TetrisFieldEditor, PanelType.CanvasSwap].map(String)
			}
		});
	}

	serialize(): string {
		return JSON.stringify({
			name: this.currentPreset,
			settings: this.presets,
		});
	}

	deserialize(data: string): this {
		const obj = JSON.parse(data);
		this.currentPreset = obj.name;
		this.presets = obj.settings;
		return obj;
	}
}