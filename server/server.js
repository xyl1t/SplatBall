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
  defineQuery,
  enterQuery,
  exitQuery,
  hasComponent,
} from "bitecs";
import logger, { colors, green, red } from "./utils/logger.js";
import {
  Box,
  Color,
  DisplayCollider,
  Me,
  PhysicsBody,
  Position,
  Quaternion,
  Sphere,
  Static,
  serialize,
} from "shared";
import * as CANNON from "cannon-es";

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
const inGameEntities = new Set();

const game = {
  config: {
    tickRate: 30,
    dt: 1 / 30,
  },
  currentTick: 0,
};

const physicsWorld = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0),
});

// Stores the physics body for each entity that has a Box component
const entityPhysicsBodyMap = new Map();

const world = createWorld();
const _NULL_ENTITY = addEntity(world);

const queryPhysicsBody = defineQuery([PhysicsBody]);
const queryPhysicsBodyEnter = enterQuery(queryPhysicsBody);
const queryPhysicsBodyExit = exitQuery(queryPhysicsBody);

const queryDisplayCollider = defineQuery([DisplayCollider]);

const floor = addEntity(world);

addComponent(world, PhysicsBody, floor);

addComponent(world, Position, floor);
Position.x[floor] = 0;
Position.y[floor] = -0.5;
Position.z[floor] = 0;

addComponent(world, Quaternion, floor);
Quaternion.x[floor] = 0;
Quaternion.y[floor] = 0;
Quaternion.z[floor] = 0;
Quaternion.w[floor] = 1;

addComponent(world, Static, floor);

addComponent(world, Box, floor);
Box.width[floor] = 15;
Box.height[floor] = 1;
Box.depth[floor] = 15;

addComponent(world, Color, floor);
Color.value[floor] = 0xa89971;

