# Slop in Time

An original GameSlop arcade brawler inspired by classic time-travel beat ’em ups. Six eras, twenty-four encounters, six bosses, solo and same-screen local co-op. Uses the supplied GameSlop mascot and original scenery, enemy artwork, music, and sounds.

## Play

Open `index.html`, or serve the repository's games directory with `python -m http.server 8765 --directory games` and visit `http://localhost:8765/slop-in-time/`.

Landscape is recommended on phones. Expand requests browser fullscreen, with an in-page fallback. Browser support determines whether orientation can be locked. Touch controls remain inside the fullscreen cabinet.

| Action | P1 | P2 | Gamepad | Mobile |
| --- | --- | --- | --- | --- |
| Move on the ground plane | Arrows | WASD | Left stick / D-pad | Thumbstick |
| Attack / three-hit combo | Hold X | Hold H | Hold X / RT | Hold Attack |
| Jump with automatic air kick | Z / Space | G | A / B | Jump Kick |
| Charged special | C | J | Y | Special when ready |
| Pause | P / Escape | Shared | Start | Pause |

Close in on a stunned or weakened ordinary enemy and attack to throw it. A thrown enemy damages others in its path. Bosses resist grabs and their warned attacks cannot be interrupted by ordinary punches. Move around enemy attacks or jump over them.

Break marked barrels for food (+35 health), energy (+30 special), and an era-specific melee weapon (18 swings). Landing attacks and scoring knockouts charges Special. A full meter unleashes an area attack without costing health.

Easy gives five lives and lighter enemy damage; Normal gives three lives; Hard gives two lives, extra enemies, and tougher opponents. Two continues restart the current era. Clearing an era restores health. Best scores are saved locally by difficulty and player count. Co-op requires both players to use the same browser; touch controls Player 1.

## Campaign

| Era | Setting | Boss | Signature attacks |
| --- | --- | --- | --- |
| Neon Afterhours / 199X | Rainy city docks | Knuckle Volt | Charging rush |
| Dead Man’s Dock / 1712 | Pirate harbor | Captain Brassjaw | Three-shot volleys |
| Primordial Punch / 65M BC | Volcanic jungle | King Fossil | Targeted ground pounce |
| Moonlit Shogunate / 1603 | Castle gardens | The Iron Ronin | Teleport behind the player |
| Last Train to Trouble / 1888 | Western railway town | Boiler Bill | Volleys and charging attacks |
| The Clockwork End / 3099 | Time-machine foundry | The Timekeeper | Radial projectiles and teleportation |

Each era contains four combat arenas. Clear enemies to release the camera and continue along the scrolling route. Health, energy and carried weapons are independent in co-op. There are no friendly attacks.

## Implementation and verification

- `js/engine.js`: pure deterministic simulation with seeded encounters, input recording, lane-based collision, jump height, combos, props, weapons, bosses, and campaign progression.
- `js/renderer.js`: illustrated backgrounds, depth-sorted fighters, scrolling ground, combat effects, and the supplied mascot.
- `js/game.js`: keyboard, simultaneous touch contacts, gamepad, pause, fullscreen, score storage, and optional embedding bridge.
- `js/audio.js`: original synthesized effects and six musical variations. Starts on interaction; Sound Off is remembered; pause/backgrounding stop playback.
- `skin/gameslop/`: self-contained game art. The mascot atlas is reused from Slop Commando with its supplied likeness.

Run `node --test` inside this directory. The tests cover input-driven combat, jump kicks, throws and collateral hits, boss resistance, pickups, co-op, pause, continues, deterministic replay, and a complete six-era campaign fought using real inputs and finite health.

Browser check from repository root:

```text
node tools/cdp-shot.js http://127.0.0.1:8765/slop-in-time/?debug=1 1440 1080 docs/game-screenshots/slop-in-time-qa.png --script tools/cdp-drivers/slop-in-time-qa.js --wait 150
```

The Chrome driver verifies keyboard and touch combat, quick taps, second-finger pause, input release on rotation, portrait and landscape phone layouts, fullscreen/fallback, loaded artwork, and all era visuals. Device emulation is automated; physical-phone testing remains manual.

`?seed=42` fixes the simulation seed; `?debug=1` exposes `window.__gameslop.{engine,renderer,audio,touch}`. There are no account or network multiplayer services. The optional iframe game-over message contains only game statistics.
