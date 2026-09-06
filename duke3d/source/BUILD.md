# Rebuilding the browser engine

Base: Gawen Arab's EDuke32 Emscripten branch at
`ccf99ac328dda5aa981c4b8c2ecf2d5b3e572548`.

Upstream: https://voidpoint.io/gawen/eduke32-emscripten
Original browser-port review: https://voidpoint.io/terminx/eduke32/-/merge_requests/365

The adjacent `eduke32-browser-source.tar.gz` is the actual source used here,
including our changes. The SDK sample-map directory and temporary object files
are omitted; they are not inputs to this engine build. No original Duke game
data is included or required for compilation.

## Build

Requires Linux (or WSL), Bash, Python and Emscripten SDK **5.0.7**.
The SDK resolves to release hash
`6cd98e86d7749ff98b82b7f2ae78eb4f01942788`.

```sh
tar -xf eduke32-browser-source.tar.gz
cd eduke32
export EMSDK=/absolute/path/to/emsdk
LINK=1 bash build_wasm.sh
```

Install and activate that version using the standard Emscripten SDK commands
(`./emsdk install 5.0.7` and `./emsdk activate 5.0.7`) before building.
The compiler retrieves SDL **2.32.10**; its corresponding source archive is
provided as `SDL-2.32.10.zip`. Emscripten source for the SDK version is available
at https://github.com/emscripten-core/emscripten/tree/5.0.7.

Output: `webhost/eduke32.js` and `webhost/eduke32.wasm`.
Copy these two files into the player's `runtime/` directory.
Do not package or preload any DUKE3D.GRP file.

## Gameslop changes (2026-09-06)

- Build script reads the SDK location from `EMSDK` rather than `/opt/emsdk`.
- Emits a modular factory named `createEDuke32Module`, targeting browsers.
- Propagates linker failures as unsuccessful build exits.
- `source/build/src/sdlayer.cpp`: tiny exported `gameslop_key` and
  `gameslop_look` functions provide SDL keyboard input and relative mouse input
  for touchscreen controls.
- `source/duke3d/src/game.cpp`: read-only `gameslop_state` export reports menu /
  gameplay mode, player position, weapon ammo, clock, pause, application focus and
  simulation readiness for UI and input verification.

Gameplay rules, maps, textures, enemy definitions and weapons are unmodified.
Build uses the classic software renderer, SDL2, Asyncify and OPL3 music.
The modified functions are clearly marked in their source files.

## Licenses

The engine combines GPLv2 code and Build code under its own license.
Read `../licenses/gpl-2.0.txt`, `../licenses/buildlic.txt` and the preserved
license headers in the source. Build distribution is internet-only, free of
charge and subject to its noncommercial condition. Engine source access and
notices must accompany distribution. The game content has a separate license
and is supplied locally by each player.
