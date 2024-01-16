# SplatBall

A 3D multiplayer game where two teams build their base and then try to win by
wiping out the other team.


## Running

This script will compile the project to javascript and then run the server.

```sh
pnpm start
```

The application will be accessible under `http://localhost:8080`

You can also specify a custom port. In bash you would do:

```sh
PORT=8081 pnpm start
```

If you want to run the server without rebuilding. Use this command:
```sh
pnpm run production-server
```

## Project structure

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

## Running for development

> [!TIP]
> Check all possible scripts in the `package.json` file of each package.

Most commonly you will run the dev scripts for the client and server. You can
either enter the according directory and run `pnpm run dev` or, execute them
from the root of the directory like this:

```sh
pnpm run client
pnpm run server
```

These two will start the client and server in development mode, meaning that it
will look for code changes and restart automatically.

Don't forget to build the `shared` package when you edit it! Just run `pnpm run
build` in it's directory.

<!--For debugging, append `?debug` to the url: `http://localhost:5173/?debug`-->

## Using local bitECS for development

The project uses an external GitHub repo for bitECS instead of the local
submodule, but it may be more practical to use the local one for development.

To do that, you first have to add the package/directory to the workspace
definition file `pnpm-workspace.yaml`:

```yaml
packages:
  - server
  - client
  - shared
  - bitECS # Add this
```

Then, remove bitECS and reinstall using the `--workspace` argument in each
directory (client, server and shared).

```sh
cd client
pnpm remove bitecs
pnpm add bitecs --workspace

cd ../server
pnpm remove bitecs
pnpm add bitecs --workspace

cd ../shared
pnpm remove bitecs
pnpm add bitecs --workspace
```

To update the lock file, also enter this command in the root directory.
```sh
pnpm i
```

When you have pushed your changes to your repo, remove bitECS from the workspace and remove and add bitECS as a git repo:
```sh
cd client
pnpm remove bitecs
pnpm add gitHubUsername/bitECS#branch-name

# same for server/ and shared/
```

And then again run `pnpm i` in the root directory to clean up the lock file.

## Resources

- Creating a monorepo using pnpm workspaces
  - [Monorepo With PNPM Workspace](https://anasrar.github.io/blog/monorepo-with-pnpm-workspace/)
  - [How to Set Up a Monorepo With Vite, TypeScript, and Pnpm Workspaces]( https://hackernoon.com/how-to-set-up-a-monorepo-with-vite-typescript-and-pnpm-workspaces)
