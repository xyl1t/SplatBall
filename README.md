# SplatBall

A 3D multiplayer game where two teams build their base and then try to win by
wiping out the other team.

## Development

This project uses [pnpm](https://pnpm.io/) as its package manager and makes use
of its [workspace](https://pnpm.io/workspaces) feature.

The project is divided into three parts/directories:

- `server/`: This is the server of the game. It serves the client and manages
  the socket/player connections (using [Socket.IO](https://socket.io/)), it also
  holds the state of the game according to the ECS pattern (using
  [bitECS](https://github.com/NateTheGreatt/bitECS)) and sends it to the
  clients for rendering. For physics,
  [cannon-es](https://github.com/pmndrs/cannon-es) is used.

- `client/`: The client is a react application (for no real reason, could've
  been a vainlla JS client as well). It uses 
  [three.js](https://github.com/mrdoob/three.js/) for rendering the game state
  it receives from the server.

- `shared/`: This package contains custom code that both the server and client
  use. Currently it stores the bitECS components and systems.

## Running

> [!TIP]
> Check all possible scripts in the `package.json` file of each package.

Most commonly you will run the dev scripts for the client and server. You can
either enter the according directory and run `pnpm run dev` or, execute them
from the root of the directory like this:

```
pnpm run client
pnpm run server
```

These two will start the client and server in development mode, meaning that it
will look for code changes and restart automatically.

For debugging, append `?debug` to the url: `http://localhost:5173?debug`

## Deployment

This script build the frontend and starts the server.

```
pnpm start
```

## Resources

- Creating a monorepo using pnpm workspaces
  - [Monorepo With PNPM Workspace](https://anasrar.github.io/blog/monorepo-with-pnpm-workspace/)
  - [How to Set Up a Monorepo With Vite, TypeScript, and Pnpm Workspaces]( https://hackernoon.com/how-to-set-up-a-monorepo-with-vite-typescript-and-pnpm-workspaces)
