<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { ImageProcessor } from "../../imageProcessor";
  import { RandomForestClassifier as RFClassifier } from "ml-random-forest";
  import { convertFileSrc, invoke } from "@tauri-apps/api/core";
  import { hsvToPosition, imageToChunks } from "../../utils/fumenImage";

  let container: HTMLDivElement;
  let chunkArray: { h: number; s: number; v: number; color: string }[] = [];

  // Three.jsグローバル変数
  let camera: THREE.PerspectiveCamera;
  let scene: THREE.Scene;
  let renderer: THREE.WebGLRenderer;

  // カメラ移動用
  let moveForward = false;
  let moveBackward = false;
  let moveLeft = false;
  let moveRight = false;
  let moveUp = false;
  let moveDown = false;
  const moveSpeed = 0.02;

  // 視点回転用
  let isRotating = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let yaw = 0; // 水平角
  let pitch = 0; // 垂直角

  let outlineMode = false; // 球体をアウトライン表示するか
  let mouseSensitivity = 0.005; // マウス感度

  let trainFiles: FileList | null = null;
  let displayMode: "cone" | "cylinder" = "cone"; // 円錐 or 円柱

  // --- Three.js初期化 ---
  function initThree(width: number, height: number) {
    camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 500);
    camera.position.set(0, 0.5, -2);
    yaw = 0;
    pitch = 0;
    scene = new THREE.Scene();
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    document.body.appendChild(renderer.domElement);
  }

  // --- デフォルト描画（ライン・円） ---
  function addDefaultObjects() {
    // y=0からy=1までの半透明白色ライン
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
    ]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(line);

    // y=1の位置に直径1の半透明円のアウトライン
    const outlineRadius = 0.5;
    const outlineSegments = 128;
    const outlinePoints = [];
    for (let i = 0; i <= outlineSegments; i++) {
      const theta = (i / outlineSegments) * Math.PI * 2;
      outlinePoints.push(
        new THREE.Vector3(
          outlineRadius * Math.cos(theta),
          1,
          outlineRadius * Math.sin(theta)
        )
      );
    }
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(
      outlinePoints
    );
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
    const outline = new THREE.LineLoop(outlineGeometry, outlineMaterial);
    scene.add(outline);

    // y=0.5の位置に直径0.5の半透明円のアウトライン
    const outlineRadius2 = 0.25;
    const outlinePoints2 = [];
    for (let i = 0; i <= outlineSegments; i++) {
      const theta = (i / outlineSegments) * Math.PI * 2;
      outlinePoints2.push(
        new THREE.Vector3(
          outlineRadius2 * Math.cos(theta),
          0.5,
          outlineRadius2 * Math.sin(theta)
        )
      );
    }
    const outlineGeometry2 = new THREE.BufferGeometry().setFromPoints(
      outlinePoints2
    );
    const outline2 = new THREE.LineLoop(outlineGeometry2, outlineMaterial);
    scene.add(outline2);
  }

  // --- イベント登録 ---
  function registerEvents() {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    renderer.domElement.addEventListener("contextmenu", (e: any) =>
      e.preventDefault()
    );
  }

  // --- カメラの向き設定 ---
  function updateCameraDirection() {
    // yaw, pitchからカメラの向きを計算
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch)
    );
    camera.lookAt(camera.position.clone().add(dir));
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "w") moveForward = true;
    if (e.key === "s") moveBackward = true;
    if (e.key === "a") moveLeft = true;
    if (e.key === "d") moveRight = true;
    if (e.code === "Space") moveUp = true;
    if (e.shiftKey || e.key === "Shift") moveDown = true;
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.key === "w") moveForward = false;
    if (e.key === "s") moveBackward = false;
    if (e.key === "a") moveLeft = false;
    if (e.key === "d") moveRight = false;
    if (e.code === "Space") moveUp = false;
    if (!e.shiftKey && e.key === "Shift") moveDown = false;
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button === 2) {
      // 右クリック
      isRotating = true;
      // ポインタロック要求
      renderer.domElement.requestPointerLock();
      e.preventDefault();
    }
  }
  function onMouseUp(e: MouseEvent) {
    if (e.button === 2) {
      isRotating = false;
      // ポインタロック解除（ユーザー操作でしか解除できない場合あり）
      document.exitPointerLock();
      e.preventDefault();
    }
  }
  function onPointerLockChange() {
    // ポインタロックが外れたら回転停止
    if (document.pointerLockElement !== renderer.domElement) {
      isRotating = false;
    }
  }
  function onMouseMove(e: MouseEvent) {
    if (isRotating && document.pointerLockElement === renderer.domElement) {
      // movementX/Yで相対移動
      const deltaX = e.movementX;
      const deltaY = e.movementY;
      yaw -= deltaX * mouseSensitivity;
      pitch -= deltaY * mouseSensitivity;
      // 真上・真下を向けないようにピッチを制限（±85度まで）
      const maxPitch = (Math.PI / 2) * 0.95; // 約85度
      pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
    }
  }

  onMount(() => {
    invoke("test");

    console.log("mounting visualizer");
    const width = document.body.clientWidth;
    const height = document.body.clientHeight;
    initThree(width, height);
    addDefaultObjects();
    registerEvents();

    // アニメーションループ
    function animate() {
      updateCameraDirection();

      // カメラの前後左右移動（カメラの向き基準）
      const moveVec = new THREE.Vector3();
      const dir = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        0,
        Math.cos(yaw) * Math.cos(pitch)
      ).normalize();
      const right = new THREE.Vector3()
        .crossVectors(dir, new THREE.Vector3(0, 1, 0))
        .normalize();

      if (moveForward) moveVec.add(dir);
      if (moveBackward) moveVec.sub(dir);
      if (moveLeft) moveVec.sub(right);
      if (moveRight) moveVec.add(right);
      if (moveUp) moveVec.y += 1;
      if (moveDown) moveVec.y -= 1;

      if (moveVec.lengthSq() > 0) {
        moveVec.normalize().multiplyScalar(moveSpeed);
        camera.position.add(moveVec);
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    renderer.render(scene, camera);
  });

  async function onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (!file.type.startsWith("image/")) return;

    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();

    chunkArray = await imageToChunks(img, ImageProcessor);

    // stageを作成してsceneに追加
    let stage = scene.getObjectByName("stage");
    if (!stage) {
      stage = new THREE.Group();
      stage.name = "stage";
      scene.add(stage);
    }

    // stageから既存のsphereを削除
    while (stage.children.length > 0) {
      stage.remove(stage.children[0]);
    }

    for (const chunk of chunkArray) {
      const { h, s, v, color } = chunk;
      const { x, y, z } = hsvToPosition(h, s, v, displayMode);

      const geometry = new THREE.SphereGeometry(0.02, 20, 32);

      let mesh: THREE.Object3D;
      if (outlineMode) {
        const wireMaterial = new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
        });
        mesh = new THREE.Mesh(geometry, wireMaterial);
      } else {
        const material = new THREE.MeshBasicMaterial({ color });
        mesh = new THREE.Mesh(geometry, material);
      }

      mesh.position.set(x, y, z);
      stage.add(mesh);
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }

    console.log("chunkArray:", chunkArray); // 確認用
    const cloudArray = chunkArray.flatMap(({ h, s, v }) => {
      const { x, y, z } = hsvToPosition(h, s, v, displayMode);
      return [x, y, z];
    });
    console.log("cloudArray:", cloudArray); // 確認用
    let result = await invoke("guess_data", { values: cloudArray });
  }

  // 指定パスの画像群からtrainDataを生成（labelはパスの末尾フォルダ名）
  async function getTrainDataFromPath(
    path: string
  ): Promise<{ h: number; s: number; v: number; label: string }[]> {
    const files: string[] = await invoke("get_files", { path });
    // フォルダ名をlabelに
    const label = path.split(/[\\/]/).filter(Boolean).pop() ?? "";
    const trainData: { h: number; s: number; v: number; label: string }[] = [];

    for (const file of files) {
      let fileURL = await convertFileSrc(file);

      // 画像をロード
      const img = new Image();
      img.src = fileURL;
      await img.decode();

      // キャンバスで画像データ取得
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let totalR = 0,
        totalG = 0,
        totalB = 0,
        pixelCount = 0;
      for (let i = 0; i < imageData.data.length; i += 4) {
        totalR += imageData.data[i];
        totalG += imageData.data[i + 1];
        totalB += imageData.data[i + 2];
        pixelCount++;
      }
      if (pixelCount > 0) {
        const avgR = totalR / pixelCount;
        const avgG = totalG / pixelCount;
        const avgB = totalB / pixelCount;
        const { h, s, v } = ImageProcessor.convertToHsv(avgR, avgG, avgB);
        trainData.push({ h, s, v, label });
      }
    }
    return trainData;
  }

  async function onTrainClick() {
    const trainFolder = "C:\\Users\\CSDotNET\\Downloads\\train";
    const trainPath = await invoke<Record<string, string[]>>(
      "get_train_data_path",
      {
        folderPath: trainFolder,
      }
    );

    console.log("trainPath:", trainPath); // 確認用
    // const targets: string[] = [];
    const values: number[][][] = []; // A vector of vectors of vectors

    const targetIndices = Array.from(Object.keys(trainPath)).reduce(
      (acc, key, index) => {
        acc[key] = index;
        values[index] = []; // Initialize a new vector for each index
        return acc;
      },
      {} as Record<string, number>
    );

    for (const [key, value] of Object.entries(trainPath)) {
      const numericKey = targetIndices[key];

      for (const file of value) {
        const fileURL = await convertFileSrc(
          trainFolder + "\\" + key + "\\" + file
        );

        // Load the image
        const img = new Image();
        img.src = fileURL;
        img.crossOrigin = "anonymous";
        await img.decode();

        // Process the image into chunks
        const chunks = await imageToChunks(img, ImageProcessor);

        // Convert chunks to positions and push as a vector
        const chunkPositions: number[] = [];
        for (const chunk of chunks) {
          const { h, s, v } = chunk;
          const { x, y, z } = hsvToPosition(h, s, v, displayMode);
          chunkPositions.push(x, y, z);
        }
        values[numericKey] = values[numericKey].concat(chunkPositions); // Concatenate chunkPositions to the specific numeric key's vector
      }
    }

    // Convert targets to numeric indices
    // const numericTargets = targets.map((target) => targetIndices[target]);

    //console.log("targets:", numericTargets); // 確認用
    console.log("values:", values); // 確認用
    await invoke("train_data", { values });
  }

  $: if (outlineMode !== undefined) {
    // チェックボックスの状態が変わったら再描画
    // 既存の球体を消して再度onFileChangeを呼ぶことで反映
    // ファイルが未選択の場合は何もしない
    if (scene && chunkArray.length > 0) {
      // stageから既存のsphereを削除
      let stage = scene.getObjectByName("stage");
      if (!stage) {
        stage = new THREE.Group();
        stage.name = "stage";
        scene.add(stage);
      }
      while (stage.children.length > 0) {
        stage.remove(stage.children[0]);
      }
      // 再描画
      for (const chunk of chunkArray) {
        const { h, s, v, color } = chunk;
        const { x, y, z } = hsvToPosition(h, s, v, displayMode);

        const geometry = new THREE.SphereGeometry(0.02, 20, 32);
        let mesh: THREE.Object3D;
        if (outlineMode) {
          const wireMaterial = new THREE.MeshBasicMaterial({
            color,
            wireframe: true,
          });
          mesh = new THREE.Mesh(geometry, wireMaterial);
        } else {
          const material = new THREE.MeshBasicMaterial({ color });
          mesh = new THREE.Mesh(geometry, material);
        }
        mesh.position.set(x, y, z);
        stage.add(mesh);
      }
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    }
  }
