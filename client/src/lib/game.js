import * as THREE from "three";
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/addons/renderers/CSS2DRenderer.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";
import { deepMerge } from "./utils";
import { io } from "socket.io-client";
import {
  DESERIALIZE_MODE,
  createWorld,
  defineQuery,
  enterQuery,
  getAllEntities,
  registerComponent,
  exitQuery,
  getEntityComponents,
} from "bitecs";
import { componentNames, Me, Position, deserialize } from "shared";
const URL =
  process.env.NODE_ENV === "production" ? undefined : "http://localhost:8080";

const meQuery = defineQuery([Me]);
const positionQuery = defineQuery([Position]);
const enteredPositionQuery = enterQuery(positionQuery);
const exitedPositionQuery = exitQuery(positionQuery);

const game = {
  // NOTE: this is the default config
  config: {
    // canvasId: "gameCanvas",
    parentDivId: "gameDiv",
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
    tickrate: 20,
    dt: 1 / 20,
    lerpRatio: 0.125,
  },

  isSetup: false,

  currentTick: 0,

  scene: undefined,
  camera: undefined,
  renderer: undefined,
  clock: undefined,
  controls: undefined,
  stats: undefined,
  labelRenderer: undefined,
  ambientLight: undefined,
  directionalLight: undefined,

  parentDiv: undefined,

  socket: undefined,

  world: undefined,
  playerId: undefined,

  keyboard: {},
  mouse: {
    x: 0,
    y: 0,
    left: false,
    right: false,
  },
  inputQueue: [], // TODO: implement input queue

  gameLoopRequestId: undefined,

  debug: {
    enabled: (window.location.search.includes("debug")),
    domElement: undefined,
    gridHelper: undefined,
    axesHelper: undefined,
    labels: {
      eids: true,
      components: false,
      componentDetails: true,
      update: function () {
        positionQuery(game.world).forEach((eid) => {
          const obj = game.scene.getObjectByName(eid);
          let textContent = "";
          if (game.debug.labels.eids)
            textContent += `eid: ${eid} ${
              eid == game.playerId ? "(you)" : ""
            }\n`;
          if (game.debug.labels.components) {
            textContent += "Components:\n";
            textContent += getEntityComponents(game.world, eid)
              .map(
                (c) =>
                  "- " +
                  componentNames.get(c) +
                  (game.debug.labels.componentDetails
                    ? "\n  " +
                      Object.values(c)
                        .map((v) => {
                          if (typeof v[eid] === "number") {
                            return v[eid].toFixed(3);
                          }
                          return v[eid];
                        })
                        .join("\n  ")
                    : ""),
              )
              .join("\n");
          }

          obj.getObjectByName("label").element.textContent = textContent;
        });
      },
    },
  },

  setup(config) {
    game.config = deepMerge(game.config, config); // overwrite default config with user config

    if (game.config.parentDivId) {
      game.parentDiv = document.getElementById(game.config.parentDivId);
    } else {
      game.parentDiv = document.body;
    }

    setupThree();
    setupDebugView();
    setupEventListeners();
    setupSocketIO();
    setupECSWorld();

    game.isSetup = true;
  },

  startGameLoop() {
    // NOTE: gameLoopRequestId is used later to cancel the game loop in cleanUp()
    game.gameLoopRequestId = window.requestAnimationFrame(gameLoop);
  },

  setDebug(enabled) {
    // game.debug.enabled = !game.debug.enabled;
    console.log("Debug mode ", game.debug.enabled ? "ON" : "OFF");
    game.debug.enabled = enabled;
    if (enabled) {
      game.debug.axesHelper.visible = true;
      game.debug.gridHelper.visible = true;
      game.debug.labels.eids = true;
      game.debug.labels.components = false;
      game.debug.labels.componentDetails = true;
      game.camera.layers.enable(1);
    } else {
      game.debug.axesHelper.visible = false;
      game.debug.gridHelper.visible = false;
      game.debug.labels.eids = false;
      game.debug.labels.components = false;
      game.debug.labels.componentDetails = false;
      game.camera.layers.disable(1);
    }
  },

  toggleDebug() {
      game.setDebug(!game.debug.enabled);
  },

  addAxesHelper(size) {
    game.debug.axesHelper = new THREE.AxesHelper(size);
    game.debug.axesHelper.name = "DebugAxesHelper";
    game.scene.add(game.debug.axesHelper);
  },

  removeAxesHelper() {
    game.scene.remove(game.scene.getObjectByName("DebugAxesHelper"));
  },

  addGridHelper(size) {
    game.debug.gridHelper = new THREE.GridHelper(size, size);
    game.debug.gridHelper.name = "DebugGridHelper";
    game.scene.add(game.debug.gridHelper);
  },

  removeGridHelper() {
    game.scene.remove(game.scene.getObjectByName("DebugGridHelper"));
  },

  subscribeToUpdates() {
    game.socket.emit("subscribe");
  },

  unsubscribeFromUpdates() {
    game.socket.emit("unsubscribe");
  },

  joinGame() {
    game.socket.emit(
      "join",
      { payload: "initialization of player" },
      (response) => {
        deserialize(game.world, response, DESERIALIZE_MODE.MAP_REPLACING);

        game.playerId = meQuery(game.world)[0];

        console.log("player joined, playerId: ", game.playerId);
      },
    );
  },

  leaveGame() {
    game.socket.emit("leave");
    game.playerId = undefined;
  },

  connectToServer() {
    game.socket.connect();
  },

  disconnectFromServer() {
    game.socket.disconnect();
  },

  toggleLabels() {},

  cleanUp() {
    window.removeEventListener("resize", onWindowResize, false);
    window.removeEventListener("keydown", onKeyDown, false);
    window.removeEventListener("keyup", onKeyUp, false);
    window.removeEventListener("mousemove", onMouseMove, false);
    window.removeEventListener("mousedown", onMouseDown, false);
    window.removeEventListener("mouseup", onMouseUp, false);
    window.removeEventListener("mouseleave", onMouseLeave, false);
    window.cancelAnimationFrame(game.gameLoopRequestId);

    game.renderer.domElement.remove();

    game.stats?.dom.remove();

    game.labelRenderer.domElement.remove();

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

  const entered = enteredPositionQuery(game.world);
  if (entered.length > 0) {
    console.log("+enter query: ", entered);
    // add threejs cube
    for (let i = 0; i < entered.length; i++) {
      const eid = entered[i];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(Position.x[eid], Position.y[eid], Position.z[eid]);
      mesh.name = eid;

      // TODO: update label content
      const playerDiv = document.createElement("div");
      playerDiv.className = "label";
      // playerDiv.style.fontFamily = "monospace";
      playerDiv.className = "font-mono text-[9px]";

      // const pos = getEntityComponents(game.world, eid)[0];
      // console.log(getWorldComponents(game.world));
      // console.log(ComponentNames[pos]);
      // console.log(pos);
      // console.log(Position);

      playerDiv.style.backgroundColor = "transparent";
      playerDiv.style.color = "white";
      playerDiv.style.whiteSpace = "pre";

      const playerLabel = new CSS2DObject(playerDiv);
      playerLabel.name = "label";
      playerLabel.position.set(0, 0, 0);
      playerLabel.center.set(0, 0);
      playerLabel.layers.set(1);
      mesh.add(playerLabel);
      // playerLabel.layers.set(0);
      // mesh.layers.enableAll();

      game.scene.add(mesh);
    }

    if (game.debug.enabled) game.debug.labels.update();
  }

  const exited = exitedPositionQuery(game.world);
  if (exited.length > 0) {
    console.log("-exit query: ", exited);
    for (let i = 0; i < exited.length; i++) {
      const eid = exited[i];
      const mesh = game.scene.getObjectByName(eid);
      mesh.remove(mesh.getObjectByName("label"));
      game.scene.remove(mesh);
    }
  }

  // TODO: do we even need a loop with fixed timestep?
  // while (accumulator >= game.config.dt) {
  //   // game logic
  //   // NOTE: Don't change these lines, needed for the game loop
  //   accumulator -= game.config.dt;
  //   game.currentTick++;
  // }

    // Update positions
    positionQuery(game.world).forEach((eid) => {

      const obj = game.scene.getObjectByName(eid);

      const newPos = new THREE.Vector3(
        Position.x[eid],
        Position.y[eid],
        Position.z[eid],
      );

      obj?.position?.lerp(newPos, game.config.lerpRatio);
    });

    if (game.debug.enabled) {
      game.debug.labels.update();
    }

  game.renderer.render(game.scene, game.camera);
  game.labelRenderer?.render(game.scene, game.camera);
  game.stats?.update();
  game.controls.update();

  // const ents = positionQuery(game.world);
  // for (let i = 0; i < ents.length; i++) {
  //   const ent = ents[i];
  //   Position.x[ent];
  // }

  if (game.playerId >= 0) {
    const inputPayload = getInputPayload();
    if (inputPayload) {
      game.socket.emit("input", inputPayload);
    }
  }

  // NOTE: gameLoopRequestId is used later to cancel the game loop in cleanUp()
  game.gameLoopRequestId = window.requestAnimationFrame(gameLoop);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getInputPayload() {
  const inputPayload = {
    x: 0,
    z: 0,
    shift: false,
    space: false,
    left: game.mouse.left,
    right: game.mouse.right,
  };

  let hasInput = false;

  if (game.keyboard.w) {
    inputPayload.x = 1;
    hasInput = true;
  }

  if (game.keyboard.s) {
    inputPayload.x = -1;
    hasInput = true;
  }

  if (game.keyboard.a) {
    inputPayload.z = -1;
    hasInput = true;
  }

  if (game.keyboard.d) {
    inputPayload.z = 1;
    hasInput = true;
  }

  if (game.keyboard[" "]) {
    inputPayload.space = true;
    hasInput = true;
  }

  if (game.keyboard.shift) {
    inputPayload.shift = true;
    hasInput = true;
  }

  if (game.mouse.left) {
    inputPayload.left = true;
    hasInput = true;
  }

  if (game.mouse.right) {
    inputPayload.right = true;
    hasInput = true;
  }

  return hasInput ? inputPayload : undefined;
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
    // canvas: document.getElementById(game.config.canvasId),
  });
  game.renderer.setSize(window.innerWidth, window.innerHeight);
  // for retina displays (macs, phones, etc.)
  game.renderer.setPixelRatio(window.devicePixelRatio);
  game.renderer.shadowMap.enabled = true;
  game.parentDiv.appendChild(game.renderer.domElement);

  game.clock = new THREE.Clock();
  // game.controls = new OrbitControls(game.camera, game.renderer.domElement);

  // ambient light which is for the whole scene
  game.ambientLight = new THREE.AmbientLight(
    game.config.ambientLight.color,
    game.config.ambientLight.intensity,
  );
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

  game.controls = new OrbitControls(game.camera, game.parentDiv);
}

