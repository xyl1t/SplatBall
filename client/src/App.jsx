import { useEffect } from "react";
import GUI from "lil-gui";
import game from "./lib/game";

export default function App() {
  if (game.debug.enabled) {
    console.log("Debug mode ON");
  }

  // Setup
  useEffect(() => {
    game.setup({
      parentDivId: "gameDiv",
      initialCameraPosition: {
        x: -8,
        y: 6,
        z: -4,
      },
      directionalLight: {
        position: {
          x: 200,
          y: 400,
          z: 100,
        },
      },
      ambientLight: {
        intensity: 1,
      },
      antialias: false,
    });

    game.startGameLoop();

    let gui = new GUI();
    if (game.debug.enabled) {
      const socketFolder = gui.addFolder("Socket settings");

      const connectionFolder = socketFolder.addFolder("Connection");
      connectionFolder
        .add(game.socket, "connected")
        .name("Connection status")
        .listen()
        .disable();
      connectionFolder
        .add({ btn: () => game.connectToServer() }, "btn")
        .name("Connect");
      connectionFolder
        .add({ btn: () => game.disconnectFromServer() }, "btn")
        .name("Disconnect");

      const eventsFolder = socketFolder.addFolder("Events");
      eventsFolder
        .add({ btn: () => game.subscribeToUpdates() }, "btn")
        .name("Subscribe to updates");
      eventsFolder
        .add({ btn: () => game.unsubscribeFromUpdates() }, "btn")
        .name("Unsubscribe from updates");
      eventsFolder
        .add({ btn: () => game.joinGame() }, "btn")
        .name("Join game [ctrl] [alt] [j]");
      eventsFolder
        .add({ btn: () => game.leaveGame() }, "btn")
        .name("Leave game [ctrl] [alt] [l]");
      socketFolder.open();

      const debugFolder = gui.addFolder("Debug [F12] or [ctrl] [alt] [d]");
      debugFolder.add(game.debug, "enabled").name("Debug view").listen();

      debugFolder
        .add(game.debug.axesHelper, "visible")
        .listen()
        .name("Show axes");
      debugFolder
        .add(game.debug.gridHelper, "visible")
        .listen()
        .name("Show grid");
      debugFolder
        .add(game.debug, "colliderWireframes")
        .listen()
        .name("Collider wireframes");
      debugFolder
        .add(game.config, "lerpRatio", 0, 1)
        .listen()
        .name("Lerp ratio");

      const labelFolder = debugFolder.addFolder("Labels");
      labelFolder.add(game.debug.labels, "eids").listen().name("Entity ids");
      labelFolder
        .add(game.debug.labels, "components")
        .listen()
        .name("Components");
      labelFolder
        .add(game.debug.labels, "componentDetails")
        .listen()
        .name("Details");
      labelFolder.open();
      debugFolder.open();
    } else {
      game.subscribeToUpdates();
      gui
        .add({ btn: () => game.joinGame() }, "btn")
        .name("Join game [ctrl] [alt] [j]");
      gui
        .add({ btn: () => game.leaveGame() }, "btn")
        .name("Leave game [ctrl] [alt] [l]");
    }

    return () => {
      console.log("cleanup");
      game.cleanUp();
      gui?.destroy();
    };
  }, []);

  return (
    <div id="app">
      <div id="gameDiv">{/*<canvas id="gameCanvas"></canvas>*/}</div>
    </div>
  );
}
