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
  hasComponent,
} from "bitecs";
import {
  componentNames,
  Me,
  Position,
  deserialize,
  Box,
  Color,
  DisplayCollider,
  Quaternion,
  PhysicsBody,
  Sphere,
} from "shared";
const URL =
  process.env.NODE_ENV === "production" ? undefined : "http://localhost:8080";

const queryMe = defineQuery([Me]);

const queryPosition = defineQuery([Position]);

const queryPhysicsBody = defineQuery([PhysicsBody]);
const queryPhysicsBodyEnter = enterQuery(queryPhysicsBody);
const queryPhysicsBodyExit = exitQuery(queryPhysicsBody);

const queryDisplayCollider = defineQuery([DisplayCollider]);
const queryColliderEnter = enterQuery(queryDisplayCollider);
const queryColliderExit = exitQuery(queryDisplayCollider);

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
    lerpRatio: 0.5,
  },

  isSetup: false,
  isSubscribed: false,

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
  keyCode: {},
  mouse: {
    x: 0,
    y: 0,
    left: false,
    right: false,
  },
  //inputQueue: [], // TODO: implement input queue? maybe?

  gameLoopRequestId: undefined,

  debug: {
    propertyListeners: [],
    enabled: window.location.search.includes("debug"),
    domElement: undefined,
    gridHelper: undefined,
    axesHelper: undefined,
    colliderWireframes: false,
    labels: {
      eids: true,
      components: false,
      componentDetails: true,
      update: function () {
        queryPosition(game.world).forEach((eid) => {
          const obj = game.scene.getObjectByName(eid);
          if (!obj) return;

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
    setupDebugListeners();

    game.isSetup = true;
  },

  startGameLoop() {
    // NOTE: gameLoopRequestId is used later to cancel the game loop in cleanUp()
    game.gameLoopRequestId = window.requestAnimationFrame(gameLoop);
  },

  setDebug(isEnabled) {
    // game.debug.enabled = !game.debug.enabled;
    console.log("Debug mode ", game.debug.enabled ? "ON" : "OFF");
    game.debug.enabled = isEnabled;
    if (isEnabled) {
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
    game.isSubscribed = true;
  },

  unsubscribeFromUpdates() {
    game.socket.emit("unsubscribe");
    game.isSubscribed = false;
  },

  joinGame() {
    game.isSubscribed = true;
    game.socket.emit(
      "join",
      { debug: { colliderWireframes: game.debug.colliderWireframes } },
      (response) => {
        deserialize(game.world, response, DESERIALIZE_MODE.SYNCHRONIZE);

        game.playerId = queryMe(game.world)[0];

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

  const entered = queryPhysicsBodyEnter(game.world);
  if (entered.length > 0) {
    console.log("+enter box query: ", entered);
    // add threejs cube
    for (let i = 0; i < entered.length; i++) {
      const eid = entered[i];

      let geometry;
      if (hasComponent(game.world, Box, eid)) {
        geometry = new THREE.BoxGeometry(Box.width[eid], Box.height[eid], Box.depth[eid]);
      } else if (hasComponent(game.world, Sphere, eid)) {
        geometry = new THREE.SphereGeometry(Sphere.radius[eid], 32, 32);
      }

      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: Color.value[eid] }),
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(Position.x[eid], Position.y[eid], Position.z[eid]);
      mesh.name = eid;

      // TODO: update label content
      const playerDiv = document.createElement("div");
      playerDiv.className =
        "font-mono text-[9px] bg-transparent text-white whitespace-pre";

      const playerLabel = new CSS2DObject(playerDiv);
      playerLabel.name = "label";
      playerLabel.position.set(0, 0, 0);
      playerLabel.center.set(0, 0);
      playerLabel.layers.set(1);
      mesh.add(playerLabel);

      game.scene.add(mesh);
    }
  }

  const exited = queryPhysicsBodyExit(game.world);
  if (exited.length > 0) {
    console.log("-exit query: ", exited);
    for (let i = 0; i < exited.length; i++) {
      const eid = exited[i];
      const mesh = game.scene.getObjectByName(eid);
      mesh.remove(mesh.getObjectByName("label"));
      game.scene.remove(mesh);
    }
  }

  const enteredCollider = queryColliderEnter(game.world);
  if (enteredCollider.length > 0) {
    console.log("enteredCollider: ", enteredCollider);
    for (let i = 0; i < enteredCollider.length; i++) {
      const eid = enteredCollider[i];

      let geometry;

      if (hasComponent(game.world, Box, eid)) {
        geometry = new THREE.BoxGeometry(
          Box.width[eid],
          Box.height[eid],
          Box.depth[eid],
        );
      } else if (hasComponent(game.world, Sphere, eid)) {
        geometry = new THREE.SphereGeometry(Sphere.radius[eid], 12, 12);
      }

      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }),
      );
      mesh.scale.multiplyScalar(1.01);

      mesh.position.set(Position.x[eid], Position.y[eid], Position.z[eid]);

      mesh.quaternion.set(
        Quaternion.x[eid],
        Quaternion.y[eid],
        Quaternion.z[eid],
        Quaternion.w[eid],
      );

      mesh.name = eid + "collider";
      game.scene.add(mesh);
    }
  }

  const exitedCollider = queryColliderExit(game.world);
  if (exitedCollider.length > 0) {
    console.log("exitedCollider: ", exitedCollider);
    exitedCollider.forEach((eid) => {
      const mesh = game.scene.getObjectByName(eid + "collider");
      game.scene.remove(mesh);
    });
  }

  queryDisplayCollider(game.world).forEach((eid) => {
    const obj = game.scene.getObjectByName(eid + "collider");
    obj.quaternion.set(
      Quaternion.x[eid],
      Quaternion.y[eid],
      Quaternion.z[eid],
      Quaternion.w[eid],
    );
    obj.position.set(Position.x[eid], Position.y[eid], Position.z[eid]);
  });

  // TODO: do we even need a loop with fixed timestep?
  while (accumulator >= game.config.dt) {
    // game logic
    // ...
    // NOTE: Don't change these lines, needed for the game loop
    accumulator -= game.config.dt;
    game.currentTick++;
  }

  // Update positions
  queryPosition(game.world).forEach((eid) => {
    const obj = game.scene.getObjectByName(eid);

    const newPos = new THREE.Vector3(
      Position.x[eid],
      Position.y[eid],
      Position.z[eid],
    );

    const newRot = new THREE.Quaternion(
      Quaternion.x[eid],
      Quaternion.y[eid],
      Quaternion.z[eid],
      Quaternion.w[eid],
    );

    obj?.position?.lerp(newPos, game.config.lerpRatio);
    obj?.quaternion?.slerp(newRot, game.config.lerpRatio);
  });

  if (game.debug.enabled) {
    game.debug.labels.update();
  }

  handlePropertyListeners();

  game.renderer.render(game.scene, game.camera);
  game.labelRenderer?.render(game.scene, game.camera);
  game.stats?.update();
  game.controls.update();

  if (game.playerId >= 0) {
    const inputPayload = getInputPayload();
    if (inputPayload) {
      game.socket.emit("input", inputPayload);
    }
  }

  // NOTE: gameLoopRequestId is used later to cancel the game loop in cleanUp()
  game.gameLoopRequestId = window.requestAnimationFrame(gameLoop);
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

  if (game.keyboard.w || game.keyboard.arrowup) {
    inputPayload.x = 1;
    hasInput = true;
  }

  if (game.keyboard.s || game.keyboard.arrowdown) {
    inputPayload.x = -1;
    hasInput = true;
  }

  if (game.keyboard.a || game.keyboard.arrowleft) {
    inputPayload.z = -1;
    hasInput = true;
  }

  if (game.keyboard.d || game.keyboard.arrowright) {
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
  game.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  game.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  game.outputEncoding = THREE.sRGBEncoding;
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
  game.directionalLight.shadow.camera.near = 0.1;
  game.directionalLight.shadow.camera.far = 500;
  game.directionalLight.shadow.camera.left = -50;
  game.directionalLight.shadow.camera.right = 50;
  game.directionalLight.shadow.camera.top = 50;
  game.directionalLight.shadow.camera.bottom = -50;
  game.directionalLight.shadow.mapSize.width = 2048;
  game.directionalLight.shadow.mapSize.height = 2048;
  game.scene.add(game.directionalLight);

  const light = new THREE.HemisphereLight( 0xffffbb, 0x080820, 1 );
  game.scene.add( light );

  game.controls = new OrbitControls(game.camera, game.parentDiv);

  // add skybox
  const textureLoader = new THREE.TextureLoader();
  const backgroundTexture = textureLoader.load("skybox.jpg");
  backgroundTexture.mapping = THREE.EquirectangularReflectionMapping;
  backgroundTexture.colorSpace = THREE.SRGBColorSpace;
  game.scene.background = backgroundTexture;
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
  const key = event.key.toLowerCase();
  // console.log("key down:", event);
  game.keyboard[key] = true;
  game.keyCode[event.code] = true;

  if (game.keyboard["f12"]) {
    game.debug.enabled = !game.debug.enabled;
  }

  // Debug keys

  // NOTE: it's necessary to use the "code" from the event instead of the "key"
  // because clicking alt+key will register a different character
  if (game.keyCode["AltLeft"] && game.keyCode["ControlLeft"]) {
    if (game.keyCode.KeyD) {
      game.debug.enabled = !game.debug.enabled;
    }
    if (game.keyCode.KeyJ) {
      game.joinGame();
    }
    if (game.keyCode.KeyL) {
      game.leaveGame();
    }
  }
}

function onKeyUp(event) {
  // console.log("key up:", event.key);
  game.keyboard[event.key.toLowerCase()] = false;
  game.keyCode[event.code] = false;
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
    deserialize(game.world, payload, DESERIALIZE_MODE.SYNCHRONIZE);
    console.log("world update", getAllEntities(game.world));
  });

  game.socket.on("connect", () => {
    console.log("socket.io connected");
    if (game.isSubscribed) {
      console.log("yes?");
      game.subscribeToUpdates();
    }
  });
}

function setupECSWorld() {
  game.world = createWorld();

  registerComponent(game.world, Position);
}

function setupDebugListeners() {
  if (game.debug.enabled) {
    onChange(game.debug, "enabled", (current) => {
      game.setDebug(current);
    });
    onChange(game.debug, "colliderWireframes", (current) => {
      console.log("colliderWireframes: ", current);
      game.socket.emit("debug", {
        colliderWireframes: current,
      });
    });

    // onChange(game.socket, "connected", (current) => {
    //   if (game.isSubscribed) {
    //     game.subscribeToUpdates();
    //   }
    // });
  }
}

function onChange(obj, property, callback) {
  game.debug.propertyListeners.push({
    prev: undefined,
    obj,
    property,
    callback,
  });
}

function handlePropertyListeners() {
  game.debug.propertyListeners.forEach((listener) => {
    if (listener.prev !== listener.obj[listener.property]) {
      listener.prev = listener.obj[listener.property];
      listener.callback(listener.obj[listener.property], listener.prev);
    }
  });
}

export default game;