// NOTE: Creates a simple wall of boxes for testing
let width = 5;
for (let row = 0; width >= 0; row++) {
  for (let col = 0; col < width; col++) {
    const firstBox = addEntity(world);

    addComponent(world, Position, firstBox);
    Position.x[firstBox] = 0;
    Position.y[firstBox] = row + 0.5;
    Position.z[firstBox] = col + col * 0.1 - width / 2;

    addComponent(world, Quaternion, firstBox);
    Quaternion.x[firstBox] = 0;
    Quaternion.y[firstBox] = 0;
    Quaternion.z[firstBox] = 0;
    Quaternion.w[firstBox] = 1;

    addComponent(world, Box, firstBox);
    Box.width[firstBox] = 1;
    Box.height[firstBox] = 1;
    Box.depth[firstBox] = 1;

    addComponent(world, Color, firstBox);
    Color.value[firstBox] = 0x00ff00;

    addComponent(world, PhysicsBody, firstBox);
    PhysicsBody.mass[firstBox] = 5;
  }
  width -= 1;
}

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
      logger.warn(
        `This player has already been initialized, not re-initializing! (eid: ${socket.eid}, socket id: ${socket.id})`,
      );
    } else {
      const playerId = addEntity(world);
      socket.eid = playerId;
      socket.debug = payload.debug;
      inGameSockets.add(socket);
      inGameEntities.add(playerId);
      subscribedSockets.add(socket);
      socket.input = {
        x: 0,
        z: 0,
        space: false,
        shift: false,
      };

      addComponent(world, PhysicsBody, playerId);
      PhysicsBody.mass[playerId] = 30;

      addComponent(world, Position, playerId);
      Position.x[playerId] = (Math.random() * 2 - 1) * 7;
      Position.y[playerId] = 3 + Math.random() * 4;
      Position.z[playerId] = (Math.random() * 2 - 1) * 7;

      addComponent(world, Quaternion, playerId);
      Quaternion.x[playerId] = 0;
      Quaternion.y[playerId] = 0;
      Quaternion.z[playerId] = 0;
      Quaternion.w[playerId] = 1;

      addComponent(world, Sphere, playerId);
      Sphere.radius[playerId] = 0.6;

      addComponent(world, Color, playerId);
      Color.value[playerId] = Math.random() * 0xffffff;

      if (socket.debug.colliderWireframes) {
        addComponent(world, DisplayCollider, playerId);
      }

      // NOTE: It is necessary to specify that this entity is the player ("Me")
      // because the entity ids on the client are not the same as on the server
      addComponent(world, Me, playerId);

      const callBackPayload = serialize(world);
      callback(callBackPayload);

      removeComponent(world, Me, playerId);
    }
  });

  socket.on("leave", (payload) => {
    logger.event("leave", "client message:", payload);
    removeEntity(world, socket.eid);
    inGameEntities.delete(socket.eid);
    inGameSockets.delete(socket);
    socket.eid = null;
  });

  socket.on("input", (payload) => {
    logger.event("input", "client message:", payload);

    socket.input = payload;
  });

  socket.on("debug", (payload) => {
    logger.event("debug", "client message:", payload);
    socket.debug = payload;
    if (socket.debug.colliderWireframes) {
      queryPhysicsBody(world).forEach((eid) => {
        addComponent(world, DisplayCollider, eid);
      });
    } else {
      queryDisplayCollider(world).forEach((eid) => {
        removeComponent(world, DisplayCollider, eid);
      });
    }
  });

  socket.on("disconnect", (reason) => {
    logger.event(red("disconnect"), "socket id:", socket.id, "Reason:", reason);
    removeEntity(world, socket.eid);
    inGameSockets.delete(socket);
    inGameEntities.delete(socket.eid);
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

  // Update physics world
  physicsWorld.fixedStep(game.config.dt);

  while (accumulator >= game.config.dt) {
    // Add new entities to physics world
    queryPhysicsBodyEnter(world).forEach((eid) => {
      const body = new CANNON.Body({
        linearDamping: 0.31,
        mass: PhysicsBody.mass[eid],
        position: new CANNON.Vec3(
          Position.x[eid],
          Position.y[eid],
          Position.z[eid],
        ),
        quaternion: new CANNON.Quaternion(
          Quaternion.x[eid],
          Quaternion.y[eid],
          Quaternion.z[eid],
          Quaternion.w[eid],
        ),
      });

      if (hasComponent(world, Box, eid)) {
        body.addShape(new CANNON.Box(
          new CANNON.Vec3(
            Box.width[eid] / 2,
            Box.height[eid] / 2,
            Box.depth[eid] / 2,
          ),
        ));
      } else if (hasComponent(world, Sphere, eid)) {
        body.addShape(new CANNON.Sphere(Sphere.radius[eid]));
      }

      if (hasComponent(world, Static, eid)) {
        body.type = CANNON.Body.STATIC;
      }

      body.sleep();

      physicsWorld.addBody(body);

      entityPhysicsBodyMap.set(eid, body);
    });

    // Remove entities from physics world
    queryPhysicsBodyExit(world).forEach((eid) => {
      const body = entityPhysicsBodyMap.get(eid);
      if (body) {
        physicsWorld.removeBody(body);
        entityPhysicsBodyMap.delete(eid);
      }
    });

    // Get positions and rotations from physics world and update components in the ecs world
    queryPhysicsBody(world).forEach((eid) => {
      const body = entityPhysicsBodyMap.get(eid);
      if (body) {
        Position.x[eid] = body.position.x;
        Position.y[eid] = body.position.y;
        Position.z[eid] = body.position.z;

        Quaternion.x[eid] = body.quaternion.x;
        Quaternion.y[eid] = body.quaternion.y;
        Quaternion.z[eid] = body.quaternion.z;
        Quaternion.w[eid] = body.quaternion.w;
      }
    });

    for (const socket of inGameSockets) {
      // Create direction vector from input
      const direction = {
        x: socket.input.x,
        y: socket?.input?.space ? 1 : socket?.input?.shift ? -1 : 0,
        z: socket.input.z,
      };

      // normalize position (to handle diagonal movement, otherwise diagnoal movement would be faster than straight movement)
      const length = Math.sqrt(
        direction.x ** 2 + direction.y ** 2 + direction.z ** 2,
      );
      direction.x /= length == 0 ? 1 : length;
      direction.y /= length == 0 ? 1 : length;
      direction.z /= length == 0 ? 1 : length;

      const force = 700;
      const forceVec = {
        x: force * direction.x,
        y: force * direction.y,
        z: force * direction.z,
      };

      const body = entityPhysicsBodyMap.get(socket.eid);
      body.applyForce(new CANNON.Vec3(forceVec.x, forceVec.y, forceVec.z));

      // Reset input
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

    // Optional debug output once per second
    // if (currentTime % 1 < 0.01) {
    //   logger.info("currentTick:", game.currentTick);
    // }

    accumulator -= game.config.dt;
    game.currentTick++;
  }
}, 0); // NOTE: the delay of setInterval() will not be exact, it may be greated than what is specified, so we handle the loop speed ourself

server.listen(PORT, () => {
  logger.info(`Server running under http://127.0.0.1:${PORT}`);
});
