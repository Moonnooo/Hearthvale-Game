# Hearthvale

Hearthvale is a community-developed medieval multiplayer game, with a native
Godot desktop client and **World Studio**, its native map editor. The server owns
movement, combat, skills, inventory, equipment, banking and persistent accounts.

## Project layout

- `client/`: Godot game and World Studio, models, shaders and terrain materials.
- `backend/`: Node.js multiplayer server, SQLite persistence and regression tests.
- `shared/`: existing portable world/math utilities used by server tests.
- `world/`: world geometry submitted and reviewed through GitHub.
- `tools/`: validation and local world export/apply commands.

This repository contains the native application and editor with fresh history.
The browser version remains in its separate private repository. Changes here
do not automatically deploy to the existing website or VPS.

## Local setup

Install Node.js 22.18 or newer, Git LFS and Godot **4.7.2** with matching export
templates. Clone this repository, then run:

```sh
git lfs install
git lfs pull
npm ci --prefix backend
```

Copy `backend/.env.example` to `backend/.env`. From `backend/`, run `npm start`.
The example uses a fresh local database and the small original Hearthvale sample
world; it contains no production accounts or personal editor drafts.

Before launching the native client, build the GPU texture cache once:

```sh
godot --headless --path client --script res://tools/build_gpu_textures.gd
```

Open `client/project.godot` in Godot and run the project, or run:

```sh
godot --path client
godot --path client -- --editor-app
```

The client defaults to `http://127.0.0.1:8080`. Register a local account in the game
launcher, then use it in World Studio. To explicitly connect a game build to the
existing service, pass `--server=https://game.exudizmono.com` after `--`.
Production permissions remain controlled by the server, not the editor executable.

World Studio can save your account draft and preview it without publishing. To
test publishing locally, set your **local** username in `GAME_EDITOR_ADMINS` and
set `GAME_ALLOW_EDITOR_PUBLISH=1`, then restart the local server.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md). Submit code, editor improvements, assets
and map changes as pull requests. A maintainer reviews and merges changes before
a separate deployment. Merging does not automatically change the live game.

```sh
npm test
npm run world:check
```

Native export presets produce separate game and World Studio applications; use
Godot's matching official export templates. Executables, imported caches,
databases and credentials are excluded from Git. Source models and textures use
Git LFS.

## Assets and licensing

See [ASSETS.md](ASSETS.md). The code licensing decision is recorded separately;
public source access does not grant an unrestricted license to game art, audio,
branding or third-party assets.
