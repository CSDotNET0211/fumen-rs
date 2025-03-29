<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { get } from "svelte/store";
	import { emitTo, type UnlistenFn } from "@tauri-apps/api/event";
	import { getCurrentWindow } from "@tauri-apps/api/window";
	import {
		boardViewContent,
		MenuItem,
		menuItems,
		MenuItemType,
		autoFillQueue,
		autoApplyField,
		BoardViewContentType,
	} from "../store.ts";
	import { t } from "../translations/translations.ts";
	import { exit } from "@tauri-apps/plugin-process";

	const title = "";

	let unlistenBlur: UnlistenFn;
	let unlistenFocus: UnlistenFn;
	let activeMenu: string | null = null;

	async function setupEventListeners() {
		const currentWindow = await getCurrentWindow();

		unlistenBlur = await currentWindow.listen("tauri://blur", () => {
			(document.querySelector(
				".panel",
			) as HTMLElement)!.style.backgroundColor = "#1f1f1f";
			document.querySelectorAll(".menu-item").forEach((button) => {
				(button as HTMLElement).style.color = "#9d9d9d";
			});

			closeMenu();
		});

		unlistenFocus = await currentWindow.listen("tauri://focus", () => {
			(document.querySelector(
				".panel",
			) as HTMLElement)!.style.backgroundColor = "#181818";
			document.querySelectorAll(".menu-item").forEach((button) => {
				(button as HTMLElement).style.color = "#cccccc";
			});
		});
	}

	async function closeWindow() {
		await exit();
	}

	async function minimizeWindow() {
		const currentWindow = await getCurrentWindow();
		await currentWindow.minimize();
	}

	function generateSubmenu(
		menuPath: string[],
		customMenuItems?: MenuItem[],
	): HTMLDivElement {
		const items = customMenuItems || get(menuItems);
		let currentMenuItems = items;

		for (const path of menuPath) {
			const menuItem = currentMenuItems.find(
				(item) => item.name === path,
			);
			if (!menuItem || !menuItem.submenu) {
				throw new Error(`Menu path ${menuPath.join(" > ")} is invalid`);
			}
			currentMenuItems = menuItem.submenu;
		}

		const subMenuTemplate = document.getElementById(
			"submenu",
		) as HTMLDivElement;
		const subMenu = subMenuTemplate.cloneNode(true) as HTMLDivElement;
		subMenu.removeAttribute("id");
		subMenu.style.display = "block";
		subMenu.onmouseenter = (e) => e.stopPropagation();
		subMenu.onmouseup = (e) => e.stopPropagation();
		subMenu.onmousedown = (e) => e.stopPropagation();
		subMenu.onmouseout = (e) => e.stopPropagation();

		currentMenuItems.forEach((subMenuItem) => {
			switch (subMenuItem.type) {
				case MenuItemType.Separator:
					const separatorTemplate = document.getElementById(
						"separator",
					) as HTMLDivElement;
					const separator = separatorTemplate.cloneNode(
						true,
					) as HTMLDivElement;
					separator.removeAttribute("id");
					separator.style.display = "";
					subMenu.appendChild(separator);
					break;
				case MenuItemType.Normal:
					if (!subMenuItem.disabled)
						subMenu.classList.remove("disabled");

					const submenuItemTemplate = document.getElementById(
						"submenu-item",
					) as HTMLDivElement;
					const subMenuItemElement = submenuItemTemplate.cloneNode(
						true,
					) as HTMLDivElement;
					subMenuItemElement.removeAttribute("id");
					subMenuItemElement.style.display = "";

					if (subMenuItem.disabled) {
						subMenuItemElement.classList.add("disabled");
					} else {
						subMenuItemElement.onclick = () => {
							subMenuItem.callback();
							closeMenu();
						};
					}
					subMenu.appendChild(subMenuItemElement);

					const title = subMenuItemElement.querySelector(
						"span:first-child",
					) as HTMLSpanElement;
					title.innerText = subMenuItem.name;

					if (subMenuItem.shortcut) {
						const shortcut = subMenuItemElement.querySelector(
							".shortcut",
						) as HTMLSpanElement;
						shortcut.innerText = subMenuItem.shortcut;
					}

					if (subMenuItem.submenu) {
						const arrow = subMenuItemElement.querySelector(
							".arrow",
						) as HTMLSpanElement;
						arrow.innerText = "▶";

						subMenuItemElement.onmouseenter = (e) => {
							const existingSubMenu =
								subMenuItemElement.querySelector(".submenu");
							if (existingSubMenu) {
								existingSubMenu.remove();
							}

							const newSubMenu = generateSubmenu(
								[...menuPath, subMenuItem.name],
								customMenuItems,
							);

							newSubMenu.style.position = "absolute";
							newSubMenu.style.top = `${subMenuItemElement.offsetTop}px`;
							newSubMenu.style.left = `${subMenuItemElement.offsetWidth}px`;
							newSubMenu.style.zIndex = "1000";
							subMenuItemElement.appendChild(newSubMenu);
						};
					}
					break;
				case MenuItemType.Toggle:
					if (!subMenuItem.disabled)
						subMenu.classList.remove("disabled");

					const toggleItemTemplate = document.getElementById(
						"submenu-item",
					) as HTMLDivElement;
					const toggleItemElement = toggleItemTemplate.cloneNode(
						true,
					) as HTMLDivElement;
					toggleItemElement.removeAttribute("id");
					toggleItemElement.style.display = "";

					if (subMenuItem.disabled) {
						toggleItemElement.classList.add("disabled");
					} else {
						toggleItemElement.onclick = () => {
							subMenuItem.checked = !subMenuItem.checked;
							subMenuItem.callback();
							closeMenu();
						};
					}
					subMenu.appendChild(toggleItemElement);

					const toggleTitle = toggleItemElement.querySelector(
						"span:first-child",
					) as HTMLSpanElement;
					toggleTitle.innerText = subMenuItem.name;

					if (subMenuItem.shortcut) {
						const toggleShortcut = toggleItemElement.querySelector(
							".shortcut",
						) as HTMLSpanElement;
						toggleShortcut.innerText = subMenuItem.shortcut;
					}

					if (subMenuItem.checked) {
						const checkmarkTemplate = document.getElementById(
							"submenu-checked",
						) as HTMLDivElement;
						const checkmark = checkmarkTemplate.querySelector(
							"img.checkmark",
						) as HTMLImageElement;
						const clonedCheckmark = checkmark.cloneNode(
							true,
						) as HTMLImageElement;
						toggleItemElement.insertBefore(
							clonedCheckmark,
							toggleTitle,
						);
					}
					break;
				default:
					throw new Error("Invalid menu item type");
			}
		});

		return subMenu;
	}

	function closeMenu() {
		activeMenu = null;
		const menuBar = document.getElementById("menu-bar") as HTMLDivElement;
		const existingSubMenu = menuBar.querySelector(".submenu");
		if (existingSubMenu) {
			existingSubMenu.remove();
		}
		document
			.querySelectorAll(".menu-item, .custom-active")
			.forEach((item) => {
				item.classList.remove("active", "custom-active");
			});
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			!(event.target as HTMLElement).closest(
				'.menu-item, .submenu, #menu-bar, .play-control-button[data-type="More"], .custom-active',
			)
		) {
			closeMenu();
		}
	}

	async function toggleMenu(
		menu: string,
		shouldOpen?: boolean,
		menuItemElement?: HTMLElement,
		customMenuItems?: MenuItem[],
	) {
		const items = customMenuItems || get(menuItems);
		const menuItem = items.filter((item) => item.name === menu)[0];

		if (!menuItem || !menuItem.submenu) {
			activeMenu = null;
			return;
		}

		const menuBar = document.getElementById("menu-bar") as HTMLDivElement;
		menuItemElement =
			menuItemElement ||
			(document.querySelector(
				`.menu-item:nth-child(${items.indexOf(menuItem) + 1})`,
			) as HTMLElement);

		if (!menuItemElement) {
			activeMenu = null;
			return;
		}

		if (shouldOpen === undefined) {
			shouldOpen = activeMenu !== menu;
		}

		if (shouldOpen) {
			const existingSubMenu = menuBar.querySelector(".submenu");
			if (existingSubMenu) {
				existingSubMenu.remove();
			}

			const subMenu = generateSubmenu([menuItem.name], customMenuItems);
			subMenu.style.display = "block";
			subMenu.style.position = "absolute";
			subMenu.style.top = `30px`;
			subMenu.style.zIndex = "1000";
			subMenu.style.visibility = "visible";

			menuBar.appendChild(subMenu);

			const rect = menuItemElement.getBoundingClientRect();
			const submenuRect = subMenu.getBoundingClientRect();
			const windowSize = await getCurrentWindow().innerSize();
			const screenWidth = windowSize?.width;
			let leftPosition = rect.left;

			if (leftPosition + submenuRect.width > screenWidth) {
				leftPosition = screenWidth - submenuRect.width - 10;
			}
			subMenu.style.left = `${leftPosition}px`;

			activeMenu = menu;

			document
				.querySelectorAll(".menu-item, .custom-active")
				.forEach((item) => {
					item.classList.remove("active", "custom-active");
				});
			menuItemElement.classList.add(
				menuItemElement.classList.contains("menu-item")
					? "active"
					: "custom-active",
			);
		} else {
			closeMenu();
		}
	}

	function playFumen() {
		boardViewContent.set(BoardViewContentType.TetrisPlay);
	}

	function stopFumen() {
		boardViewContent.set(BoardViewContentType.TetrisEdit);
	}

	function resetFumen() {
		emitTo("main", "resetgame");
	}

	function moreOptions() {
		let menu = new MenuItem(MenuItemType.Normal, "More", "", () => {}, [
			new MenuItem(
				MenuItemType.Toggle,
				$t("common.menu-auto-fill-queue"),
				"",
				() => {
					autoFillQueue.update((value) => !value);
				},
				undefined,
				get(autoFillQueue),
			),
			new MenuItem(
				MenuItemType.Toggle,
				$t("common.menu-auto-apply-field"),
				"",
				() => autoApplyField.update((value) => !value),
				undefined,
				get(autoApplyField),
			),
		]);

		const moreButton = document.querySelector(
			'.play-control-button[data-type="More"]',
		) as HTMLElement;
		toggleMenu("More", undefined, moreButton, [menu]);
	}

	onMount(() => {
		setupEventListeners();
		document.addEventListener("click", handleClickOutside);
	});

	onDestroy(() => {
		unlistenBlur();
		unlistenFocus();
		document.removeEventListener("click", handleClickOutside);
	});
