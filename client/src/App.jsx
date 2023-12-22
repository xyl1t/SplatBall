import { useEffect } from "react";
import * as THREE from "three";
import { GUI } from "dat.gui";
import game from "./lib/game";

export default function App() {
  // Setup
  useEffect(() => {
    game.setup({
      parentDivId: "app",
      initialCameraPosition: {
        x: 2,
        y: 4,
        z: 8,
      },
      antialias: false,
    });

    game.addAxesHelper(15);

    game.startGameLoop();

    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const boxMaterial = new THREE.MeshNormalMaterial();
    const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);

    game.scene.add(boxMesh);

    const gui = new GUI();

    const boxFolder = gui.addFolder("box settings");
    boxFolder.add(boxMesh.position, "x", -5, 5, 0.01).name("box x");
    boxFolder.add(boxMesh.position, "y", -5, 5, 0.01).name("box y");
    boxFolder.add(boxMesh.position, "z", -5, 5, 0.01).name("box z");

    const socketFolder = gui.addFolder("socket settings");
    socketFolder.add(game.socket, "connected").name("Conn status").listen();
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
      game.cleanUp();
      gui.destroy();
    };
  }, []);

  return <div id="app"></div>;
}