</script>

<!-- 左上固定のUI全体を半透明背景付きのflexコンテナで囲む -->
<div
  style="
    position: fixed;
    top: 10px;
    margin-right: 10px;
	margin-left: 10px;
    z-index: 1000;
    display: flex;
    flex-direction: row;
    gap: 12px;
    align-items: center;
    background: rgba(255,255,255,0.3);
    border-radius: 8px;
    padding: 8px 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
	flex-wrap: wrap;
  "
>
  <input
    type="file"
    accept="image/*"
    on:change={onFileChange}
    style="background: white; border-radius: 4px;"
    tabindex="-1"
  />
  <label style="padding: 2px 6px;">
    <input type="checkbox" bind:checked={outlineMode} />
    球体アウトライン
  </label>
  <!-- 円錐/円柱切り替えボタン -->
  <label style="padding: 2px 6px;">
    <select bind:value={displayMode} style="border-radius: 4px;">
      <option value="cone">円錐</option>
      <option value="cylinder">円柱</option>
    </select>
    表示モード
  </label>
  <label
    style="padding: 2px 6px; display: flex; align-items: center; gap: 4px;"
  >
    感度
    <input
      type="range"
      min="0.001"
      max="0.02"
      step="0.001"
      bind:value={mouseSensitivity}
      style="vertical-align: middle;"
    />
    <span style="font-size: 0.9em;">{mouseSensitivity}</span>
  </label>
  <button on:click={onTrainClick} style="border-radius: 4px;"> 学習 </button>
</div>

<style>
  :global(html) {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
