// const PORT = process.env.PORT ?? 8080;
const PORT = process.env.NODE_ENV === "production" ? 80 : 8080;
import express from "express";
const app = express();
import cors from "cors";
import * as http from "http";
const server = http.createServer(app);
import { Server } from "socket.io";
import { addEntity, createWorld } from "bitecs";
import logger, { colors } from "./utils/logger.js";

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // NOTE: for development
  },
});

app.use(express.static("client/dist"));
app.use(cors());

logger.addWithSubType("event", colors.fgMagenta);
logger.addType("server", colors.fgWhite);

const world = createWorld();
const _NULL_ENTITY = addEntity(world);
// world.name = "SplatBallEcsWorld";
const connectedSocketIds = {};

io.on("connection", (socket) => {
  logger.event("connection", "a user connected");

  connectedSocketIds[socket.id] = socket;

  socket.on("init", (payload, callback) => {
    logger.event("init", "client message:", payload);
    const playerId = addEntity(world);
    socket.eid = addEntity(world);
    callback({ playerId });
  });

  socket.on("disconnect", (reason) => {
    logger.event("disconnect", "a user disconnected, reason:", reason);
  });
});

// setInterval(() => {
// }, 30)

server.listen(PORT, () => {
  logger.info(`Server running under http://127.0.0.1:${PORT}`);
});