</script>

<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div id="menu-bar"></div>

<!-- for copy -->
<div class="custom-active" style="display: none;"></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div
	id="submenu"
	class="submenu disabled"
	style="display: none;pointer-events: all;"
></div>
<div id="separator" class="separator" style="display: none;"></div>
<div id="submenu-item" class="submenu-item" style="display: none;">
	<span></span>
	<span class="shortcut"></span>
	<span class="arrow"></span>
</div>
<div id="submenu-checked" class="submenu-item" style="display: none;">
	<img src="checked.svg" class="checkmark" alt="checked" />
	<span></span>
	<span class="shortcut"></span>
	<span class="arrow"></span>
</div>
<div class="active" style="display: none;"></div>
<!-- end -->

<div class="panel" data-tauri-drag-region>
	<img src="128x128.png" alt="Logo" class="logo" />
	<div class="menu-items">
		{#each $menuItems as item}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="menu-item"
				onclick={() => toggleMenu(item.name)}
				onmouseenter={() => {
					if (activeMenu) {
						toggleMenu(item.name, true);
					}
				}}
			>
				{item.name}
			</div>
		{/each}
	</div>
	<div class="title" data-tauri-drag-region>{title}</div>
	<div class="play-controls">
		{#if $boardViewContent === BoardViewContentType.TetrisEdit}
			<button
				class="play-control-button"
				data-type="Play"
				onclick={playFumen}
			>
				<img src="play.svg" alt="Play" class="play-control-icon" />
			</button>
		{:else if $boardViewContent === BoardViewContentType.TetrisPlay}
			<button
				class="play-control-button"
				data-type="Reset"
				style="background-color: #57965c;"
				onclick={resetFumen}
			>
				<img src="reset.svg" alt="Reset" class="play-control-icon" />
			</button>
			<button
				class="play-control-button"
				data-type="Stop"
				style="background-color: #c94f4f;padding-bottom: 1px;"
				onclick={stopFumen}
			>
				<img src="stop.svg" alt="Stop" class="play-control-icon" />
			</button>
		{/if}
		<button
			class="play-control-button"
			data-type="More"
			onclick={moreOptions}
		>
			<img src="more.svg" alt="Pause" class="play-control-icon" />
		</button>
	</div>
	<div class="controls">
		<button
			class="control-button"
			data-type="Minimize"
			onclick={minimizeWindow}
		>
			<img src="minimize.png" alt="Minimize" class="control-icon" />
		</button>
		<button class="control-button" data-type="Close" onclick={closeWindow}>
			<img src="close.svg" alt="Close" class="control-icon" />
		</button>
	</div>
</div>

<style>
	img {
		pointer-events: none;
	}

	.panel {
		position: relative;
		display: flex;
		width: 100%;
		height: 35px;
		background-color: #181818; /* Default color */
		flex-direction: row;
		align-items: center;
		font-size: 13px;
	}
	.logo {
		width: 19px;
		margin-left: 8px;
	}
	.menu-items {
		display: flex;
		flex-direction: row;
		margin-left: 10px;
		align-items: center;
	}
	.menu-item {
		display: flex;
		align-items: center;
		padding-left: 7px;
		padding-right: 7px;
		margin-right: 2px;
		border-radius: 6px;
		position: relative;
	}
	.menu-item:hover {
		background-color: #313232;
	}
	.active {
		background-color: #313232;
	}
	.submenu {
		background-color: #1f1f1f;
		border: 1px solid #444;
		border-radius: 6px;
		padding: 5px;
		z-index: 1000;
		width: auto;
		min-width: 200px;
	}
	.submenu {
		left: 100%;
		top: 0;
	}
	.submenu-item {
		height: 15px;
		padding: 5px 10px 5px 25px;
		color: #cccccc;
		cursor: pointer;
		border-radius: 10px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 13px;
	}
	.submenu-item:hover {
		background-color: #1c7ad2;
	}
	.shortcut {
		margin-left: auto;
		padding-left: 10px;
		color: #aaaaaa;
	}
	.arrow {
		margin-left: 10px;
		color: #aaaaaa;
	}
	.separator {
		height: 1px;
		background-color: #444;
		margin: 5px 0;
	}
	.title {
		flex-grow: 1;
		text-align: center;
		color: rgb(172, 172, 172);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.controls {
		display: flex;
		flex-direction: row;
		align-items: center;
		height: 100%;
	}
	.play-controls {
		display: flex;
		flex-direction: row;
		align-items: center;
		height: 100%;
		gap: 3px;
		margin-right: 25px;
	}

	.play-control-button {
		width: 27px;
		height: 27px;
		background: none;
		border: none;
		color: #cccccc;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 7px;
	}

	.play-control-button:hover {
		background-color: #373737;
	}

	.play-control-button[data-type="Reset"]:hover {
		background-color: #4e8752 !important; /* Ensure hover color is applied */
	}
	.play-control-button[data-type="Stop"]:hover {
		background-color: #b54747 !important; /* Ensure hover color is applied */
	}

	.control-button {
		width: 45px;
		height: 100%;
		background: none;
		border: none;
		color: #cccccc;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.25s ease;
	}
	.control-button:hover[data-type="Close"] {
		background-color: #e20021;
	}
	.control-button:hover[data-type="Minimize"] {
		background-color: #373737;
	}
	.control-icon {
		width: 14px;
		height: 14px;
		transition: color 0.3s ease;
	}

	.play-control-icon {
		width: 20px;
		height: 20px;
	}

	*:focus {
		outline: none;
	}

	.custom-active {
		background-color: #313232;
	}

	.checkmark {
		width: 14px;
		height: 14px;
		margin-right: 5px;
	}

	.disabled {
		color: #666666;
		pointer-events: none;
	}
</style>
