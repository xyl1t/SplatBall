import { useEffect } from "react";
import * as THREE from "three";
import { GUI } from "dat.gui";
import game from "./lib/game";
import { useState } from "react";

export default function App() {
  const [isSetup, setIsSetup] = useState(false);

  console.log("DEBUG", game.debug);

  // Setup
  useEffect(() => {
    if (isSetup && game.debug) return;
    setIsSetup(true);

    console.log(game);
    game.setup({
      parentDivId: "app",
      initialCameraPosition: {
        x: 2,
        y: 4,
        z: 8,
      },
      antialias: false,
    });

    game.addAxesHelper(10);
    game.addGridHelper(15);

    game.startGameLoop();

    const gui = new GUI();

    const socketFolder = gui.addFolder("socket settings");
    socketFolder.add(game.socket, "connected").name("Is conected").listen();
    socketFolder
      .add({ btn: () => game.initPlayerOnServer() }, "btn")
      .name("Initialize player");
    socketFolder
      .add({ btn: () => game.connectToServer() }, "btn")
      .name("connect");
    socketFolder
      .add({ btn: () => game.disconnectFromServer() }, "btn")
      .name("disconnect");
    socketFolder.open();

    return () => {
      console.log("cleanup");
      if (!game.debug) {
        game.cleanUp();
        gui.destroy();
      }
    };
  }, []);

  return <div id="app">
    <canvas id="gameCanvas"></canvas>
  </div>;
}
