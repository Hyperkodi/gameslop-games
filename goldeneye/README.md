# GoldenEye 64 / Gameslop browser player

Static HTTPS player. Select an original GoldenEye 007 (USA) `.zip` or `.z64`.
The browser validates its SHA-256, applies `gameslop.patch`, verifies the final
hash, and passes a local Blob URL to EmulatorJS. No upload endpoint or game ROM
is included. Selected bytes remain in memory until the page is closed/reloaded.
Saves use browser storage through EmulatorJS; export backups from its toolbar.

Click the game to capture the mouse: mouse aims, left-click fires, right-click
holds sights, WASD moves/strafe, R reloads/interacts, X changes weapons, and Esc
releases the cursor. Enter releases it and opens Start/the watch. Sensitivity
is in the toolbar. With the mouse released, original keyboard/controller
controls remain available. Native analog turn-speed limits still apply.

The runtime is EmulatorJS 4.2.3, loaded from its versioned CDN. See
`credits.html` for source and license links. A network connection is needed.

From the repository root, `python tools/build-goldeneye-public.py` packages
the current verified local build. It copies only the allowlisted browser shell
and original Gameslop artwork, then builds a sorted changed-byte delta. It
never copies the source ROM, runtime downloads, private QA files or build logs.
The local game's `build-manifest.json` pins both source and target hashes.

Deploy `games/goldeneye/` to the `goldeneye/` path of the existing Pages mirror.
Test with `node --test tools/goldeneye-public.test.cjs tools/goldeneye-mouse.test.cjs`.
