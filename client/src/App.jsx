import { useEffect } from "react";
import { GUI } from "dat.gui";
import game from "./lib/game";

export default function App() {
  if (game.debug.enabled) {
    console.log("Debug mode ON");
  }

  // Setup
  useEffect(() => {
    game.setup({
      parentDivId: "gameDiv",
      // canvasId: "gameCanvas",
      initialCameraPosition: {
        x: 4,
        y: 6,
        z: 10,
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

    if (game.debug.enabled) {
      game.addAxesHelper(10);
      game.addGridHelper(15);
    }

    game.startGameLoop();

    const gui = new GUI();

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

    if (game.debug.enabled) {
      const debugFolder = gui.addFolder("debug");
      debugFolder.add(game, "toggleLabels").name("Show EID's");
      debugFolder.add(game.debug.axesHelper, "visible").name("Show axes");
      debugFolder.add(game.debug.gridHelper, "visible").name("Show grid");
      const labelFolder = debugFolder.addFolder("labels");
      labelFolder.add(game.debug.labels, "eids").name("Entity ids").onChange(() => {game.debug.labels.update()});
      labelFolder.add(game.debug.labels, "components").name("Components").onChange(() => {game.debug.labels.update()});
      labelFolder.add(game.debug.labels, "componentDetails").name("Details").onChange(() => {game.debug.labels.update()});
      debugFolder.open();
    }

    return () => {
      console.log("cleanup");
      game.cleanUp();
      gui.destroy();
    };
  }, []);

  return (
    <div id="app">
      <div id="gameDiv">
        {/*<canvas id="gameCanvas"></canvas>*/}
      </div>
    </div>
  );
}
