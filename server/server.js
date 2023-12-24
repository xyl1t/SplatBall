const PORT = process.env.NODE_ENV === "production" ? 80 : 8080;
import express from "express";
const app = express();
import cors from "cors";
import * as http from "http";
const server = http.createServer(app);
import { Server } from "socket.io";
import { addComponent, addEntity, createWorld, defineSerializer, removeEntity } from "bitecs";
import logger, { colors, green, red } from "./utils/logger.js";
import { Position } from "shared";

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // NOTE: for development
  },
});

app.use(express.static("client/dist"));
app.use(cors());

logger.addWithSubType("event", colors.fgMagenta);
logger.addType("server", colors.fgWhite);

// world.name = "SplatBallEcsWorld";
const connectedSockets = [];
const playerSockets = {};

const game = {
  config: {
    tickRate: 30,
    dt: 1 / 30,
  },
  currentTick: 0,
};

const world = createWorld();
const serialize = defineSerializer(world);
// const deserialize = defineDeserializer(world);
const _NULL_ENTITY = addEntity(world);

io.on("connection", (socket) => {
  logger.event(green("connection"), "socket id:", socket.id);

  connectedSockets.push(socket);

  socket.on("init", (payload, callback) => {
    logger.event("init", "client message:", payload);
    if (socket.eid) {
      // removeEntity(world, socket.eid);
      // delete playerSockets[socket.eid];
      logger.warn(`This player has already been initialized, not re-initializing! (eid: ${socket.eid}, socket id: ${socket.id})`);
    } else {
      const playerId = addEntity(world);
      socket.eid = playerId;
      playerSockets[playerId] = socket;
      addComponent(world, Position, playerId);
      Position.x[playerId] = playerId;
      Position.x[playerId] = playerId;
      callback({ playerId });
    }
  });

  socket.on("input", (payload) => {
    logger.event("input", "client message:", payload);

    if (payload.addCube) {
      const cubeId = addEntity(world);
      addComponent(world, Position, cubeId);
    }
  });

  socket.on("debug", (payload) => {
    logger.event("debug", "client message:", payload);
  });

  socket.on("disconnect", (reason) => {
    logger.event(red("disconnect"), "socket id:", socket.id, "Reason:", reason);
    removeEntity(world, socket.eid);
    delete playerSockets[socket.eid];
    connectedSockets.splice(connectedSockets.indexOf(socket), 1);
  });
});

let oldTime = Date.now() / 1000;
let accumulator = 0;
let currentTime = Date.now() / 1000;
setInterval(() => {
  // TODO: send cubes that have to be rendered to client
  oldTime = currentTime;
  currentTime = Date.now() / 1000;
  const diff = currentTime - oldTime;
  accumulator += diff;

  // logger.debug("accumulator", accumulator, "dt", game.config.dt);
  while (accumulator >= game.config.dt) {
    for (const socket of Object.values(playerSockets)) {
      const payload = serialize(world);
      socket.emit("update", payload);
    }

    if (currentTime % 1 < 0.01) {
      // Debug output
    }

    accumulator -= game.config.dt;
    game.currentTick++;
  }
}, 0); // NOTE: the delay of setInterval() will not be exact, it may be greated than what is specified, so we handle the loop speed ourself

server.listen(PORT, () => {
  logger.info(`Server running under http://127.0.0.1:${PORT}`);
});

