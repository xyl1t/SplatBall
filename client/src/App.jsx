import { useState, useEffect } from "react";
import { socket } from "./socket";
import { ConnectionState } from "./components/ConnectionState";
import { ConnectionManager } from "./components/ConnectionManager";
import { Events } from "./components/Events";
import { MyForm } from "./components/MyForm";
import GameWorld from "./lib/GameWorld";
import * as THREE from "three";

export default function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [fooEvents, setFooEvents] = useState([]);

  // setup socket.io
  useEffect(() => {
    // socket.connect();
    // console.log("connecting");

    function onConnect() {
      setIsConnected(true);
      console.log("connected");
    }

    function onDisconnect() {
      setIsConnected(false);
      console.log("disconnected");
    }

    function onFooEvent(value) {
      setFooEvents((previous) => [...previous, value]);
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

  // Setup threejs
  useEffect(() => {
    const game = new GameWorld("gameCanvas");
    game.initialize();
    game.animate();

    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const boxMaterial = new THREE.MeshNormalMaterial({ color: 0x00ff00 });
    const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);

    game.scene.add(boxMesh);

  }, []);

  return (
    <div>
      <canvas id="gameCanvas" />
    </div>
  );
}
