import { get } from "svelte/store";
import { isAlwaysOnTop, menuItems } from "../../../app/stores/misc";
import { commands } from "../../../core/commands/commands";
import { shortcuts } from "../../../core/shortcuts/shortcuts";
import { t } from "../../../translations/translations";
import { MenuItem } from "./MenuItem";
import { MenuItemType } from "./MenuItemType";
import { exit } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";
import { currentField, FieldType, PanelType } from "../../windows/field/field";
import { currentWindow, WindowType } from "../../../app/stores/window";
import { gameConfig } from "../../../app/stores/config";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function reloadMenuItems() {
	const translations = get(t);

	menuItems.set([
		new MenuItem(
			"file",
			MenuItemType.Normal,
			translations("common.menu-file"),
			"",
			() => { },
			[
				new MenuItem(
					"new",
					MenuItemType.Normal,
					translations("common.menu-new"),
					shortcuts.getKeyById("fumen.shortcut.new") ?? "",
					() => {
						commands.executeCommand("fumen.new", true);
					}
				),
				//	new MenuItem("file-separator-3", MenuItemType.Separator, "", "", () => { }),
				new MenuItem(
					"open",
					MenuItemType.Normal,
					translations("common.menu-open") + "...",
					shortcuts.getKeyById("fumen.shortcut.open") ?? "",
					() => {
						commands.executeCommand("fumen.open");
					}
				),
				new MenuItem("file-separator-2", MenuItemType.Separator, "", "", () => { }),
				new MenuItem(
					"save-as",
					MenuItemType.Normal,
					translations("common.menu-save-as") + "...",
					shortcuts.getKeyById("fumen.shortcut.saveas") ?? "",
					() => {
						commands.executeCommand("fumen.saveas");
					}
				),
				new MenuItem(
					"save",
					MenuItemType.Normal,
					translations("common.menu-save"),
					shortcuts.getKeyById("fumen.shortcut.save") ?? "",
					() => {
						commands.executeCommand("fumen.save");
					}
				),
				new MenuItem("file-separator-1", MenuItemType.Separator, "", "", () => { }),
				new MenuItem(
					"exit",
					MenuItemType.Normal,
					translations("common.menu-exit"),
					"Alt+F4",
					async () => {
						await exit();
					}
				),
			]
		),
		new MenuItem(
			"edit",
			MenuItemType.Normal,
			translations("common.menu-edit"),
			"",
			() => { },
			[
				new MenuItem(
					"undo",
					MenuItemType.Normal,
					translations("common.menu-undo"),
					shortcuts.getKeyById("fumen.shortcut.undo") ?? "",
					() => {
						commands.executeCommand("fumen.undo");
					}
				),
				new MenuItem(
					"redo",
					MenuItemType.Normal,
					translations("common.menu-redo"),
					shortcuts.getKeyById("fumen.shortcut.redo") ?? "",
					() => {
						commands.executeCommand("fumen.redo");
					}
				),
				new MenuItem("edit-separator-1", MenuItemType.Separator, "", "", () => { }),
				new MenuItem(
					"copy-as-fumen",
					MenuItemType.Normal,
					translations("common.menu-copy-as-fumen"),
					shortcuts.getKeyById("fumen.shortcut.copy-as-fumen") ?? "",
					() => {
						commands.executeCommand("fumen.copy-as-fumen");
					}
				),
				new MenuItem(
					"copy-as-image",
					MenuItemType.Normal,
					translations("common.menu-copy-as-image"),
					shortcuts.getKeyById("fumen.shortcut-copy-as-image") ?? "",
					() => {
						commands.executeCommand("fumen.copy-as-image");
					}
				),
				new MenuItem(
					"copy-as-gif",
					MenuItemType.Normal,
					translations("common.menu-copy-as-gif"),
					"",
					() => {
						//	overlayBoardViewContent.set(
						//		OverrideBoardViewContentType.GifExport
						//	);
					},
					undefined,
					false,
					true
				),
				new MenuItem(
					"paste",
					MenuItemType.Normal,
					translations("common.menu-paste"),
					shortcuts.getKeyById("fumen.shortcut.paste") ?? "",
					() => {
						commands.executeCommand("fumen.paste");
					}
				),
				new MenuItem("edit-separator-2", MenuItemType.Separator, "", "", () => { }),
				new MenuItem(
					"always-on-top",
					MenuItemType.Toggle,
					translations("common.menu-always-on-top"),
					"",
					async () => {
						const window = await getCurrentWindow();
						await window.setAlwaysOnTop(!get(isAlwaysOnTop));
						isAlwaysOnTop.update(v => !v);
					},
					undefined,
					get(isAlwaysOnTop)
				),
				new MenuItem("edit-separator-3", MenuItemType.Separator, "", "", () => { }),

				new MenuItem(
					"preferences",
					MenuItemType.Normal,
					translations("common.menu-preferences"),
					"",
					() =>
						currentWindow.set(WindowType.Preferences)
				),
			]
		),
		new MenuItem(
			"run",
			MenuItemType.Normal,
			translations("common.menu-run"),
			"",
			() => { },
			[
				new MenuItem(
					"start",
					MenuItemType.Normal,
					translations("common.menu-start"),
					shortcuts.getKeyById("fumen.shortcut.play") ?? "",
					() => currentField.set(FieldType.TetrisPlay)
				),
				new MenuItem(
					"stop",
					MenuItemType.Normal,
					translations("common.menu-stop"),
					shortcuts.getKeyById("fumen.shortcut.edit") ?? "",
					() => currentField.set(FieldType.TetrisEdit)
				),
			]
		),
		new MenuItem(
			"panel",
			MenuItemType.Normal,
			translations("common.menu-panel"),
			"",
			() => { },
			[
				new MenuItem(
					"panel-presets",
					MenuItemType.Normal,
					translations("common.menu-panel-preset"),
					"",
					() => { },
					[]
				),
				/*	new MenuItem(
						"panel-list",
						MenuItemType.Normal,
						translations("common.menu-panel-panels"),
						"",
						() => { }
					),*/
				new MenuItem(
					"go-panel-settings",
					MenuItemType.Normal,
					translations("common.menu-panel-settings"),
					"",
					() => {
						currentWindow.set(WindowType.Preferences);
						//所定のidまでスクロール
						setTimeout(() => {
							const panelSettings = document.getElementById("panel-left");
							if (panelSettings) {
								panelSettings.scrollIntoView({ behavior: "smooth" });
							}
						}, 100);
					}
				)
			]
		),
		new MenuItem(
			"help",
			MenuItemType.Normal,
			translations("common.menu-help"),
			"",
			() => { },
			[
				new MenuItem(
					"discord",
					MenuItemType.Normal,
					translations("common.menu-join-discord"),
					"",
					() => {
						if (window.IS_WEB_MODE) {
							window.open("https://discord.gg/F958vMFfcV", "_blank");
						} else {
							openUrl("https://discord.gg/F958vMFfcV");
						}
					}
				),
				new MenuItem(
					"github",
					MenuItemType.Normal,
					translations("common.menu-open-github"),
					"",
					() => {
						if (window.IS_WEB_MODE) {
							window.open("https://github.com/CSDotNET0211/fumen-rs", "_blank");
						} else {
							openUrl("https://github.com/CSDotNET0211/fumen-rs");
						}
					}
				),
				new MenuItem(
					"kofi",
					MenuItemType.Normal,
					translations("common.menu-support-me-on-ko-fi"),
					"",
					() => {
						if (window.IS_WEB_MODE) {
							window.open("https://ko-fi.com/csdotnet", "_blank");
						} else {
							openUrl("https://ko-fi.com/csdotnet");
						}
					}
				),
			]
		),
	]);


	const config = get(gameConfig)!;
	menuItems.update(menu => {
		if (!menu) return menu;

		// 再帰的にidでMenuItemを探す関数
		function findMenuItemById(items: MenuItem[], id: string): MenuItem | undefined {
			for (const item of items) {
				if (item.id === id) return item;
				if (item.submenu) {
					const found = findMenuItemById(item.submenu, id);
					if (found) return found;
				}
			}
			return undefined;
		}

		const panelMenu = findMenuItemById(menu, "panel-presets");
		if (panelMenu) {
			for (const [id, preset] of Object.entries(config.panelPresets?.presets!)) {
				panelMenu.submenu?.push(

					new MenuItem(
						id,
						MenuItemType.Toggle,
						id,
						"",
						() => {
							gameConfig.update(config => {
								if (!config) return config;
								config.panelPresets!.currentPreset = id;
								return config;
							});
							reloadMenuItems();
						},
						undefined,
						config.panelPresets?.currentPreset === id,
					)
				);
			}
		}
		return menu;
	});

	// PanelTypeの全種類を取得
	const panelTypes: PanelType[] = Object.values(PanelType);

	// panel-listのMenuItemを取得
	const panelListMenu = (() => {
		let found: MenuItem | undefined;
		function find(items: MenuItem[]): MenuItem | undefined {
			for (const item of items) {
				if (item.id === "panel-list") return item;
				if (item.submenu) {
					const res = find(item.submenu);
					if (res) return res;
				}
			}
			return undefined;
		}
		return find(get(menuItems)!);
	})();

	function isPanelInCurrentPresets(panel: string): boolean {
		const currentPreset = config.panelPresets?.presets[config.panelPresets.currentPreset];
		let included = currentPreset?.left.includes(panel) ||
			currentPreset?.right.includes(panel);
		return included ?? false;
	}


	if (panelListMenu && false) {
		panelListMenu.submenu = panelTypes.map(type => {
			const checked = isPanelInCurrentPresets(type);
			return new MenuItem(
				`panel-list-${type}`,
				MenuItemType.Toggle,
				type,
				"",
				() => {
					gameConfig.update(config => {
						if (!config) return config;
						if (config?.panelPresets === undefined) {
							return config;
						}

						const currentPreset = config.panelPresets!.presets[config.panelPresets!.currentPreset];

						const idx = currentPreset.right.indexOf(type as string);
						if (idx === -1) {
							currentPreset.right.push(type as string);
						} else {
							currentPreset.right.splice(idx, 1);
						}

						return config;
					});
					//commands.executeCommand("fumen.toggle-panel", type);
				},
				undefined,
				checked
			);
		});
	}

}
