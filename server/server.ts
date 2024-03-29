// const PORT = process.env.NODE_ENV === "production" ? 80 : 8080;
const PORT = process.env.PORT ?? 8080;
import express from "express";
const app = express();
import cors from "cors";
import * as http from "http";
const server = http.createServer(app);
import { Server, Socket } from "socket.io";
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
  Ball,
  Box,
  Color,
  Cylinder,
  DisplayCollider,
  InitialForce,
  Me,
  Model,
  PhysicsBody,
  Player,
  Position,
  Quaternion,
  Sphere,
  Static,
  serialize,
} from "shared";
import * as CANNON from "cannon-es";

// TODO: add types to server
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
const connectedSockets: Socket[] = [];
const subscribedSockets = new Set<Socket>();
const inGameSockets = new Set<Socket>(); // NOTE: actually in game players, but stored as sockets (sockets also have an entity id property)
const inGameEntities = new Set<number>();

const cameraOffsetY = 0.8;

const game = {
  config: {
    tickRate: 30,
    dt: 1 / 30,
  },
  currentTick: 0,
};

const physicsWorld = new CANNON.World({
  gravity: new CANNON.Vec3(0, -24, 0),
});

const groundMaterial = new CANNON.Material("ground");
const slipperyMaterial = new CANNON.Material("slippery");

// Adjust constraint equation parameters for ground/ground contact
const ground_ground = new CANNON.ContactMaterial(groundMaterial, groundMaterial, {
  friction: 0.4,
  restitution: 0.3,
  contactEquationStiffness: 1e8,
  contactEquationRelaxation: 3,
  frictionEquationStiffness: 1e8,
})

const slippery_ground = new CANNON.ContactMaterial(groundMaterial, slipperyMaterial, {
  friction: 0,
  restitution: 0,
  contactEquationStiffness: 1e8,
  contactEquationRelaxation: 3,
})

physicsWorld.addContactMaterial(ground_ground);
physicsWorld.addContactMaterial(slippery_ground);


// Stores the physics body for each entity that has a Box component
const entityPhysicsBodyMap = new Map();
const bodyToEntityMap = new Map();

const world = createWorld();
// const _NULL_ENTITY = addEntity(world);

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

const wallids: number[] = [];

// NOTE: Creates a simple wall of boxes for testing
function addTestWall(width: number) {
  wallids.forEach((eid) => {
    removeEntity(world, eid);
  });

  for (let row = 0; width >= 0; row++) {
    for (let col = 0; col < width; col++) {
      const eid = addEntity(world);

      wallids.push(eid);

      addComponent(world, Position, eid);
      Position.x[eid] = 0;
      Position.y[eid] = row + 0.5;
      Position.z[eid] = col + col * 0.1 - width / 2;

      addComponent(world, Quaternion, eid);
      Quaternion.x[eid] = 0;
      Quaternion.y[eid] = 0;
      Quaternion.z[eid] = 0;
      Quaternion.w[eid] = 1;

      addComponent(world, Box, eid);
      Box.width[eid] = 1;
      Box.height[eid] = 1;
      Box.depth[eid] = 1;

      addComponent(world, Color, eid);
      Color.value[eid] = 0x00ff00;

      addComponent(world, PhysicsBody, eid);
      PhysicsBody.mass[eid] = 5;
    }
    width -= 1;
  }
}

let ballId;

function spawnBall(loop: number) {
  for (let i = 0; i < loop; i++) {
    ballId = addEntity(world);
    let eid = ballId;
    wallids.push(eid);

    addComponent(world, Position, eid);
    Position.x[eid] = (Math.random() * 2 - 1) * 7;
    Position.y[eid] = 3 + Math.random() * 4;
    Position.z[eid] = (Math.random() * 2 - 1) * 7;

    addComponent(world, Quaternion, eid);
    Quaternion.x[eid] = 0;
    Quaternion.y[eid] = 0;
    Quaternion.z[eid] = 0;
    Quaternion.w[eid] = 1;

    addComponent(world, Sphere, eid);
    Sphere.radius[eid] = 0.3;

    addComponent(world, Color, eid);
    Color.value[eid] = 0xb09707;

    addComponent(world, PhysicsBody, eid);
    PhysicsBody.mass[eid] = 5;

    addComponent(world, Ball, eid);
    Ball.touchedFloor[eid] = 1;

  }
}


