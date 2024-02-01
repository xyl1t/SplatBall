import { OrbitControls } from "three/examples/jsm/Addons.js";
import { Game } from "./game";

export default function setupDebug(game: Game) {
  const gui = game.debug.gui;
  gui.add(game.debug, "enabled").name("Enabled").listen();

  const socketFolder = gui.addFolder("Socket");

  const connectionFolder = socketFolder.addFolder("Connection");
  connectionFolder
    .add(game.socket!, "connected")
    .name("Connection status")
    .listen()
    .disable();
  connectionFolder
    .add({ b: () => game.socket!.connect() }, "b")
    .name("Connect");
  connectionFolder
    .add({ b: () => game.socket!.disconnect() }, "b")
    .name("Disconnect");

  const eventsFolder = socketFolder.addFolder("Events");
  eventsFolder.add(game, "isSubscribed").name("Subscribed").listen().disable();
  eventsFolder.add({ b: () => game.subscribe() }, "b").name("Subscribe");
  eventsFolder.add({ b: () => game.joinGame() }, "b").name("Join game");
  eventsFolder.add({ b: () => game.leaveGame() }, "b").name("Leave game");
  eventsFolder.add({ b: () => game.unsubscribe() }, "b").name("Unsubscribe");
  eventsFolder
    .add({ b: () => game.socket!.emit("testWall") }, "b")
    .name("Add wall");

  const debugFolder = gui.addFolder("Debug");
  debugFolder.add(game.cfg, "lerpRatio", 0, 1).listen().name("Lerp ratio");
  debugFolder
    .add(game.mouse, "sensitivity", 0.001, 0.05, 0.001)
    .listen()
    .name("Mouse sensitivity");
  debugFolder
    .add(game.debug, "debugControlsActive")
    .listen()
    .name("Debug camera");
  debugFolder
    .add(game.debug.axesHelper!, "visible")
    .listen()
    .name("Axes helper");
  debugFolder
    .add(game.debug.gridHelper!, "visible")
    .listen()
    .name("Grid helper");

  const labelFolder = debugFolder.addFolder("Label");
  labelFolder.add(game.debug.labels, "showEids").name("Show eid's");
  labelFolder.add(game.debug.labels, "showComponents").name("Show Components");
  labelFolder.add(game.debug.labels, "showDetails").name("Show Details");

  game.debug.stats.showPanel(0);
  game.cfg.parentDomElement.appendChild(game.debug.stats.dom);

  game.debug.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  game.debug.labelRenderer.domElement.style.position = "absolute";
  game.debug.labelRenderer.domElement.style.top = "0px";
  game.cfg.parentDomElement.appendChild(game.debug.labelRenderer.domElement);

  game.debug.controls = new OrbitControls(
    game.camera!,
    game.cfg.parentDomElement,
  );

  game.debug.propertyChangeListeners.addListener(game.debug, "enabled", () => {
    console.log("debug.enabled changed");

    toggleDebug(game);
  });

  game.debug.axesHelper.name = "axesHelper";
  game.debug.axesHelper.layers.set(1);
  game.debug.gridHelper.position.y = 0.01;
  game.scene!.add(game.debug.axesHelper);

  game.debug.gridHelper.name = "gridHelper";
  game.debug.gridHelper.layers.set(1);
  game.debug.gridHelper.position.y = 0.01;
  game.scene!.add(game.debug.gridHelper);

  enableDebug(game);
}

function toggleDebug(game: Game) {
  if (game.debug.enabled) {
    enableDebug(game);
  } else {
    disableDebug(game);
  }
}

function enableDebug(game: Game) {
  game.debug.enabled = true;
  game.debug.gui.show();
  game.debug.stats.dom.style.visibility = "visible";
  game.camera!.layers.enable(1);
}

function disableDebug(game: Game) {
  game.debug.enabled = false;
  game.debug.gui.hide();
  game.debug.stats.dom.style.visibility = "hidden";
  game.camera!.layers.disable(1);
}
