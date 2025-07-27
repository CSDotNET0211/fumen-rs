<!--
  This component manages the context menu UI and logic.
  Use open({x, y, items}) to show, close() to hide.
  Items: { name, action?, submenu? }
-->

<script lang="ts" context="module">
  export interface ContextMenuItem {
    name: string;
    action?: () => void;
    disabled?: boolean;
    submenu?: ContextMenuItem[];
  }

  let menuRoot: HTMLDivElement | null = null;
  let visible = false;
  let currentItems: ContextMenuItem[] = [];
  let x = 0,
    y = 0;

  function createMenu(items: ContextMenuItem[], level = 0): HTMLDivElement {
    const menu = document.createElement("div");
    menu.className = "context-menu";
    menu.style.position = "fixed";
    menu.style.zIndex = String(9999 + level);

    items.forEach((item) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "context-menu-item";
      itemDiv.textContent = item.name;
      itemDiv.style.color = item.disabled ? "#666" : ""; // 色だけ状態で切り替え
      itemDiv.style.cursor = item.disabled ? "default" : ""; // カーソルも状態で
      if (item.disabled) {
        itemDiv.classList.add("disabled");
        itemDiv.style.pointerEvents = "none";
      }
      if (item.submenu) {
        itemDiv.classList.add("has-submenu");
        const arrow = document.createElement("span");
        arrow.className = "submenu-arrow";
        arrow.textContent = "▶";
        itemDiv.appendChild(arrow);

        let submenu: HTMLDivElement | null = null;
        itemDiv.addEventListener("mouseenter", () => {
          // Remove any existing submenu
          if (submenu) submenu.remove();
          submenu = createMenu(item.submenu!, level + 1);
          submenu.style.position = "absolute";
          submenu.style.left = "100%";
          submenu.style.top = "0";
          submenu.style.marginLeft = "2px";
          submenu.style.zIndex = String(9999 + level + 1);
          itemDiv.appendChild(submenu);

          // Adjust if out of viewport
          const rect = submenu.getBoundingClientRect();
          const winW = window.innerWidth;
          const winH = window.innerHeight;
          if (rect.right > winW) {
            submenu.style.left = "auto";
            submenu.style.right = "100%";
            submenu.style.marginLeft = "0";
            submenu.style.marginRight = "2px";
          }
          if (rect.bottom > winH) {
            submenu.style.top = "auto";
            submenu.style.bottom = "0";
          }
        });
        itemDiv.addEventListener("mouseleave", () => {
          if (submenu) {
            submenu.remove();
            submenu = null;
          }
        });
      }
      itemDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!item.disabled) {
          if (item.action) item.action();
          if (!item.submenu) close();
        }
      });
      itemDiv.addEventListener("mouseenter", () => {
        if (!item.disabled) {
          itemDiv.style.background = "#1c7ad2";
          itemDiv.style.color = "#fff";
        }
      });
      itemDiv.addEventListener("mouseleave", () => {
        if (!item.disabled) {
          itemDiv.style.background = "";
          itemDiv.style.color = "";
        }
      });
      menu.appendChild(itemDiv);
    });
    return menu;
  }

  function handleClickOutside(event: MouseEvent) {
    if (menuRoot && !menuRoot.contains(event.target as Node)) {
      close();
    }
  }

  export function open(options: {
    x: number;
    y: number;
    items: ContextMenuItem[];
  }) {
    close();
    x = options.x;
    y = options.y;
    currentItems = options.items;
    menuRoot = createMenu(currentItems, 0);
    document.body.appendChild(menuRoot);
    menuRoot.style.left = x + "px";
    menuRoot.style.top = y + "px";
    visible = true;

    // Adjust position if out of viewport
    const rect = menuRoot.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    let nx = x,
      ny = y;
    if (x + rect.width > winW) nx = winW - rect.width - 2;
    if (y + rect.height > winH) ny = winH - rect.height - 2;
    menuRoot.style.left = nx + "px";
    menuRoot.style.top = ny + "px";

    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("scroll", close, true);
      document.addEventListener("resize", close, true);
    }, 0);
  }

  export function close() {
    if (menuRoot) {
      menuRoot.remove();
      menuRoot = null;
    }
    visible = false;
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("scroll", close, true);
    document.removeEventListener("resize", close, true);
  }
</script>

<style>
  :global(.context-menu) {
    background: #232323;
    border: 1px solid #444;
    border-radius: 6px;
    min-width: 150px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    user-select: none;
    position: fixed;
  }
  :global(.context-menu-item) {
    padding: 1px 10px;
    color: #cccccc;
    cursor: pointer;
    font-size: 14px;
    border-radius: 4px;
    transition: background 0.15s;
    position: relative;
    white-space: nowrap;
  }
  :global(.context-menu-item:hover:not(.disabled)) {
    background: #1c7ad2;
    color: #fff;
  }
  :global(.context-menu-item.disabled) {
    color: #666;
    pointer-events: none;
  }
  :global(.context-menu-item.has-submenu > .submenu-arrow) {
    float: right;
    margin-left: 10px;
  }
  :global(.submenu-arrow) {
    font-size: 12px;
    margin-left: 8px;
  }
  :global(.context-menu .context-menu) {
    position: absolute;
    left: 100%;
    top: 0;
    margin-left: 2px;
    z-index: inherit;
  }
</style>
