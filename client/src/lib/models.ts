import { GLTF, GLTFLoader } from "three/examples/jsm/Addons.js";
import { Game } from "./game";
import { Object3D } from "three";

export const models: Map<number, Object3D> = new Map();

// @ts-ignore
const paths: string[] = Object.keys(import.meta.glob("../../public/*.glb")).map(
  (path) => path.replace(/.*\/public/, ""),
);

export const progress: {
  [key: string]: number;
} = {};

function getTotalProgress() {
  let total = 0;
  Object.values(progress).forEach((p: number) => {
    total += p;
  });
  return total / Object.values(progress).length;
}

export async function loadModels(
  _game: Game,
  progressCallback?: (totalProgress: number) => void,
): Promise<Map<number, Object3D>> {
  console.log("LOADING MODELS:", paths);

  const loader = new GLTFLoader();

  const loadModel = (path: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const name = path.split("/").pop();
      if (name === undefined)
        reject("cannot extract id from file name: " + name);
      const id = parseInt(name!.split("-")[0]);
      if (isNaN(id)) reject("cannot extract id from file name: " + name);

      loader.load(
        path,
        (gltf: GLTF) => {
          console.log("loading model:", name);

          gltf.scene.traverse((child) => {
            child.castShadow = true;
            child.receiveShadow = true;
          });

          models.set(id, gltf.scene);
          resolve();
        },
        (xhr) => {
          progress[path] = xhr.loaded / xhr.total;
          progressCallback?.(getTotalProgress());
        },
      );
    });
  };

  const loadPromises: Promise<void>[] = paths.map((path) => loadModel(path));

  await Promise.all(loadPromises);

  console.log("MODELS LOADED:", models);

  return models;
}
