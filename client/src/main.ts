import "./style.css";
import game from "./lib/game";

game.setup({
  parentDomElement: document.querySelector("#app") as HTMLElement,
  skyboxPath: "skybox.jpg",
  initialCameraPosition: {
    x: -8,
    y: 8,
    z: -2,
  },
});

game.start();
