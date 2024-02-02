import * as THREE from "three";
import setupThree from "./three";
import { CSS2DRenderer, OrbitControls, OutlineEffect } from "three/examples/jsm/Addons.js";
import setupEventListeners, { getInputPayload } from "./events";
import { Socket } from "socket.io-client";
import setupSocketIO from "./socket";
import { DESERIALIZE_MODE, createWorld } from "bitecs";
import setupDebug from "./debug";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import PropertyChangeListener from "./listener";
import { deserialize } from "shared";
import {
  colorSystem, getMeEntity,
  labelSystem,
  positionSystem,
  renderSystem,
} from "./systems";
import { loadModels } from "./models";

type GameConfig = {
  parentDomElement: HTMLElement;
  socketURL: string | undefined;
  antialias: boolean;

  fov: number;
  nearPlane: number;
  farPlane: number;

  ambientLight: {
    color: number;
    intensity: number;
  };
  directionalLight: {
    color: number;
    intensity: number;
    position: {
      x: number;
      y: number;
      z: number;
    };
  };

  skyboxPath?: string;

  initialCameraPosition: {
    x: number;
    y: number;
    z: number;
  };

  lerpRatio: number;

  tickrate: number;
  dt: number;
};

export type Game = {
  cfg: GameConfig;

  isSetup: boolean;
  isSubscribed: boolean;

  renderer?: THREE.WebGLRenderer;
  scene?: THREE.Scene;
  camera?: THREE.PerspectiveCamera;

  outlineScene?: THREE.Scene;
  outlineRenderer?: OutlineEffect;

  socket?: Socket;

  keyboard: { [key: string]: boolean };
  keyCode: { [key: string]: boolean };
  mouse: {
    x: number;
    y: number;
    dx: number;
    dy: number;
    left: boolean;
    right: boolean;
    sensitivity: number;
  };

  world: any[];
  clientWorld: any[];
  playerId: number;

  debug: {
    enabled: boolean;
    gui: GUI;
    stats: Stats;
    axesHelper: THREE.AxesHelper;
    gridHelper: THREE.GridHelper;
    showDebugColliders: boolean;
    controls?: OrbitControls;
    labelRenderer: CSS2DRenderer;
    propertyChangeListeners: PropertyChangeListener;
    debugControlsActive: boolean;

    labels: {
      showEids: boolean;
      showComponents: boolean;
      showDetails: boolean;
    };
  };

  gameLoopRequestId?: number;

  setup: (cfg?: Partial<GameConfig>) => void;
  start: () => void;
  subscribe: () => void;
  unsubscribe: () => void;
  joinGame: () => void;
  leaveGame: () => void;
  gameLoop: () => void;
  update: () => void;
  render: () => void;
  cleanup: () => void;
};

const game: Game = {
  cfg: {
    parentDomElement: document.body,
    socketURL:
      process.env.NODE_ENV === "production"
        ? undefined
        : "http://localhost:8080",
    antialias: true,
    fov: 75,
    nearPlane: 0.1,
    farPlane: 1000,

    ambientLight: {
      color: 0xffffff,
      intensity: 1,
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

    lerpRatio: 0.75,

    tickrate: 30,
    dt: 1 / 30,
  },

  isSetup: false,
  isSubscribed: false,

  socket: undefined,

  keyboard: {},
  keyCode: {},
  mouse: {
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    left: false,
    right: false,
    sensitivity: 0.01,
  },

  world: createWorld(),
  clientWorld: createWorld(),
  playerId: -1,

  debug: {
    enabled: false,
    axesHelper: new THREE.AxesHelper(15),
    gridHelper: new THREE.GridHelper(15, 15),
    showDebugColliders: true,
    gui: new GUI(),
    stats: new Stats(),
    controls: undefined,
    labelRenderer: new CSS2DRenderer(),
    propertyChangeListeners: new PropertyChangeListener(),
    debugControlsActive: false,

    labels: {
      showEids: true,
      showComponents: false,
      showDetails: false,
    },
  },

  setup(cfg?: Partial<GameConfig>) {
    if (cfg) {
      game.cfg = { ...game.cfg, ...cfg };
    }

    if (!game.cfg.parentDomElement) {
      game.cfg.parentDomElement = document.body;
    }

    setupThree(game);
    setupEventListeners(game);
    setupSocketIO(game);
    setupDebug(game);

    loadModels(game, (totalProgress: number) => {
      console.log("total load progress", totalProgress);
    });

    game.isSetup = true;
    game.subscribe();
  },

  start() {
    console.log("start");
    game.gameLoopRequestId = requestAnimationFrame(game.gameLoop);
  },

  subscribe() {
    console.log("subscribe");
    if (!game.socket) throw new Error("Socket not initialized");
    game.socket.emit("subscribe");
    game.isSubscribed = true;
  },

  unsubscribe() {
    console.log("unsubscribe");
    if (!game.socket) throw new Error("Socket not initialized");
    game.socket.emit("unsubscribe");
    game.isSubscribed = false;
  },

  joinGame() {
    console.log("join");
    if (!game.socket) throw new Error("Socket not initialized");
    game.socket.emit(
      "join",
      { debug: { colliderWireframes: false } },
      (response: any) => {
        deserialize(game.world, response, DESERIALIZE_MODE.SYNCHRONIZE);

        game.playerId = getMeEntity(game.world);

        console.log("player joined, playerId: ", game.playerId);
        game.isSubscribed = true;
      },
    );
  },

  leaveGame() {
    console.log("leave");
    if (!game.socket) throw new Error("Socket not initialized");
    game.socket.emit("leave");
    game.playerId = -1;
  },

  gameLoop(_currentTime: number = 0) {
    // console.log("gameLoop", currentTime);

    game.update();

    game.render();

    game.gameLoopRequestId = requestAnimationFrame(game.gameLoop);
  },

  update() {
    positionSystem(game);
    colorSystem(game);

    if (game.debug.enabled) {
      labelSystem(game);
      if (game.debug.debugControlsActive) {
        game.debug.controls!.enabled = true;
        game.debug.controls!.update();
      }
      game.debug.stats.update();
    }

    if (game.playerId >= 0) {
      const inputPayload = getInputPayload(game);
      if (inputPayload) {
        game.socket!.emit("input", inputPayload);
      }
    }

    //...
  },
  
  render() {
    renderSystem(game);
    game.renderer!.render(game.scene!, game.camera!);
    game.outlineRenderer?.renderOutline(game.outlineScene!, game.camera!)
        // if (game.debug.enabled) {
    game.debug.labelRenderer.render(game.scene!, game.camera!);
    // }
  },

  cleanup: function (): void {},
};

export default game;
