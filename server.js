// const PORT = process.env.PORT ?? 8080;
const PORT = process.env.NODE_ENV === "production" ? 80 : 8080;
import express from "express";
const app = express();
import cors from "cors";
import * as http from "http";
const server = http.createServer(app);
import { Server } from "socket.io";
import { addEntity, createWorld } from "bitecs";
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // NOTE: for development
  },
});

app.use(express.static("client/dist"));
app.use(cors());

const world = createWorld();
const _NULL_ENTITY = addEntity(world);
// world.name = "SplatBallEcsWorld";
const connectedSocketIds = {};

io.on("connection", (socket) => {
  console.log("[event:connection] a user connected");

  connectedSocketIds[socket.id] = socket;

  socket.on("init", (payload, callback) => {
    console.log("[event:init] client message: ", payload);
    const playerId = addEntity(world);
    socket.eid = addEntity(world);
    callback({ playerId });
  });

  // socket.emit("foo", { hello: "world" });

  // socket.on("create-something", (data) => {
  //   console.log("create-something", data);
  // });

  socket.on("disconnect", (reason) => {
    console.log("[event:disconnect] a user disconnected, reason:", reason);
  });
});

// setInterval(() => {
// }, 30)

server.listen(PORT, () => {
  console.log(`Server running under http://127.0.0.1:${PORT}`);
});
