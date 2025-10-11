import type { MenuItemType } from "./MenuItemType";

export class MenuItem {
	id: string;
	type: MenuItemType;
	name: string;
	shortcut: string;
	callback: () => void;
	submenu?: MenuItem[];
	checked: boolean;
	disabled: boolean;

	constructor(
		id: string,
		type: MenuItemType,
		name: string,
		shortcut: string,
		callback: () => void,
		submenu?: MenuItem[],
		checked?: boolean,
		disabled?: boolean
	) {
		this.id = id;
		this.type = type;
		this.name = name;
		this.shortcut = shortcut;
		this.callback = callback;
		this.submenu = submenu;
		this.checked = checked ?? false;
		this.disabled = disabled ?? false;
	}
}
