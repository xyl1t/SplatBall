import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";
import { deepMerge } from "./utils";
import { io } from "socket.io-client";
const URL =
  process.env.NODE_ENV === "production" ? undefined : "http://localhost:8080";

const game = {
  // NOTE: this is the default config
  config: {
    parentDivId: undefined,
    antialias: true,
    fov: 75,
    nearPlane: 1,
    farPlane: 1000,
    ambientLight: {
      color: 0xffffff,
      intensity: 0.5,
    },
    directionalLight: {
      color: 0xffffff,
      intensity: 1,
      position: {
        x: 100,
        y: 100,
        z: 100,
      },
    },
    initialCameraPosition: {
      x: 5,
      y: 5,
      z: 5,
    },
    debug: false,
  },

  scene: undefined,
  camera: undefined,
  renderer: undefined,
  parentDiv: document.body,
  clock: undefined,
  controls: undefined,
  stats: undefined,
  ambientLight: undefined,
  directionalLight: undefined,

  socket: undefined,

  gameLoopRequestId: undefined,
  setup(config) {
    game.config = deepMerge(game.config, config); // overwrite default config with user config

    if (game.config.parentDivId) {
      game.parentDiv = document.getElementById(game.config.parentDivId);
    }

    setupThree();
    setupEventListeners();
    setupSocketIO();
  },

  startGameLoop() {
    game.gameLoopRequestId = window.requestAnimationFrame(gameLoop);
  },

  addAxesHelper(size) {
    const axesHelper = new THREE.AxesHelper(size);
    game.scene.add(axesHelper);
  },

  initPlayerOnServer() {
    game.socket.emit(
      "init",
      { payload: "initialization of player" },
      (response) => {
        console.log("server response: ", response);
      },
    );
  },

  connectToServer() {
    game.socket.connect();
  },

  disconnectFromServer() {
    game.socket.disconnect();
  },

  cleanUp() {
    window.removeEventListener("resize", onWindowResize, false);
    window.removeEventListener("keydown", onKeyDown, false);
    window.removeEventListener("keyup", onKeyUp, false);
    window.removeEventListener("mousemove", onMouseMove, false);
    window.removeEventListener("mousedown", onMouseDown, false);
    window.removeEventListener("mouseup", onMouseUp, false);
    window.removeEventListener("mouseleave", onMouseLeave, false);
    window.cancelAnimationFrame(game.gameLoopRequestId);

    game.socket.removeAllListeners();
    game.socket.disconnect();
  },
};

function gameLoop() {
  window.requestAnimationFrame(gameLoop);
  game.renderer.render(game.scene, game.camera);
  game.stats.update();
  game.controls.update();
}

function setupThree() {
  game.scene = new THREE.Scene();
  game.camera = new THREE.PerspectiveCamera(
    game.config.fov,
    window.innerWidth / window.innerHeight,
    game.config.nearPlane,
    game.config.farPlane,
  );
  game.camera.position.set(...Object.values(game.config.initialCameraPosition));

  game.renderer = new THREE.WebGLRenderer({ antialias: game.config.antialias });
  game.renderer.setSize(window.innerWidth, window.innerHeight);
  // for retina displays (macs, phones, etc.)
  game.renderer.setPixelRatio(window.devicePixelRatio);
  // gameWorld.renderer.shadowMap.enabled = true;
  game.parentDiv.appendChild(game.renderer.domElement);

  game.clock = new THREE.Clock();
  game.controls = new OrbitControls(game.camera, game.renderer.domElement);
  game.stats = Stats();
  game.parentDiv.appendChild(game.stats.dom);

  // ambient light which is for the whole scene
  game.ambientLight = new THREE.AmbientLight(
    game.config.ambientLight.color,
    game.config.ambientLight.intensity,
  );
  game.ambientLight.castShadow = true;
  game.scene.add(game.ambientLight);

  // directional light - parallel sun rays
  game.directionalLight = new THREE.DirectionalLight(
    game.config.directionalLight.color,
    game.config.directionalLight.intensity,
  );
  game.directionalLight.castShadow = true;
  game.directionalLight.position.set(
    ...Object.values(game.config.directionalLight.position),
  );
  game.scene.add(game.directionalLight);
}

function setupEventListeners() {
  window.addEventListener("resize", onWindowResize, false);
  window.addEventListener("keydown", onKeyDown, false);
  window.addEventListener("keyup", onKeyUp, false);
  window.addEventListener("mousemove", onMouseMove, false);
  window.addEventListener("mousedown", onMouseDown, false);
  window.addEventListener("mouseup", onMouseUp, false);
  window.addEventListener("mouseleave", onMouseLeave, false);
}

function onWindowResize() {
  game.camera.aspect = window.innerWidth / window.innerHeight;
  game.camera.updateProjectionMatrix();
  game.renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
  console.log("key down: ", event.key);
}

function onKeyUp(event) {
  console.log("key up: ", event.key);
}

function onMouseMove(event) {
  console.log("mouse move: ", event);
}

function onMouseDown(event) {
  console.log("mouse down: ", event);
}

function onMouseUp(event) {
  console.log("mouse up: ", event);
}

function onMouseLeave(event) {
  console.log("mouse leave: ", event);
}

function setupSocketIO() {
  game.socket = io(URL);
  game.socket.on("error", (error) => {
    console.error("socket.io connection error: ", error);
  });
}

export default game;
