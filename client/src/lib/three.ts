import * as THREE from "three";
import { Game } from "./game";
import { OutlineEffect } from "three/examples/jsm/Addons.js";

export default function setupThree(game: Game) {
  game.renderer = setupRenderer(game.cfg.antialias);
  game.cfg.parentDomElement.appendChild(game.renderer.domElement);

  game.scene = new THREE.Scene();
  game.camera = setupCamera(game);
  setupBasicScene(game);

  const outlineRenderer = new OutlineEffect(game.renderer);
  game.outlineRenderer = outlineRenderer;
  game.outlineScene = new THREE.Scene();
  game.outlineRenderer.autoClear = true;
}

export function setupRenderer(antialias: boolean): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  return renderer;
}

export function setupCamera(game: Game) {
  const camera = new THREE.PerspectiveCamera(
    game.cfg.fov,
    window.innerWidth / window.innerHeight,
    game.cfg.nearPlane,
    game.cfg.farPlane,
  );

  camera.position.set(
    game.cfg.initialCameraPosition.x,
    game.cfg.initialCameraPosition.y,
    game.cfg.initialCameraPosition.z,
  );

  camera.layers.enable(1);
  camera.layers.enable(2);

  return camera;
}

export function setupBasicScene(game: Game) {
  if (!game.scene) {
    throw new Error("Scene not initialized");
  }

  const ambientLight = new THREE.AmbientLight(
    game.cfg.ambientLight.color,
    game.cfg.ambientLight.intensity,
  );
  game.scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(
    game.cfg.directionalLight.color,
    game.cfg.directionalLight.intensity,
  );
  directionalLight.castShadow = true;
  directionalLight.position.set(
    game.cfg.directionalLight.position.x,
    game.cfg.directionalLight.position.y,
    game.cfg.directionalLight.position.z,
  );
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -50;
  directionalLight.shadow.camera.right = 50;
  directionalLight.shadow.camera.top = 50;
  directionalLight.shadow.camera.bottom = -50;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  game.scene.add(directionalLight);

  // const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
  game.scene.add(hemiLight);

  if (game.cfg.skyboxPath) {
    const backgroundTexture = textureLoader.load(game.cfg.skyboxPath);
    backgroundTexture.mapping = THREE.EquirectangularReflectionMapping;
    backgroundTexture.colorSpace = THREE.SRGBColorSpace;
    game.scene.background = backgroundTexture;
  }
}

const textureLoader = new THREE.TextureLoader();
