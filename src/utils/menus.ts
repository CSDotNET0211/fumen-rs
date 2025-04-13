import { writable, type Writable } from "svelte/store";
import type { MenuItem, MenuItemType } from "../store";

export interface IMenu {
	type: MenuItemType;
	id: string;
	shortcut: string;
	callback: () => void;
	submenu?: MenuItem[];
	checked?: boolean;
	disabled?: boolean;
	priority: number; // Added priority property
}

export interface IMenuRegistry {
	registerMenu(menu: IMenu): void;
	getMenus(): Writable<Record<string, IMenu>>;
}

export const menus: IMenuRegistry = new class implements IMenuRegistry {
	private _menus: Writable<Record<string, IMenu>> = writable<Record<string, IMenu>>({});

	registerMenu(menu: IMenu): void {
		this._menus.update((ms) => {
			return { ...ms, [menu.id]: menu };
		});
	}

	getMenus(): Writable<Record<string, IMenu>> {
		return this._menus;
	}
};

