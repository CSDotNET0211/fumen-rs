<script lang="ts">
  import { get } from "svelte/store";
  import { gameConfig } from "../../../../../app/stores/config";
  import PopupPanel from "../../popupPanel.svelte";
  import {
    connectWS,
    disconnectWS,
    isConnected,
    isConnecting,
    joinRoomWS,
    players,
    throwErrorServer,
    wsSocket,
  } from "../../../../../services/online";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { invoke } from "@tauri-apps/api/core";

  async function loginWithGithub() {
    const port = get(gameConfig)!.serverPort!;
    // サーバーが起動していなければ起動
    try {
      await invoke("start_axum_server", { port });
    } catch (e) {
      // 既に起動している場合は無視
    }
    // 認証画面へ
    await openUrl(
      `https://github.com/login/oauth/authorize?client_id=Ov23liweYTHubEWoeEej&redirect_uri=http://localhost:${port}/callback`
    );
    // 認証後は必ずサーバーを停止
    await invoke("stop_axum_server");
  }
</script>

<PopupPanel title="Login">
  <button
    class="login-github-button"
    disabled={$isConnecting}
    on:click={loginWithGithub}
  >
    Login via Github
  </button>
</PopupPanel>

<style>
  .login-github-button {
    width: 100%;
    height: 30px;
    padding: 2px;
    background-color: #007bff;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .login-github-button:hover {
    background-color: #0056b3;
  }
</style>
