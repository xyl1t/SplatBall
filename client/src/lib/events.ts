import { Vector3 } from "three";
import { Game } from "./game";
import { getCameraDirection } from "./systems";

export default function setupEventListeners(game: Game) {
  if (!game.renderer) {
    throw new Error("Renderer not initialized");
  }
  if (!game.camera) {
    throw new Error("Camera not initialized");
  }
  if (!game.debug.labelRenderer) {
    throw new Error("LabelRenderer not initialized");
  }

  // TODO: remove in cleanup()
  window.addEventListener("resize", handleWindowResize, false);
  window.addEventListener("keydown", handleKeyDown, false);
  window.addEventListener("keyup", handleKeyUp, false);
  window.addEventListener("mousemove", handleMouseMove, false);
  window.addEventListener("mousedown", handleMouseDown, false);
  window.addEventListener("mouseup", handleMouseUp, false);
  window.addEventListener("mouseleave", handleMouseLeave, false);
  document.addEventListener(
    "pointerlockchange",
    handlePointerLockChange,
    false,
  );

  function handleWindowResize(_event: UIEvent) {
    game.camera!.aspect = window.innerWidth / window.innerHeight;
    game.camera!.updateProjectionMatrix();
    game.renderer!.setSize(window.innerWidth, window.innerHeight);
    game.debug.labelRenderer!.setSize(window.innerWidth, window.innerHeight);
  }

  //delay for pointer lock, to prevent errors
  function handlePointerLockChange(_event: any) {
    lastPointerLockChange = Date.now();
  }

  function handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    game.keyboard[key] = true;
    game.keyCode[event.code] = true;

    if (game.keyboard["f12"]) {
      game.debug.enabled = !game.debug.enabled;
    }

    // DEBUG KEYS //

    // NOTE: it's necessary to use the "code" from the event instead of the "key"
    // because clicking alt+key will register a different character
    if (game.keyCode["AltLeft"] && game.keyCode["ControlLeft"]) {
      if (game.keyCode.KeyD) {
        game.debug.enabled = !game.debug.enabled;
      }
      if (game.keyCode.KeyJ) {
        game.joinGame();
      }
      if (game.keyCode.KeyL) {
        game.leaveGame();
      }
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    game.keyboard[event.key.toLowerCase()] = false;
    game.keyCode[event.code] = false;
  }

  function handleMouseMove(event: MouseEvent) {
    game.mouse.x = event.pageX - game.renderer!.domElement.offsetLeft;
    game.mouse.y = event.pageY - game.renderer!.domElement.offsetTop;
    game.mouse.dx = document.pointerLockElement ? event.movementX * -1 : 0; //inverted mouse-delta, only if pointer is locked
    game.mouse.dy = document.pointerLockElement ? event.movementY * -1 : 0;
    game.mouse.left = (event.buttons & 1) == 1;
    game.mouse.right = (event.buttons & 2) == 2;
  }

  function handleMouseDown(event: MouseEvent) {
    game.mouse.x = event.pageX - game.renderer!.domElement.offsetLeft;
    game.mouse.y = event.pageY - game.renderer!.domElement.offsetTop;
    game.mouse.left = (event.buttons & 1) == 1;
    game.mouse.right = (event.buttons & 2) == 2;
  }

  function handleMouseUp(event: MouseEvent) {
    game.mouse.x = event.pageX - game.renderer!.domElement.offsetLeft;
    game.mouse.y = event.pageY - game.renderer!.domElement.offsetTop;
    game.mouse.left = (event.buttons & 1) == 1;
    game.mouse.right = (event.buttons & 2) == 2;
  }

  function handleMouseLeave(event: MouseEvent) {
    game.mouse.x = event.pageX - game.renderer!.domElement.offsetLeft;
    game.mouse.y = event.pageY - game.renderer!.domElement.offsetTop;
    game.mouse.left = false;
    game.mouse.right = false;
  }
}

let lastPointerLockChange = Date.now();
export function getInputPayload(game: Game) {
  const inputPayload = {
    x: 0,
    z: 0,
    E: false,
    targetDirection: new Vector3,
    shift: false,
    space: false,
    left: game.mouse.left,
    right: game.mouse.right,
  };

  let hasInput = false;

  if (game.keyboard.w || game.keyboard.arrowup) {
    let angleYPlayerDeg = game.camera!.rotation.y;
    //calculate x and z values based on camera direction
    inputPayload.x = Math.sin(angleYPlayerDeg) * -1; //inverted
    inputPayload.z = game.camera?.getWorldDirection(new Vector3()).z || 0;

    hasInput = true;
  }

  //all following events have to add up the input payload of the events before, so that for example
  //pressing 'w' and 's' at the same time resolves in no movement.

  if (game.keyboard.s || game.keyboard.arrowdown) {
    let angleYPlayerDeg = game.camera!.rotation.y;

    //calculate x and z values based on camera direction
    inputPayload.x = Math.sin(angleYPlayerDeg) + inputPayload.x;
    inputPayload.z =
      (game.camera?.getWorldDirection(new Vector3()).z || 0) * -1 +
      inputPayload.z; //inverted

    hasInput = true;
  }

  if (game.keyboard.a || game.keyboard.arrowleft) {
    let angleYPlayerDeg = game.camera!.rotation.y;

    //calculate x and z values based on camera direction
    inputPayload.z = Math.sin(angleYPlayerDeg) + inputPayload.z;
    inputPayload.x =
      (game.camera?.getWorldDirection(new Vector3()).z || 0) + inputPayload.x;

    hasInput = true;
  }

  if (game.keyboard.d || game.keyboard.arrowright) {
    let angleYPlayerDeg = game.camera!.rotation.y;

    //calculate x and z values based on camera direction
    inputPayload.z = Math.sin(angleYPlayerDeg) * -1 + inputPayload.z; //inverted
    inputPayload.x =
      (game.camera?.getWorldDirection(new Vector3()).z || 0) * -1 +
      inputPayload.x; //inverted

    hasInput = true;
  }

  if (game.keyboard[" "]) {
    inputPayload.space = true;
    hasInput = true;
  }

  if (game.keyboard.shift) {
    inputPayload.shift = true;
    hasInput = true;
  }

  if (game.keyboard.e) {
    inputPayload.E = true;
    hasInput = true;
  }

  if (game.mouse.left) {
    inputPayload.left = true;
    hasInput = true;

    if (
      !game.debug.debugControlsActive &&
      !document.pointerLockElement &&
      lastPointerLockChange + 1300 < Date.now()
    ) {
      game.cfg.parentDomElement.requestPointerLock();
      game.debug.controls!.enabled = false;
    }
  }

  if (game.mouse.right) {
    inputPayload.right = true;
    hasInput = true;
  }

  inputPayload.targetDirection = getCameraDirection(game);
  

  return hasInput ? inputPayload : undefined;
}
