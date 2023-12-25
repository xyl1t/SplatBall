import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";
import { deepMerge } from "./utils";
import { io } from "socket.io-client";
import { createWorld, defineDeserializer, defineQuery, registerComponent } from "bitecs";
import { Position } from "shared";
const URL =
  process.env.NODE_ENV === "production" ? undefined : "http://localhost:8080";

const positionQuery = defineQuery([Position]);

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
    tickrate: 30,
    dt: 1 / 30,
    debug: false,
  },

  isSetup: false,
  debug: (window.DEBUG = window.location.search.includes("debug")),

  currentTick: 0,

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

  world: undefined,
  deserialize: undefined,

  keyboard: {},
  mouse: {
    x: 0,
    y: 0,
    left: false,
    right: false,
  },
  inputQueue: [], // TODO: implement input queue
  gameLoopRequestId: undefined,

  setup(config) {
    game.config = deepMerge(game.config, config); // overwrite default config with user config

    if (game.config.parentDivId) {
      game.parentDiv = document.getElementById(game.config.parentDivId);
    }

    setupThree();
    setupEventListeners();
    setupSocketIO();
    setupECSWorld();

    game.isSetup = true;
  },

  startGameLoop() {
    // NOTE: gameLoopRequestId is used later to cancel the game loop in cleanUp()
    game.gameLoopRequestId = window.requestAnimationFrame(gameLoop);
  },

  addAxesHelper(size) {
    game.scene.add(new THREE.AxesHelper(size));
  },

  removeAxesHelper() {
    game.scene.remove(game.scene.getObjectByName("AxesHelper"));
  },

  addGridHelper(size) {
    game.scene.add(new THREE.GridHelper(size, size));
  },

  removeGridHelper() {
    game.scene.remove(game.scene.getObjectByName("GridHelper"));
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

    game.stats.dom.remove();

    game.socket.removeAllListeners();
    if (game.socket.connected) {
      game.socket.disconnect();
    }
  },
};

let oldTime = 0;
let accumulator = 0;
function gameLoop(currentTime = 0) {
  currentTime /= 1000; // convert from ms to seconds
  const frameTime = currentTime - oldTime;
  oldTime = currentTime;
  accumulator += frameTime;

  while (accumulator >= game.config.dt) {
    // TODO: put the rendering outside of the tick rate,
    // rendering shouldn't be restricted to the tick rate
    game.renderer.render(game.scene, game.camera);
    game.stats.update();
    game.controls.update();

    const ents = positionQuery(game.world);
    for (let i = 0; i < ents.length; i++) {
      const ent = ents[i];
      Position.x[ent];

    }

    if (game.keyboard.f) {
      game.socket.emit("input", {
        addCube: true,
      });
    }

    // NOTE: Don't change these lines, needed for the game loop
    accumulator -= game.config.dt;
    game.currentTick++;
  }

  // NOTE: gameLoopRequestId is used later to cancel the game loop in cleanUp()
  game.gameLoopRequestId = window.requestAnimationFrame(gameLoop);
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

  game.renderer = new THREE.WebGLRenderer({
    antialias: game.config.antialias,
    canvas: document.getElementById("gameCanvas"),
  });
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
  console.log("key down:", event.key);
  game.keyboard[event.key.toLowerCase()] = true;

  if (game.keyboard["shift"] && game.keyboard["control"]) {
    if (game.keyboard.d) {
      game.debug = !game.debug;
      console.log("debug: ", game.debug);
    }
  }
}

function onKeyUp(event) {
  console.log("key up:", event.key);
  game.keyboard[event.key.toLowerCase()] = false;
}

function onMouseMove(event) {
  // console.log("mouse move: ", event);

  // game.mouse.oldX = game.mouse.x;
  // game.mouse.oldY = game.mouse.y;
  game.mouse.x = event.pageX - game.renderer.domElement.offsetLeft;
  game.mouse.y = event.pageY - game.renderer.domElement.offsetTop;
  // const dx = game.mouse.x - game.windowWidth / 2;
  // const dy = game.mouse.y - game.windowHeight / 2;
  // game.mouse.oldAngle = game.mouse.angle;
  // game.mouse.angle = Math.atan2(dy, dx);
  game.mouse.left = (event.buttons & 1) == 1;
  game.mouse.right = (event.buttons & 2) == 2;
}

function onMouseDown(event) {
  // console.log("mouse down: ", event);
  game.mouse.x = event.pageX - game.renderer.domElement.offsetLeft;
  game.mouse.y = event.pageY - game.renderer.domElement.offsetTop;
  game.mouse.left = (event.buttons & 1) == 1;
  game.mouse.right = (event.buttons & 2) == 2;
}

function onMouseUp(event) {
  // console.log("mouse up: ", event);
  game.mouse.x = event.pageX - game.renderer.domElement.offsetLeft;
  game.mouse.y = event.pageY - game.renderer.domElement.offsetTop;
  game.mouse.left = (event.buttons & 1) == 1;
  game.mouse.right = (event.buttons & 2) == 2;
}

function onMouseLeave(event) {
  // console.log("mouse leave: ", event);
  game.mouse.x = event.pageX - game.renderer.domElement.offsetLeft;
  game.mouse.y = event.pageY - game.renderer.domElement.offsetTop;
  game.mouse.left = false;
  game.mouse.right = false;
}

function setupSocketIO() {
  game.socket = io(URL);
  game.socket.on("error", (error) => {
    console.error("socket.io connection error: ", error);
  });

  game.socket.on("update", (payload) => {
    game.deserialize(game.world, payload);
    console.log(game.world);
  });
}

function setupECSWorld() {
  game.world = createWorld();
  game.deserialize = defineDeserializer(game.world);

  registerComponent(game.world, Position);
}

export default game;
