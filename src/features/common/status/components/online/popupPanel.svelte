<script lang="ts">
  import { get } from "svelte/store";
  import { gameConfig } from "../../../../../app/stores/config";
  import PopupPanel from "../../popupPanel.svelte";
  import {
    connectWebSocket,
    disconnectWebSocket,
    isConnected,
    isConnecting,
    joinRoomWebSocket,
    players,
    throwErrorServer,
    wsSocket,
  } from "../../../../../services/online";

  let roomName: string = "";
  let userName: string = "";

  let showCursor = true;

  function handleConnectClick(
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
  ) {
    connectWebSocket();
  }
  function handleDisconnectClick(
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
  ) {
    disconnectWebSocket();
  }

  function handleJoinRoomClick(
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
  ) {
    joinRoomWebSocket(roomName, userName);
  }
</script>

<PopupPanel title="Online">
  {#if !$isConnected}
    <button
      class="connect-button"
      onclick={handleConnectClick}
      disabled={$isConnecting}
    >
      {#if $isConnecting}
        <img src="loading.gif" alt="Loading..." style="height:100%" />
      {:else}
        Connect
      {/if}
    </button>
  {:else if $players.size === 0}
    <div class="connected-info">
      <div style="margin-bottom: 5px;">
        Server: {get(gameConfig)?.socketAddress}
      </div>
      <input
        type="text"
        placeholder="Enter Roomname"
        class="room-input"
        bind:value={roomName}
        onkeydown={(e) => e.stopPropagation()}
      />
      <input
        type="text"
        placeholder="Enter Username"
        class="username-input"
        bind:value={userName}
        onkeydown={(e) => e.stopPropagation()}
      />
      <button class="join-button" onclick={handleJoinRoomClick}
        >Join Room</button
      >
      <button class="disconnect-button" onclick={handleDisconnectClick}
        >Disconnect From Server</button
      >
    </div>
  {:else}
    <div class="room-info">
      <div class="room-header">
        <span class="room-label">Room</span>
        <span class="room-name">{roomName}</span>
      </div>
      <div class="players-header">
        <span class="players-label">Players</span>
      </div>
      <ul class="players-list">
        {#each Array.from($players) as player}
          <li class="player-card">{player.name}</li>
        {/each}
      </ul>
      <hr class="divider" />
      <label class="cursor-toggle">
        <input type="checkbox" bind:checked={showCursor} />
        Show Cursor
      </label>
      {#if import.meta.env.MODE === "development"}
        <button class="dev-button" onclick={() => throwErrorServer()}>
          Throw Error Server
        </button>
      {/if}
      <button class="leave-button" onclick={handleDisconnectClick}
        >Disconnect</button
      >
    </div>
  {/if}
</PopupPanel>

<style>
  .connect-button {
    width: 100%;
    height: 30px;
    padding: 2px;
    background-color: #007bff;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .connect-button:hover {
    background-color: #0056b3;
  }

  .icon-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .icon-button img {
    width: 14px;
  }

  .connected-info {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .room-input {
    width: calc(100% - 20px);
    padding: 8px;
    margin-bottom: 3px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .username-input {
    width: calc(100% - 20px);
    padding: 8px;
    margin-bottom: 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .join-button {
    width: 100%;
    padding: 8px;
    background-color: #28a745;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 3px;
  }

  .join-button:hover {
    background-color: #218838;
  }

  .room-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2px 0 0 0;
  }

  .room-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 10px;
  }

  .room-label {
    font-size: 0.9em;
    color: #888;
  }

  .room-name {
    font-size: 1.5em;
    font-weight: bold;
    color: #333;
  }

  .players-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .players-label {
    font-size: 1em;
    color: #555;
  }

  .players-count {
    background: #007bff;
    color: #fff;
    border-radius: 12px;
    padding: 2px 10px;
    font-weight: bold;
    font-size: 1em;
  }

  .players-list {
    list-style: none;
    padding: 0;
    margin: 0 0 12px 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .player-card {
    background: #f5f5f5;
    border-radius: 6px;
    padding: 6px 12px;
    text-align: center;
    font-size: 1.1em;
    color: #222;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .divider {
    width: 100%;
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 12px 0;
  }

  .leave-button {
    width: 100%;
    padding: 8px;
    background-color: #dc3545;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .leave-button:hover {
    background-color: #c82333;
  }

  .disconnect-button {
    width: 100%;
    padding: 8px;
    background-color: #6c757d;
    color: #d6f6f6;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .disconnect-button:hover {
    background-color: #5a6268;
  }
</style>
