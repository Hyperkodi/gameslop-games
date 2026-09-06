# GoldenEye 64 / Gameslop browser player

Static HTTPS player. Press Play to start the Gameslop edition directly.
The browser downloads the published game, verifies its size and SHA-256 from
`game-manifest.json`, and passes the verified bytes to EmulatorJS.
Saves use browser storage through EmulatorJS; export backups from its toolbar.

Alec Trevelyan uses Vlad Tenev's likeness in both his 006 and Janus outfits.
Natalya uses Celina Tenev's likeness in her skirt and jungle outfits. Original
dialogue names, mission roles and body animations are retained. Restart the
mission after this update; older emulator states include older model data.

Click the game to capture the mouse: mouse aims, left-click fires, right-click
holds sights, WASD moves/strafe, R reloads/interacts, X changes weapons, and Esc
releases the cursor. Enter releases it and opens Start/the watch. Sensitivity
is in the toolbar. With the mouse released, original keyboard/controller
controls remain available. Native analog turn-speed limits still apply.

The runtime is EmulatorJS 4.2.3, loaded from its versioned CDN. See
`credits.html` for source and license links. A network connection is needed.

From the repository root, `python tools/build-goldeneye-public.py` packages
the current verified local build. It copies the browser shell, Gameslop artwork,
and the finished game to `data/gameslop.z64`. The unmodified source game,
runtime downloads, private QA files and build logs are not included.
The local game's `build-manifest.json` pins the exact published build.

Deploy `games/goldeneye/` to the `goldeneye/` path of the existing Pages mirror.
Test with `node --test tools/goldeneye-public.test.cjs tools/goldeneye-mouse.test.cjs`.
