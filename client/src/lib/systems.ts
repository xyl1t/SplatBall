import { defineQuery, enterQuery, exitQuery, getEntityComponents } from "bitecs";
import { Box, Color, Me, Position, Quaternion, Sphere, componentNames } from "shared";
import { Game } from "./game";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/Addons.js";

const queryMe = defineQuery([Me]);
export function getMeEntity(world: any[]) {
  const [me] = queryMe(world);
  return me;
}

const queryPositionQuaternion = defineQuery([Position, Quaternion]);

const queryBox = defineQuery([Box]);
const queryBoxEnter = enterQuery(queryBox);
const queryBoxExit = exitQuery(queryBox);

const querySphere = defineQuery([Sphere]);
const querySphereEnter = enterQuery(querySphere);
const querySphereExit = exitQuery(querySphere);

export function positionSystem(game: Game) {
  const ids = queryPositionQuaternion(game.world);
  // console.log(ids);

  ids.forEach((eid) => {
    const obj = game.scene!.getObjectByName(eid.toString());

    obj?.quaternion.slerp(
      new THREE.Quaternion(
        Quaternion.x[eid],
        Quaternion.y[eid],
        Quaternion.z[eid],
        Quaternion.w[eid],
      ),
      game.cfg.lerpRatio,
    );

    obj?.position.lerp(
      new THREE.Vector3(Position.x[eid], Position.y[eid], Position.z[eid]),
      game.cfg.lerpRatio,
    );

  });

  if(!game.debug.debugControlsActive){

    //enable camera movement, if player spawns
    if(game.playerId!=-1){

      game.camera?.position.lerp(
        new THREE.Vector3(Position.x[game.playerId], Position.y[game.playerId], Position.z[game.playerId]),
          game.cfg.lerpRatio,
      );

      let mouseSens = game.mouse.sensitivity||0.01; //mouse sensitivity
  
      game.camera?.rotateOnWorldAxis(new THREE.Vector3(0,1,0),game.mouse.dx*mouseSens); 
  
      let worldDirectionY = game.camera?.getWorldDirection(new THREE.Vector3()).y||0;
  
      //check for y boundaries
      if((game.mouse.dy>0&&worldDirectionY+game.mouse.dy*mouseSens<1)||(game.mouse.dy<0&&worldDirectionY+game.mouse.dy*mouseSens>(-1)))
        game.camera?.rotateOnAxis(new THREE.Vector3(1,0,0),game.mouse.dy*mouseSens);
      
  
      game.mouse.dx = 0;
      game.mouse.dy = 0;
  
    }else{
      game.camera?.position.lerp(
        new THREE.Vector3(game.cfg.initialCameraPosition.x, game.cfg.initialCameraPosition.y, game.cfg.initialCameraPosition.z),
          game.cfg.lerpRatio,
      );
    }

  }
  
  

}

export function renderSystem(game: Game) {
  const addLabelToMesh = (mesh: THREE.Object3D, text: string) => {
    const labelDiv = document.createElement("iv");
    labelDiv.className =
      "font-mono text-[10px] bg-black/25 text-white whitespace-pre rounded px-1 py-0";
    labelDiv.textContent = text;
    const label = new CSS2DObject(labelDiv);
    label.name = "label";
    label.position.set(0, 0, 0);
    label.center.set(0, 0);
    label.layers.set(1);
    mesh.add(label);

  };

  // ENTERED
  queryBoxEnter(game.world).forEach((eid) => {
    console.log("+++ box entered", eid);

    const geometry = new THREE.BoxGeometry(
      Box.width[eid],
      Box.height[eid],
      Box.depth[eid],
    );
    const material = new THREE.MeshStandardMaterial({
      color: Color.value[eid],
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = eid.toString();
    mesh.position.set(Position.x[eid], Position.y[eid], Position.z[eid]);
    mesh.quaternion.set(
      Quaternion.x[eid],
      Quaternion.y[eid],
      Quaternion.z[eid],
      Quaternion.w[eid],
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    addLabelToMesh(mesh, eid.toString());

    game.scene!.add(mesh);
  });

  querySphereEnter(game.world).forEach((eid) => {
    console.log("+++ sphere entered", eid);

    const geometry = new THREE.SphereGeometry(Sphere.radius[eid], 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: Color.value[eid],
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = eid.toString();
    mesh.position.set(Position.x[eid], Position.y[eid], Position.z[eid]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    addLabelToMesh(mesh, eid.toString());

    game.scene!.add(mesh);
  });

  // EXITED

  queryBoxExit(game.world).forEach((eid) => {
    console.log("--- box exited", eid);
    const mesh = game.scene!.getObjectByName(eid.toString());
    if (!mesh) return;
    mesh.remove(mesh.getObjectByName("label")!);
    game.scene!.remove(mesh);
  });

  querySphereExit(game.world).forEach((eid) => {
    console.log("--- sphere exited", eid);
    const mesh = game.scene!.getObjectByName(eid.toString());
    if (!mesh) return;
    mesh.remove(mesh.getObjectByName("label")!);
    game.scene!.remove(mesh);
  });
}

export function labelSystem(game: Game) {
  queryPositionQuaternion(game.world).forEach((eid) => {
    const label = game.scene!.getObjectByName(eid.toString())?.getObjectByName("label") as CSS2DObject;
    if (!label) return;

    let textContent = "";
    if (game.debug.labels.showEids)
      textContent += `${eid}${eid == game.playerId ? " (you)" : ""}\n`;
    if (game.debug.labels.showComponents) {
      textContent += "Components:\n";
      textContent += getEntityComponents(game.world, eid)
        .map(
          (c) =>
            "- " +
            componentNames.get(c) +
            (game.debug.labels.showDetails
              ? "\n  " +
                Object.values(c)
                  .map((v) => {
                    if (typeof v[eid] === "number") {
                      return v[eid].toFixed(3);
                    }
                    return v[eid];
                  })
                  .join("\n  ")
              : ""),
        )
        .join("\n");
    }

    label.element.textContent = textContent;
  });
}
