import { useEffect } from "react";
import { socket } from "./socket";
import GameWorld from "./lib/GameWorld";
import * as THREE from "three";
import { GUI } from "dat.gui";

export default function App() {
  // setup socket.io
  useEffect(() => {
    function onConnect() {
      console.log("connected");
    }

    function onDisconnect() {
      console.log("disconnected");
    }

    function onFooEvent(value) {
      console.log("foo event", value);
    }

    // register event handlers
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("foo", onFooEvent);

    // cleanup
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("foo", onFooEvent);
    };
  }, []);

  // Setup
  useEffect(() => {
    const game = new GameWorld("app");

    game.initThree();

    game.addAxesHelper(15);

    game.animate();

    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const boxMaterial = new THREE.MeshNormalMaterial();
    const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);

    game.scene.add(boxMesh);

    const gui = new GUI();
    gui.add(boxMesh.position, "x", -5, 5, 0.01).name("box x");
    gui.add(boxMesh.position, "y", -5, 5, 0.01).name("box y");
    gui.add(boxMesh.position, "z", -5, 5, 0.01).name("box z");

    const onKeyDown = (event) => {
      console.log(event.key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      game.cleanUp();
      gui.destroy();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return <div id="app"></div>;
}