function shootBall(origin:CANNON.Vec3, direction:CANNON.Vec3, speed:number){

  ballId = addEntity(world);
  let eid = ballId;

  addComponent(world, Position, eid);
  Position.x[eid] = origin.x;
  Position.y[eid] = origin.y;
  Position.z[eid] = origin.z;

  addComponent(world, Quaternion, eid);
  Quaternion.x[eid] = 0;
  Quaternion.y[eid] = 0;
  Quaternion.z[eid] = 0;
  Quaternion.w[eid] = 1;

  addComponent(world, Sphere, eid);
  Sphere.radius[eid] = 0.3;

  addComponent(world, Color, eid);
  Color.value[eid] = 0xb09707;

  addComponent(world, PhysicsBody, eid);
  PhysicsBody.mass[eid] = 5;

  addComponent(world, Ball, eid);
  Ball.touchedFloor[eid] = 1;  

  addComponent(world, InitialForce, eid);
  let forceVektor = direction.vmul(new CANNON.Vec3(speed,speed,speed));
  InitialForce.x[eid] = forceVektor.x;
  InitialForce.y[eid] = forceVektor.y;
  InitialForce.z[eid] = forceVektor.z;
}

// addTestWall(5);

function addMatt(loop: number) {
  for (let i = 0; i < loop; i++) {
    const eid = addEntity(world);
    wallids.push(eid);

    addComponent(world, Position, eid);
    Position.x[eid] = (Math.random() * 2 - 1) * 7;
    Position.y[eid] = 20 + Math.random() * 4;
    Position.z[eid] = (Math.random() * 2 - 1) * 7;

    addComponent(world, Quaternion, eid);
    Quaternion.x[eid] = Math.random();
    Quaternion.y[eid] = Math.random();
    Quaternion.z[eid] = Math.random();
    Quaternion.w[eid] = 1;

    addComponent(world, Box, eid);
    Box.width[eid] = 1;
    Box.height[eid] = 0.1;
    Box.depth[eid] = 2;

    addComponent(world, Model, eid);
    Model.id[eid] = 3;

    addComponent(world, PhysicsBody, eid);
    PhysicsBody.mass[eid] = 60;
  }
}

function addBox(loop: number) {
  for (let i = 0; i < loop; i++) {
    const eid = addEntity(world);
    wallids.push(eid);

    addComponent(world, Position, eid);
    Position.x[eid] = (Math.random() * 2 - 1) * 7;
    Position.y[eid] = 20 + Math.random() * 4;
    Position.z[eid] = (Math.random() * 2 - 1) * 7;

    addComponent(world, Quaternion, eid);
    Quaternion.x[eid] = 0;
    Quaternion.y[eid] = 0;
    Quaternion.z[eid] = 0;
    Quaternion.w[eid] = 1;

    addComponent(world, Box, eid);
    Box.width[eid] = 1.4;
    Box.height[eid] = 1.1;
    Box.depth[eid] = 0.7;

    addComponent(world, Model, eid);
    Model.id[eid] = 1;

    addComponent(world, PhysicsBody, eid);
    PhysicsBody.mass[eid] = 60;
  }
}

function addTests() {
  wallids.forEach((eid) => {
    removeEntity(world, eid);
  });

  addBox(10);
  addMatt(10);

  spawnBall(10);

}
addTests();

