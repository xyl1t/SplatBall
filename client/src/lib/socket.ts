import { io } from "socket.io-client";
import { Game } from "./game";
import { deserialize } from "shared";
import { DESERIALIZE_MODE } from "bitecs";

export default function setupSocketIO(game: Game) {
  const socket = io(game.cfg.socketURL as string);

  socket.on("connect", () => {
    console.log("Connected to server");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });

  socket.on("error", (error: Error) => {
    console.error(error);
  });

  socket.on("update", (data: any) => {
    // console.log("update", data);
    deserialize(game.world, data, DESERIALIZE_MODE.SYNCHRONIZE);
  });

  game.socket = socket;
}
