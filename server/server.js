const PORT = process.env.NODE_ENV === "production" ? 80 : 8080;
import express from "express";
const app = express();
import cors from "cors";
import * as http from "http";
const server = http.createServer(app);
import { Server } from "socket.io";
import {
  addComponent,
  addEntity,
  createWorld,
  removeEntity,
  removeComponent,
} from "bitecs";
import logger, { colors, green, red } from "./utils/logger.js";
import { Box, Color, Me, Position, serialize } from "shared";

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // NOTE: for development
  },
});

app.use(express.static("../client/dist"));
app.use(cors());

logger.addWithSubType("event", colors.fgMagenta);
logger.addType("server", colors.fgWhite);

// world.name = "SplatBallEcsWorld";
const connectedSockets = [];
const subscribedSockets = new Set();
const inGameSockets = new Set(); // NOTE: actually in game players, but stored as sockets (sockets also have an entity id property)

const game = {
  config: {
    tickRate: 20,
    dt: 1 / 20,
  },
  currentTick: 0,
};

const world = createWorld();
const _NULL_ENTITY = addEntity(world);

const floor = addEntity(world);

addComponent(world, Position, floor);
Position.x[floor] = 0;
Position.y[floor] = -0.05;
Position.z[floor] = 0;

addComponent(world, Color, floor);
Color.value[floor] = 0xa89971;

addComponent(world, Box, floor);
Box.width[floor] = 15;
Box.height[floor] = 0.1;
Box.depth[floor] = 15;

io.on("connection", (socket) => {
  logger.event(green("connection"), "socket id:", socket.id);

  connectedSockets.push(socket);

  socket.eid = null;

  socket.on("subscribe", (payload) => {
    logger.event("subscribe", "client message:", payload);
    subscribedSockets.add(socket);
  });

  socket.on("unsubscribe", (payload) => {
    logger.event("unsubscribe", "client message:", payload);
    subscribedSockets.delete(socket);
  });

  socket.on("join", (payload, callback) => {
    logger.event("join", "client message:", payload);
    if (socket.eid) {
      // removeEntity(world, socket.eid);
      // delete playerSockets[socket.eid];
      logger.warn(
        `This player has already been initialized, not re-initializing! (eid: ${socket.eid}, socket id: ${socket.id})`,
      );
    } else {
      const playerId = addEntity(world);
      socket.eid = playerId;
      inGameSockets.add(socket);
      subscribedSockets.add(socket);
      // playerSockets[playerId] = socket;
      socket.input = {
        x: 0,
        z: 0,
        space: false,
        shift: false,
      };

      addComponent(world, Position, playerId);
      Position.x[playerId] = (Math.random() * 2 - 1) * 7;
      Position.y[playerId] = Math.random() * 4;
      Position.z[playerId] = (Math.random() * 2 - 1) * 7;

      addComponent(world, Box, playerId);
      Box.width[playerId] = 1;
      Box.height[playerId] = 1;
      Box.depth[playerId] = 1;

      addComponent(world, Color, playerId);
      Color.value[playerId] = Math.random() * 0xffffff;

      // NOTE: It is necessary to specify that this entity is the player ("Me")
      // because the entity ids on the client are not the same as on the server
      addComponent(world, Me, playerId);

      const payload = serialize(world);
      callback(payload);

      removeComponent(world, Me, playerId);
    }
  });

  socket.on("leave", (payload) => {
    logger.event("leave", "client message:", payload);
    removeEntity(world, socket.eid);
    socket.eid = null;
  });

  socket.on("input", (payload) => {
    logger.event("input", "client message:", payload);

    socket.input = payload;
  });

  socket.on("debug", (payload) => {
    logger.event("debug", "client message:", payload);
  });

  socket.on("disconnect", (reason) => {
    logger.event(red("disconnect"), "socket id:", socket.id, "Reason:", reason);
    removeEntity(world, socket.eid);
    inGameSockets.delete(socket);
    // delete playerSockets[socket.eid];
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
    // for (const socket of connectedSockets) {
    // for (const socket of Object.values(playerSockets)) {
    for (const socket of inGameSockets) {
      const speed = 5;
      const direction = {
        x: socket.input.x,
        y: socket?.input?.space ? 1 : socket?.input?.shift ? -1 : 0,
        z: socket.input.z,
      };

      // normalize position
      const length = Math.sqrt(
        direction.x ** 2 + direction.y ** 2 + direction.z ** 2,
      );
      direction.x /= length == 0 ? 1 : length;
      direction.y /= length == 0 ? 1 : length;
      direction.z /= length == 0 ? 1 : length;

      const vel = {
        x: speed * direction.x,
        y: speed * direction.y,
        z: speed * direction.z,
      };

      Position.x[socket.eid] += vel.x * game.config.dt;
      Position.y[socket.eid] += vel.y * game.config.dt;
      Position.z[socket.eid] += vel.z * game.config.dt;

      socket.input.x = 0;
      socket.input.y = 0;
      socket.input.z = 0;
      socket.input.space = false;
      socket.input.shift = false;
      socket.input.left = false;
      socket.input.right = false;
    }

    for (const socket of subscribedSockets) {
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