function setupDebugView() {
  if (game.debug.enabled) {
    game.stats = new Stats();
    game.stats.showPanel(0);
    game.parentDiv.appendChild(game.stats.dom);

    game.addAxesHelper(10);
    game.addGridHelper(15);

    game.camera.layers.enable(1); // show label layer
  }


  game.labelRenderer = new CSS2DRenderer();
  game.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  game.labelRenderer.domElement.style.position = "absolute";
  game.labelRenderer.domElement.style.top = "0px";
  game.parentDiv.appendChild(game.labelRenderer.domElement);
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
  game.labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
  console.log("key down:", event.key);
  game.keyboard[event.key.toLowerCase()] = true;

  if (game.keyboard["shift"] && game.keyboard["control"]) {
    if (game.keyboard.d) {
      game.toggleDebug();
    }
  }

  if (game.keyboard["f12"]) {
    game.toggleDebug();
  }

  if (game.keyboard["j"]) {
    game.joinGame();
  }
}

function onKeyUp(event) {
  // console.log("key up:", event.key);
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
    deserialize(game.world, payload, DESERIALIZE_MODE.MAP_REPLACING);
    console.log(getAllEntities(game.world));
  });
}

function setupECSWorld() {
  game.world = createWorld();

  registerComponent(game.world, Position);
}

export default game;
