import { Game } from "./game";

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

  function handleWindowResize(_event: UIEvent) {
    game.camera!.aspect = window.innerWidth / window.innerHeight;
    game.camera!.updateProjectionMatrix();
    game.renderer!.setSize(window.innerWidth, window.innerHeight);
    game.debug.labelRenderer!.setSize(window.innerWidth, window.innerHeight);
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

export function getInputPayload(game: Game) {
  const inputPayload = {
    x: 0,
    z: 0,
    shift: false,
    space: false,
    left: game.mouse.left,
    right: game.mouse.right,
  };

  let hasInput = false;

  if (game.keyboard.w || game.keyboard.arrowup) {
    inputPayload.x = 1;
    hasInput = true;
  }

  if (game.keyboard.s || game.keyboard.arrowdown) {
    inputPayload.x = -1;
    hasInput = true;
  }

  if (game.keyboard.a || game.keyboard.arrowleft) {
    inputPayload.z = -1;
    hasInput = true;
  }

  if (game.keyboard.d || game.keyboard.arrowright) {
    inputPayload.z = 1;
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

  if (game.mouse.left) {
    inputPayload.left = true;
    hasInput = true;
  }

  if (game.mouse.right) {
    inputPayload.right = true;
    hasInput = true;
  }

  return hasInput ? inputPayload : undefined;
}

