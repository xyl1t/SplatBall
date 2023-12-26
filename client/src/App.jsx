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

      const socketFolder = gui.addFolder("socket settings");
      socketFolder.add(game.socket, "connected").name("Is conected").listen();
      socketFolder
        .add({ btn: () => game.connectToServer() }, "btn")
        .name("connect");
      socketFolder.add({ btn: () => game.joinGame() }, "btn").name("Join game");
      socketFolder.add({ btn: () => game.leaveGame() }, "btn").name("Leave game");
      socketFolder
        .add({ btn: () => game.disconnectFromServer() }, "btn")
        .name("disconnect");
      socketFolder.open();

      const debugFolder = gui.addFolder("debug");
      debugFolder
        .add(game.debug, "enabled")
        .name("Debug view")
        .listen()
        .onChange(() => game.toggleDebug());

      debugFolder.add(game.debug.axesHelper, "visible").listen().name("Show axes");
      debugFolder.add(game.debug.gridHelper, "visible").listen().name("Show grid");
      const labelFolder = debugFolder.addFolder("labels");
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
