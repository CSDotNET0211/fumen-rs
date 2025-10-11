<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { get, type Writable } from "svelte/store";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  import { t } from "../../../translations/translations.ts";
  import { exit } from "@tauri-apps/plugin-process";
  import { max } from "@tensorflow/tfjs";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { shortcuts } from "../../../core/shortcuts/shortcuts.ts";
  import { commands } from "../../../core/commands/commands.ts";
  import { MenuItem } from "./MenuItem.ts";
  import { MenuItemType } from "./MenuItemType.ts";

  const title = "";
  const translations = get(t);
  import { writable } from "svelte/store";
  import {
    autoApplyField,
    autoFillQueue,
    menuItems,
  } from "../../../app/stores/misc.ts";
  import { currentField, FieldType } from "../../windows/field/field.ts";
  import { currentWindow, WindowType } from "../../../app/stores/window.ts";
  import type { UnlistenFn } from "@tauri-apps/api/event";

  let unlistenBlur: UnlistenFn | null;
  let unlistenFocus: UnlistenFn | null;
  let activeMenu: string | null = null;

  // Add a registry to track active submenus
  const subMenuRegistry = writable<HTMLDivElement[]>([]);

  async function setupEventListeners() {
    try {
      const currentWindow = await getCurrentWindow();

      unlistenBlur = await currentWindow.listen("tauri://blur", () => {
        (document.querySelector(
          ".panel"
        ) as HTMLElement)!.style.backgroundColor = "#1f1f1f";
        document.querySelectorAll(".menu-item").forEach((button) => {
          (button as HTMLElement).style.color = "#9d9d9d";
        });

        closeMenu();
      });

      unlistenFocus = await currentWindow.listen("tauri://focus", () => {
        (document.querySelector(
          ".panel"
        ) as HTMLElement)!.style.backgroundColor = "#181818";
        document.querySelectorAll(".menu-item").forEach((button) => {
          (button as HTMLElement).style.color = "#cccccc";
        });
      });
    } catch (error) {
      console.error("Error setting up event listeners:");
    }

    document.addEventListener("click", handleClickOutside);
  }

  async function closeWindow() {
    await exit();
  }

  async function minimizeWindow() {
    const currentWindow = await getCurrentWindow();
    await currentWindow.minimize();
  }

  async function maximizeWindow() {
    const currentWindow = await getCurrentWindow();
    if (await currentWindow.isMaximized()) {
      await currentWindow.unmaximize();
    } else {
      await currentWindow.maximize();
    }
  }

  async function generateSubmenu(
    menuPath: string[],
    customMenuItems?: MenuItem[]
  ): Promise<HTMLDivElement> {
    const items = customMenuItems || get(menuItems);
    let subMenuItems = items!;
    for (const path of menuPath) {
      const menuItem = subMenuItems.find((item) => item.name === path);
      if (!menuItem || !menuItem.submenu) {
        throw new Error(`Menu path ${menuPath.join(" > ")} is invalid`);
      }
      subMenuItems = menuItem.submenu;
    }

    const subMenuTemplate = document.getElementById(
      "submenu"
    ) as HTMLDivElement;
    const subMenu = subMenuTemplate.cloneNode(true) as HTMLDivElement;
    subMenu.removeAttribute("id");
    subMenu.style.display = "block";
    subMenu.dataset.menuPath = JSON.stringify(menuPath);
    subMenu.onmouseenter = (e) => e.stopPropagation();
    subMenu.onmouseup = (e) => e.stopPropagation();
    subMenu.onmousedown = (e) => e.stopPropagation();
    subMenu.onmouseout = (e) => e.stopPropagation();

    // Register the submenu in our registry
    subMenuRegistry.update((registry) => [...registry, subMenu]);

    subMenuItems.forEach((subMenuItem) => {
      switch (subMenuItem.type) {
        case MenuItemType.Separator:
          const separatorTemplate = document.getElementById(
            "separator"
          ) as HTMLDivElement;
          const separator = separatorTemplate.cloneNode(true) as HTMLDivElement;
          separator.removeAttribute("id");
          separator.style.display = "";
          subMenu.appendChild(separator);
          break;
        case MenuItemType.Normal:
          if (!subMenuItem.disabled) subMenu.classList.remove("disabled");

          const submenuItemTemplate = document.getElementById(
            "submenu-item"
          ) as HTMLDivElement;
          const subMenuItemElement = submenuItemTemplate.cloneNode(
            true
          ) as HTMLDivElement;
          subMenuItemElement.removeAttribute("id");
          subMenuItemElement.style.display = "";

          // menuPathのインデックス1以降のオブジェクトを選択状態にする
          // menuPath[menuPath.length - 1] が現在の階層
          if (
            menuPath.length > 1 &&
            subMenuItem.name === menuPath[menuPath.length - 1]
          ) {
            subMenuItemElement.classList.add("active");
          }

          if (subMenuItem.disabled) {
            subMenuItemElement.classList.add("disabled");
          } else {
            subMenuItemElement.onclick = () => onSubMenuItemClick(subMenuItem);
          }
          subMenu.appendChild(subMenuItemElement);

          const title = subMenuItemElement.querySelector(
            "span:first-child"
          ) as HTMLSpanElement;
          title.innerText = subMenuItem.name;

          if (subMenuItem.shortcut) {
            const shortcut = subMenuItemElement.querySelector(
              ".shortcut"
            ) as HTMLSpanElement;
            shortcut.innerText = subMenuItem.shortcut;
          }

          if (subMenuItem.submenu) {
            const arrow = subMenuItemElement.querySelector(
              ".arrow"
            ) as HTMLSpanElement;
            arrow.innerText = "▶";
          }

          subMenuItemElement.onmouseenter = async (e) => {
            e.stopPropagation();

            if (subMenuItem.submenu) {
              await handleSubMenuMouseEnter(
                subMenuItemElement,
                menuPath,
                subMenuItem,
                customMenuItems
              );
            } else {
              const menuBar = document.getElementById(
                "menu-bar"
              ) as HTMLDivElement;
              const allSubmenus = menuBar.querySelectorAll(".submenu");
              const currentPathArr = [...menuPath, subMenuItem.name];
              allSubmenus.forEach((submenu) => {
                const pathStr = submenu.getAttribute("data-menu-path");

                if (!pathStr) return;
                try {
                  const pathArr = JSON.parse(pathStr);
                  // 削除条件: pathArrがcurrentPathArrのprefixでない かつ 完全一致でもない
                  let isPrefix = true;
                  for (let i = 0; i < pathArr.length; ++i) {
                    if (currentPathArr[i] !== pathArr[i]) {
                      isPrefix = false;
                      break;
                    }
                  }
                  const isSame =
                    pathArr.length === currentPathArr.length && isPrefix;
                  if (!isPrefix && !isSame) {
                    submenu.remove();
                  }
                } catch {
                  // ignore parse error
                }
              });
            }
          };

          break;
        case MenuItemType.Toggle:
          if (!subMenuItem.disabled) subMenu.classList.remove("disabled");

          const toggleItemTemplate = document.getElementById(
            "submenu-item"
          ) as HTMLDivElement;
          const toggleItemElement = toggleItemTemplate.cloneNode(
            true
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
            "span:first-child"
          ) as HTMLSpanElement;
          toggleTitle.innerText = subMenuItem.name;

          if (subMenuItem.shortcut) {
            const toggleShortcut = toggleItemElement.querySelector(
              ".shortcut"
            ) as HTMLSpanElement;
            toggleShortcut.innerText = subMenuItem.shortcut;
          }

          if (subMenuItem.checked) {
            const checkmarkTemplate = document.getElementById(
              "submenu-checked"
            ) as HTMLDivElement;
            const checkmark = checkmarkTemplate.querySelector(
              "img.checkmark"
            ) as HTMLImageElement;
            const clonedCheckmark = checkmark.cloneNode(
              true
            ) as HTMLImageElement;
            toggleItemElement.insertBefore(clonedCheckmark, toggleTitle);
          }
          break;
        default:
          throw new Error("Invalid menu item type");
      }
    });

    return subMenu;
  }

  function onSubMenuItemClick(subMenuItem: MenuItem) {
    subMenuItem.callback();
    closeMenu();
  }

  function closeMenu() {
    activeMenu = null;
    const menuBar = document.getElementById("menu-bar") as HTMLDivElement;

    // Clear all submenus using the registry
    subMenuRegistry.update((registry) => {
      registry.forEach((submenu) => {
        if (submenu.parentElement) {
          submenu.remove();
        }
      });
      return [];
    });

    document.querySelectorAll(".menu-item, .custom-active").forEach((item) => {
      item.classList.remove("active", "custom-active");
    });
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      !(event.target as HTMLElement).closest(
        '.menu-item, .submenu, #menu-bar, .play-control-button[data-type="More"], .custom-active'
      )
    ) {
      closeMenu();
    }
  }

  async function toggleMenu(
    menu: string,
    shouldOpen?: boolean,
    menuItemElement?: HTMLElement,
    customMenuItems?: MenuItem[]
  ) {
    const items = (customMenuItems || get(menuItems))!;
    const menuItem = items.filter((item) => item.name === menu)[0];

    if (!menuItem || !menuItem.submenu) {
      activeMenu = null;
      return;
    }

    const menuBar = document.getElementById("menu-bar") as HTMLDivElement;
    menuItemElement =
      menuItemElement ||
      (document.querySelector(
        `.menu-item:nth-child(${items.indexOf(menuItem) + 1})`
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

      const subMenu = await generateSubmenu([menuItem.name], customMenuItems);
      subMenu.style.display = "block";
      subMenu.style.position = "absolute";
      subMenu.style.top = `30px`;
      subMenu.style.zIndex = "1000";
      subMenu.style.visibility = "visible";

      menuBar.appendChild(subMenu);

      const rect = menuItemElement.getBoundingClientRect();
      const submenuRect = subMenu.getBoundingClientRect();
      const windowSize = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
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
          : "custom-active"
      );
    } else {
      closeMenu();
    }
  }

  function playFumen() {
    currentField.set(FieldType.TetrisPlay);
  }

  function stopFumen() {
    currentField.set(FieldType.TetrisEdit);
  }

  function resetFumen() {
    const event = new CustomEvent("resetgame");
    document.dispatchEvent(event);
  }

  function moreOptions() {
    let menu = new MenuItem("more", MenuItemType.Normal, "More", "", () => {}, [
      new MenuItem(
        "auto-fill-queue",
        MenuItemType.Toggle,
        translations("common.menu-auto-fill-queue"),
        "",
        () => {
          autoFillQueue.update((value) => !value);
        },
        undefined,
        get(autoFillQueue)
      ),
      new MenuItem(
        "auto-apply-field",
        MenuItemType.Toggle,
        translations("common.menu-auto-apply-field"),
        "",
        () => autoApplyField.update((value) => !value),
        undefined,
        get(autoApplyField)
      ),
    ]);

    const moreButton = document.querySelector(
      '.play-control-button[data-type="More"]'
    ) as HTMLElement;
    toggleMenu("More", undefined, moreButton, [menu]);
  }

  onMount(() => {
    setupEventListeners();

    // IS_WEB_MODEの取得
    // @ts-ignore
    //isWebMode = typeof window !== "undefined" && !!window.IS_WEB_MODE;
    // isWebMode = true;
  });

  onDestroy(() => {
    unlistenBlur?.();
    unlistenFocus?.();
    document.removeEventListener("click", handleClickOutside);
  });

  function openInDesktop() {
    window.open("fumenrs://", "_blank");
  }
  async function handleSubMenuMouseEnter(
    subMenuItemElement: HTMLDivElement,
    menuPath: string[],
    subMenuItem: MenuItem,
    customMenuItems?: MenuItem[]
  ) {
    // Check if this path is already in the registry
    const currentPath = [...menuPath, subMenuItem.name];
    const currentPathStr = JSON.stringify(currentPath);

    // Remove submenus that aren't in the current path
    subMenuRegistry.update((registry) => {
      return registry.filter((submenu) => {
        const pathStr = submenu.dataset.menuPath;
        if (!pathStr) return false;

        try {
          const pathArr = JSON.parse(pathStr);

          // Check if this submenu is part of the current path
          let isPartOfCurrentPath = true;
          for (
            let i = 0;
            i < Math.min(pathArr.length, currentPath.length);
            i++
          ) {
            if (pathArr[i] !== currentPath[i]) {
              isPartOfCurrentPath = false;
              break;
            }
          }

          // Keep if it's part of the path, otherwise remove
          if (!isPartOfCurrentPath) {
            if (submenu.parentElement) {
              submenu.remove();
            }
            return false;
          }
          return true;
        } catch {
          // Remove if we can't parse the path
          if (submenu.parentElement) {
            submenu.remove();
          }
          return false;
        }
      });
    });

    // Check if the exact submenu we want already exists
    let existingSubmenu: HTMLDivElement | null = null;
    const registry = get(subMenuRegistry);
    for (const submenu of registry) {
      if (submenu.dataset.menuPath === currentPathStr) {
        existingSubmenu = submenu;
        break;
      }
    }

    // If it exists, just make sure it's in the right place
    if (
      existingSubmenu &&
      existingSubmenu.parentElement !== subMenuItemElement
    ) {
      if (existingSubmenu.parentElement) {
        existingSubmenu.remove();
      }
      existingSubmenu = null;
    }

    // Only create a new submenu if we don't have one already
    if (!existingSubmenu) {
      const newSubMenu = await generateSubmenu(currentPath, customMenuItems);

      newSubMenu.style.position = "absolute";
      newSubMenu.style.top = `${subMenuItemElement.offsetTop}px`;

      // Position the submenu
      const rect = subMenuItemElement.getBoundingClientRect();
      const windowSize = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const screenWidth = windowSize?.width;

      // Temporarily append to document body to get its dimensions
      document.body.appendChild(newSubMenu);
      const submenuRect = newSubMenu.getBoundingClientRect();
      document.body.removeChild(newSubMenu);

      let leftPosition = subMenuItemElement.offsetWidth; // Check if submenu would go off screen on right side
      if (rect.left + leftPosition + submenuRect.width > screenWidth) {
        // If submenu goes off screen on right, position it to the left of the parent menu
        leftPosition = -submenuRect.width;
      }

      // Check if submenu would go off screen on left side
      if (rect.left + leftPosition < 0) {
        // If submenu would go off screen on left, adjust position
        leftPosition = subMenuItemElement.offsetWidth; // Try right side again

        // If right side also doesn't fit, center the submenu or find best position
        if (rect.left + leftPosition + submenuRect.width > screenWidth) {
          // Position in the direction with more space
          const rightSpace = screenWidth - rect.right;
          const leftSpace = rect.left;

          if (rightSpace >= leftSpace) {
            // More space on right, place as far right as possible without going off screen
            leftPosition = Math.min(
              subMenuItemElement.offsetWidth,
              screenWidth - rect.left - submenuRect.width
            );
          } else {
            // More space on left, place as far left as possible without going off screen
            leftPosition = Math.max(-submenuRect.width, -rect.left);
          }
        }
      }

      newSubMenu.style.left = `${leftPosition}px`;
      newSubMenu.style.zIndex = "1000";
      subMenuItemElement.appendChild(newSubMenu);
    }
  }

  //TODO: submenu自体はライブラリ化したい、またfor copyのやつはglobal cssで回避