io.on("connection", (socket) => {
  logger.event(green("connection"), "socket id:", socket.id);

  connectedSockets.push(socket);

  socket.data.eid = null;

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
    if (socket.data.eid) {
      logger.warn(
        `This player has already been initialized, not re-initializing! (eid: ${socket.data.eid}, socket id: ${socket.id})`,
      );
    } else {
      const playerId = addEntity(world);
      socket.data.eid = playerId;
      socket.data.debug = payload.debug;
      inGameSockets.add(socket);
      inGameEntities.add(playerId);
      subscribedSockets.add(socket);
      socket.data.input = {
        x: 0,
        z: 0,
        space: false,
        shift: false,
      };

      addComponent(world, Player, playerId);
      Player.numBalls[playerId] = 0

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

      addComponent(world, Color, playerId);
      Color.value[playerId] = Math.random() * 0xffffff;

      if (socket.data.debug.colliderWireframes) {
        addComponent(world, DisplayCollider, playerId);
      }

      addComponent(world, Model, playerId);
      Model.id[playerId] = 2;

      const modelId = Model.id[playerId];
      if (modelId == 1) {
        addComponent(world, Box, playerId);
        Box.width[playerId] = 1.4;
        Box.height[playerId] = 1.1;
        Box.depth[playerId] = 0.7;
      } else if (modelId == 2) {
        addComponent(world, Cylinder, playerId);
        Cylinder.radius[playerId] = 0.3;
        Cylinder.height[playerId] = 1.70;
      }

      // NOTE: It is necessary to specify that this entity is the player ("Me")
      // because the entity ids on the client are not the same as on the server
      addComponent(world, Me, playerId);

      const callBackPayload = serialize(world as any[]);
      callback(callBackPayload);

      removeComponent(world, Me, playerId);
    }
  });

  socket.on("leave", (payload) => {
    logger.event("leave", "client message:", payload);
    removeEntity(world, socket.data.eid);
    inGameEntities.delete(socket.data.eid);
    inGameSockets.delete(socket);
    socket.data.eid = null;
  });

  socket.on("input", (payload) => {
    //logger.event("input", "client message:", payload);

    socket.data.input = payload;
  });

  socket.on("debug", (payload) => {
    logger.event("debug", "client message:", payload);
    socket.data.debug = payload;
    if (socket.data.debug.colliderWireframes) {
      queryPhysicsBody(world).forEach((eid) => {
        addComponent(world, DisplayCollider, eid);
      });
    } else {
      queryDisplayCollider(world).forEach((eid) => {
        removeComponent(world, DisplayCollider, eid);
      });
    }
  });

  socket.on("testWall", (payload) => {
    logger.event("testWall", "client message:", payload);
    addTests();
  });

  socket.on("disconnect", (reason) => {
    logger.event(red("disconnect"), "socket id:", socket.id, "Reason:", reason);
    removeEntity(world, socket.data.eid);
    inGameSockets.delete(socket);
    inGameEntities.delete(socket.data.eid);
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
        linearDamping: 0.95,
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

      // if (hasComponent(world, Model, eid)) {
      // }

      if(hasComponent(world, InitialForce, eid)){
        body.applyForce(new CANNON.Vec3(InitialForce.x[eid],InitialForce.y[eid],InitialForce.z[eid]))
        removeComponent(world, InitialForce, eid);
      }

      if (hasComponent(world, Box, eid)) {
        body.addShape(
          new CANNON.Box(
            new CANNON.Vec3(
              Box.width[eid]! / 2,
              Box.height[eid]! / 2,
              Box.depth[eid]! / 2,
            ),
          ),
        );
        body.material = groundMaterial;
      } else if (hasComponent(world, Sphere, eid)) {
        body.addShape(new CANNON.Sphere(Sphere.radius[eid]!));
      } else if (hasComponent(world, Cylinder, eid)) {
        // body.addShape(new CANNON.Sphere(Cylinder.radius[eid]!));
        body.addShape(
          new CANNON.Cylinder(
            Cylinder.radius[eid],
            Cylinder.radius[eid],
            Cylinder.height[eid],
            12
          ),
        );
        body.angularFactor = new CANNON.Vec3(0, 1, 0);
        body.material = slipperyMaterial;
      }

      if (hasComponent(world, Static, eid)) {
        body.type = CANNON.Body.STATIC;
      }

      // body.sleep();
      // body.eid = eid;

      if (hasComponent(world, Player, eid)) {

        const contactNormal = new CANNON.Vec3() // Normal in the contact, pointing *out* of whatever the player touched
        const upAxis = new CANNON.Vec3(0, 1, 0)

        body.addEventListener("collide", (event: any) => {
          const { contact } = event

          // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
          // We do not yet know which one is which! Let's check.
          if (contact.bi.id === body.id) {
            // bi is the player body, flip the contact normal
            contact.ni.negate(contactNormal)
          } else {
            // bi is something else. Keep the normal as it is
            contactNormal.copy(contact.ni)
          }

          // If contactNormal.dot(upAxis) is between 0 and 1, we know that the contact normal is somewhat in the up direction.
          if (contactNormal.dot(upAxis) > 0.5) {
            // Use a "good" threshold value between 0 and 1 here!
            Player.canJump[eid] = 1;
          }
        });
      }


      if (hasComponent(world, Ball, eid)) {

        
        body.addEventListener("collide", (event: any) => {
          const { contact } = event
          console.log("hit")


          // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
          // We do not yet know which one is which! Let's check.
          if (contact.bi.id != body.id) {
            // bi is the player body, flip the contact normal
            let collObj = bodyToEntityMap.get(contact.bi.id)

            if(!hasComponent(world,Player,collObj)){
              console.log("no player")
            }else{
              let v = new CANNON.Vec3().copy(contact.ni);
              v.negate()
              entityPhysicsBodyMap.get(collObj).applyForce(v.vmul(new CANNON.Vec3(20000,20000,20000)))
            }
          }else{
            let collObj = bodyToEntityMap.get(contact.bj.id)
            if(!hasComponent(world,Player,collObj)){
              console.log("no player")
            }else{
              console.log("player" + collObj)
              let v = new CANNON.Vec3().copy(contact.ni);
              v.negate()
              entityPhysicsBodyMap.get(collObj).applyForce(v.vmul(new CANNON.Vec3(20000,20000,20000)))

            }
          }
        });
      }

      physicsWorld.addBody(body);

      entityPhysicsBodyMap.set(eid, body);
      bodyToEntityMap.set(body.id, eid);
    });

    // Remove entities from physics world
    queryPhysicsBodyExit(world).forEach((eid) => {
      const body = entityPhysicsBodyMap.get(eid);
      if (body) {
        physicsWorld.removeBody(body);
        entityPhysicsBodyMap.delete(eid);
        bodyToEntityMap.delete(body.id);
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
        x: socket.data.input.x,
        y: 0,//socket.data.input.space ? 1 : socket.data.input.shift ? -1 : 0,
        z: socket.data.input.z,
      };

      // normalize position (to handle diagonal movement, otherwise diagnoal movement would be faster than straight movement)
      const length = Math.sqrt(
        direction.x ** 2 + direction.y ** 2 + direction.z ** 2,
      );
      direction.x /= length == 0 ? 1 : length;
      direction.y /= length == 0 ? 1 : length;
      direction.z /= length == 0 ? 1 : length;

      const force = 500;
      const forceVec = {
        x: force * direction.x,
        y: force*3 * direction.y,
        z: force * direction.z,
      };

      const body: CANNON.Body = entityPhysicsBodyMap.get(socket.data.eid);
      body.applyForce(new CANNON.Vec3(forceVec.x, forceVec.y, forceVec.z));

      if (socket.data.input.space) {
        if (Player.canJump[socket.data.eid]) {
          body.velocity.y = 12;
        }
        Player.canJump[socket.data.eid] = 0;
      }

      //cast ray for pickup
      if(socket.data.input.E){
        let rayResult: CANNON.RaycastResult = new CANNON.RaycastResult();
        let rayOrigin = new CANNON.Vec3(Position.x[socket.data.eid],Position.y[socket.data.eid]!+cameraOffsetY,Position.z[socket.data.eid]);
        let rayDirection = new CANNON.Vec3(socket.data.input.targetDirection.x, socket.data.input.targetDirection.y, socket.data.input.targetDirection.z)
        
        rayDirection.normalize()
        physicsWorld.raycastClosest(rayOrigin.vadd(rayDirection.clone().vmul(new CANNON.Vec3(1.2,1.2,1.2))), rayOrigin.clone().vadd(rayDirection.clone().vmul(new CANNON.Vec3(5,5,5))),{},rayResult) //new CANNON.Ray(new CANNON.Vec3(Position.x[socket.data.eid],Position.y[socket.data.eid],Position.z[socket.data.eid]))
        if(hasComponent(world,Ball,rayResult.body?.id!)){
          removeEntity(world, rayResult.body?.id!);
          Player.numBalls[socket.data.eid] += 1;
        }
        

      }

      if(socket.data.input.right){
          Player.numBalls[socket.data.eid] =1
      }

      //shoot ball
      if(socket.data.input.left){
        if(Player.numBalls[socket.data?.eid!]!>0){
          let ballOrigin = new CANNON.Vec3(Position.x[socket.data.eid],Position.y[socket.data.eid]!+cameraOffsetY,Position.z[socket.data.eid]);
          let ballDirection = new CANNON.Vec3(socket.data.input.targetDirection.x, socket.data.input.targetDirection.y, socket.data.input.targetDirection.z)
          ballDirection.normalize()
          shootBall(ballOrigin.vadd(ballDirection.vmul(new CANNON.Vec3(1.1,1.1,1.1))), ballDirection,4000)
          Player.numBalls[socket.data.eid] -= 1;
        }
      }


      // Reset input
      socket.data.input.x = 0;
      socket.data.input.y = 0;
      socket.data.input.z = 0;
      socket.data.input.E = false;
      socket.data.input.targetDirection = null;
      socket.data.input.space = false;
      socket.data.input.shift = false;
      socket.data.input.left = false;
      socket.data.input.right = false;
    }

    for (const socket of subscribedSockets) {
      const payload = serialize(world as any[]);
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
