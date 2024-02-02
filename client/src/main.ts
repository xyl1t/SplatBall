import "./style.css";
import game from "./lib/game";

const parentDomElement = document.querySelector("#app") as HTMLElement;

game.setup({
  parentDomElement: parentDomElement,
  skyboxPath: "skybox.jpg",
  initialCameraPosition: {
    x: -8,
    y: 8,
    z: -2,
  },
});

game.start();

const div = document.createElement("div");

div.innerHTML = "+";

div.className = "rotate-45 text-white absolute left-[50%] translate-x-[-50%] top-[50%] translate-y-[-50%] pointer-events-none select-none text-3xl font-light";

parentDomElement.appendChild(div);