</script>

<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div id="menu-bar"></div>

<!-- for copy -->
<div class="custom-active" style="display: none;"></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<!-- submenuの要素そのもの -->
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

<div class="panel" data-tauri-drag-region>
  <img src="128x128.png" alt="Logo" class="logo" />
  <div class="menu-items">
    {#each $menuItems! as item}
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

  {#if window.IS_WEB_MODE}
    <!-- window.IS_WEB_MODEがtrueの場合はデスクトップで開くボタン -->
    <button class="open-desktop-button" onclick={openInDesktop}>
      <!--{translations("common.menu-open-in-desktop")}-->
      Open in Desktop
    </button>

    <button
      class="play-control-button"
      onclick={() => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      }}
    >
      <img src="fullscreen.svg" alt="Fullscreen" class="play-control-icon" />
    </button>
  {/if}

  {#if $currentWindow == WindowType.Field && ($currentField === FieldType.TetrisEdit || $currentField === FieldType.TetrisPlay)}
    <div class="play-controls">
      {#if $currentField === FieldType.TetrisEdit}
        <button
          class="play-control-button"
          data-type="Play"
          onclick={playFumen}
        >
          <img src="play.svg" alt="Play" class="play-control-icon" />
        </button>
      {:else if $currentField === FieldType.TetrisPlay}
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
  {/if}

  {#if !window.IS_WEB_MODE}
    <!-- window.IS_WEB_MODEがtrueの場合は非表示 -->
    <div class="controls">
      <button
        class="control-button"
        data-type="Minimize"
        onclick={minimizeWindow}
      >
        <img src="minimize.png" alt="Minimize" class="control-icon" />
      </button>

      <button
        class="control-button"
        data-type="Maximize"
        onclick={maximizeWindow}
      >
        <img src="maximize.png" alt="Maximize" class="control-icon" />
      </button>

      <button class="control-button" data-type="Close" onclick={closeWindow}>
        <img src="close.svg" alt="Close" class="control-icon" />
      </button>
    </div>
  {/if}
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
    border-bottom: 1px solid #444;
    box-sizing: border-box;
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

  .control-button:hover[data-type="Maximize"] {
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

  .open-desktop-button {
    margin-left: 10px;
    padding: 4px 12px;
    background: #1c7ad2;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
    margin-right: 15px;
  }
  .open-desktop-button:hover {
    background: #155a9c;
  }
</style>
