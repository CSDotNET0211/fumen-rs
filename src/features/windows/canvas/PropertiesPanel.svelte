<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { TextNode, FieldNode, type Node } from "./node";
  import { selectedNodeId } from "./selectionStore";

  let objects: Array<{ id: number; type: string; node?: Node }> = [];
  let selectedNode: Node | null = null;
  let isVisible = true;
  let isExpanded = false;

  // Properties for TextNode
  let textContent = "";
  let fontSize = 16;
  let textColor = "#ffffff";
  let backgroundColor = "transparent";

  // Reactive statement to load properties when selectedNodeId changes
  $: if ($selectedNodeId !== null) {
    const obj = objects.find((o) => o.id === $selectedNodeId);
    if (obj && obj.node) {
      selectedNode = obj.node;
      loadProperties();
    }
  } else {
    selectedNode = null;
  }

  function refreshObjectList() {
    console.log("Refreshing object list");
    const textNodes = TextNode.getAllFromDB().map((item) => ({
      id: item.id,
      type: "Text",
      node: new TextNode(item.id, item.x, item.y, item.text, item.size),
    }));

    const fieldNodes = FieldNode.getAllFromDB()
      .map((item) => ({
        id: item.id,
        type: "Field",
        node:
          item.x !== null && item.y !== null
            ? new FieldNode(item.x, item.y, item.id, item.thumbnail || "")
            : null,
      }))
      .filter((item) => item.node !== null);

    objects = [...textNodes, ...fieldNodes].filter(
      (item) => item.node !== null
    );

    // Update selected object if one is currently selected
    const currentSelectedId = $selectedNodeId;
    if (currentSelectedId !== null) {
      const updatedObj = objects.find((o) => o.id === currentSelectedId);
      if (updatedObj && updatedObj.node) {
        selectedNode = updatedObj.node;
        loadProperties();
      } else {
        // Selected object no longer exists, clear selection
        selectedNode = null;
        selectedNodeId.set(null);
      }
    }
  }

  function selectObject(id: number) {
    selectedNodeId.set(id);
    const obj = objects.find((o) => o.id === id);
    if (obj && obj.node) {
      selectedNode = obj.node;
      loadProperties();
    }
  }

  function loadProperties() {
    if (selectedNode instanceof TextNode) {
      textContent = selectedNode.text;
      fontSize = selectedNode.size;
      textColor = selectedNode.color;
      backgroundColor = selectedNode.backgroundColor;
    }
  }

  function updateTextProperties() {
    if (selectedNode instanceof TextNode) {
      selectedNode.text = textContent;
      selectedNode.size = fontSize;
      selectedNode.color = textColor;
      selectedNode.backgroundColor = backgroundColor;
      TextNode.updateDB(
        selectedNode.id,
        selectedNode.getX(),
        selectedNode.getY(),
        fontSize,
        textContent,
        textColor,
        backgroundColor
      );
      selectedNodeId.set(selectedNode.id);
    }
  }

  function handleNodeChanged(event: Event) {
    refreshObjectList();
  }

  onMount(() => {
    refreshObjectList();
    document.addEventListener("textNodeChanged", handleNodeChanged);
    document.addEventListener("fieldNodeChanged", handleNodeChanged);
  });

  onDestroy(() => {
    document.removeEventListener("textNodeChanged", handleNodeChanged);
    document.removeEventListener("fieldNodeChanged", handleNodeChanged);
  });
</script>

<div class="properties-dock" class:collapsed={!isExpanded}>
  <div class="dock-tab" on:click={() => (isExpanded = !isExpanded)}>
    <div class="tab-icon">📋</div>
    {#if isExpanded}
      <span class="tab-text">Properties</span>
    {/if}
  </div>

  {#if isExpanded}
    <div class="dock-content">
      <!-- Object List Section -->
      <div class="section">
        <h4>Objects</h4>
        <div class="object-list">
          {#each objects as obj}
            <div
              class="object-item"
              class:selected={$selectedNodeId === obj.id}
              on:click={() => selectObject(obj.id)}
              role="button"
              tabindex="0"
            >
              <span class="object-id">#{obj.id}</span>
              <span class="object-type">{obj.type}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Properties Section -->
      {#if selectedNode}
        <div class="section">
          <h4>Properties</h4>

          {#if selectedNode instanceof TextNode}
            <div class="property-group">
              <label>
                Text Content:
                <textarea
                  bind:value={textContent}
                  on:input={updateTextProperties}
                  rows="3"
                  spellcheck="false"
                ></textarea>
              </label>

              <label>
                Font Size:
                <input
                  type="number"
                  bind:value={fontSize}
                  on:input={updateTextProperties}
                  min="8"
                  max="72"
                  spellcheck="false"
                />
              </label>

              <label>
                Text Color:
                <input
                  type="color"
                  bind:value={textColor}
                  on:input={updateTextProperties}
                  spellcheck="false"
                />
              </label>

              <label>
                Background Color:
                <input
                  type="color"
                  bind:value={backgroundColor}
                  on:input={updateTextProperties}
                  spellcheck="false"
                />
              </label>
            </div>
          {:else if selectedNode instanceof FieldNode}
            <div class="property-group">
              <label>
                ID: {selectedNode.id}
              </label>
              <label>
                Position: ({selectedNode.getX()}, {selectedNode.getY()})
              </label>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .properties-dock {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    background: rgba(30, 30, 30, 0.15);
    border-left: 1px solid rgba(85, 85, 85, 0.3);
    backdrop-filter: blur(24px);
    z-index: 1000;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    color: #fff;
    display: flex;
    flex-direction: row;
    transition: width 0.3s ease;
    width: 320px;
  }

  .properties-dock.collapsed {
    width: 60px;
  }

  .dock-tab {
    width: 60px;
    height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(40, 40, 40, 0.1);
    border-bottom: 1px solid rgba(85, 85, 85, 0.3);
    cursor: pointer;
    transition: background-color 0.2s;
    backdrop-filter: blur(24px);
    flex-shrink: 0;
  }

  .dock-tab:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .tab-icon {
    font-size: 18px;
    margin-bottom: 4px;
  }

  .tab-text {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: #aaa;
    text-align: center;
    line-height: 1;
  }

  .dock-content {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    max-height: 100vh;
  }

  .section {
    margin-bottom: 20px;
  }

  .section h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: #aaa;
  }

  .object-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid rgba(85, 85, 85, 0.3);
    border-radius: 4px;
  }

  .object-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid rgba(68, 68, 68, 0.5);
    transition: background-color 0.15s;
  }

  .object-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .object-item.selected {
    background: rgba(0, 120, 255, 0.3);
    border-color: rgba(0, 120, 255, 0.5);
  }

  .object-item:last-child {
    border-bottom: none;
  }

  .object-id {
    font-family: monospace;
    font-size: 11px;
    color: #888;
  }

  .object-type {
    font-size: 12px;
    font-weight: 500;
  }

  .property-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .property-group label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .property-group input,
  .property-group textarea {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(85, 85, 85, 0.5);
    border-radius: 4px;
    padding: 6px 8px;
    color: #fff;
    font-size: 12px;
  }

  .property-group input:focus,
  .property-group textarea:focus {
    outline: none;
    border-color: #0078ff;
  }

  .property-group input[type="color"] {
    height: 32px;
    padding: 2px;
    cursor: pointer;
  }

  .property-group input[type="number"] {
    width: 80px;
  }

  .property-group textarea {
    resize: vertical;
    min-height: 60px;
  }
</style>
