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
          x: 300,
          y: 200,
          z: 100,
        },
      },
      antialias: false,
    });

    game.startGameLoop();

    let gui;
    if (game.debug.enabled) {
      gui = new GUI();

      const socketFolder = gui.addFolder("Socket settings");

      const connectionFolder = socketFolder.addFolder("Connection");
      connectionFolder.add(game.socket, "connected").name("Connection status").listen().disable();
      connectionFolder
        .add({ btn: () => game.connectToServer() }, "btn")
        .name("Connect");
      connectionFolder
        .add({ btn: () => game.disconnectFromServer() }, "btn")
        .name("Disconnect");

      const eventsFolder = socketFolder.addFolder("Events");
      eventsFolder.add({ btn: () => game.subscribeToUpdates() }, "btn").name("Subscribe to updates");
      eventsFolder.add({ btn: () => game.unsubscribeFromUpdates() }, "btn").name("Unsubscribe from updates");
      eventsFolder.add({ btn: () => game.joinGame() }, "btn").name("Join game [J]");
      eventsFolder.add({ btn: () => game.leaveGame() }, "btn").name("Leave game");
      socketFolder.open();

      const debugFolder = gui.addFolder("Debug [F12] or [ctrl] [shift] [d]");
      debugFolder
        .add(game.debug, "enabled")
        .name("Debug view")
        .listen()
        .onChange((isEnabled) => game.setDebug(isEnabled));

      debugFolder.add(game.debug.axesHelper, "visible").listen().name("Show axes");
      debugFolder.add(game.debug.gridHelper, "visible").listen().name("Show grid");
      const labelFolder = debugFolder.addFolder("Labels");
      labelFolder
        .add(game.debug.labels, "eids")
        .listen()
        .name("Entity ids");
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
