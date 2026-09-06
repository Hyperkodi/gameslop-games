# Slop in Time

An original GameSlop arcade brawler inspired by classic time-travel beat ’em ups. Six eras, sixty encounters, six bosses, solo and same-screen local co-op. Uses the supplied GameSlop mascot and original scenery, enemy artwork, music, and sounds.

## Play

Open `index.html`, or serve the repository's games directory with `python -m http.server 8765 --directory games` and visit `http://localhost:8765/slop-in-time/`.

Landscape is recommended on phones. Expand requests browser fullscreen, with an in-page fallback. Browser support determines whether orientation can be locked. Touch controls remain inside the fullscreen cabinet.

| Action | P1 | P2 | Gamepad | Mobile |
| --- | --- | --- | --- | --- |
| Move on the ground plane | Arrows | WASD | Left stick / D-pad | Thumbstick |
| Attack / three-hit combo | Hold X | Hold H | Hold X / RT | Hold Attack |
| Jump (press Attack in the air to kick) | Z / Space | G | A / B | Jump |
| Charged special | C | J | Y | Special when ready |
| Pause | P / Escape | Shared | Start | Pause |

Close in on a stunned or weakened ordinary enemy and attack to throw it. A thrown enemy damages others in its path. Bosses resist grabs and their warned attacks cannot be interrupted by ordinary punches. Move around enemy attacks or jump over them. Jump alone never attacks and now reaches about 170 pixels. Press Attack while airborne to kick; ordinary ground punches cannot reach a high-flying enemy. Shield guards block frontal jabs but are vulnerable to finishers, weapons, and jump kicks.

Collect visible food (+35 health), energy drinks (+30 special), and era-specific melee weapons. Every era has two weapons, with different reach, damage, swing speed and durability; there are twelve in total. Attack near a closed manhole, hatch or stone cover to lift and throw it through enemies. The open hole remains a hazard. Landing attacks and scoring knockouts charges Special. A full meter unleashes an area attack without costing health.

Easy gives five lives and lighter enemy damage; Normal gives three lives; Hard gives two lives, extra enemies, and tougher opponents. Two continues resume at the latest checkpoint (after encounters 3, 6 and 9). Checkpoints restore 45 health and 25 special energy. Clearing an era restores health. Best scores are saved locally by difficulty and player count. Co-op requires both players to use the same browser; touch controls Player 1.

## Campaign

| Era | Setting | Boss | Signature attacks |
| --- | --- | --- | --- |
| Neon Afterhours / 199X | Rainy city docks | Knuckle Volt | Grid Overload: two lightning lanes |
| Dead Man’s Dock / 1712 | Pirate harbor | Captain Brassjaw | Cannon Rain: four marked impacts |
| Primordial Punch / 65M BC | Volcanic jungle | King Fossil | Extinction Stomp: traveling shockwaves |
| Moonlit Shogunate / 1603 | Castle gardens | The Iron Ronin | Shadow Cross: three staggered slashes |
| Last Train to Trouble / 1888 | Western railway town | Boiler Bill | Boiler Burst: three steam vents |
| The Clockwork End / 3099 | Time-machine foundry | The Timekeeper | Time Rupture: two expanding rings |

Each era contains ten combat arenas and three additional ambush waves across seven named landmarks. Two southbound connectors require Down movement and use an overhead view with vertical camera travel. Story blurbs introduce each era, guide the detours, and set up the boss. A different aerial enemy and environmental trap match each era. Routes measure 9,000–10,400 world pixels, longer than Commando’s 6,600-pixel outdoor stages. Clear enemies to release the camera and continue along the scrolling route. Health, energy and carried weapons are independent in co-op. There are no friendly attacks.

Each boss has its own original character art and two poses: transformer mech, crab pirate admiral, fossil tyrannosaur, spectral four-armed samurai, locomotive monster, and clock-headed sorcerer. Every boss has an armored, named superpower with marked danger areas and a dodge hint. At 30% health the boss turns red, moves faster, recovers faster, and uses its power more often. Warnings retain their full duration. Defeating a boss removes its remaining hazards.

## Implementation and verification

- `js/engine.js`: pure deterministic simulation with seeded encounters, input recording, lane-based collision, jump height, combos, props, weapons, bosses, and campaign progression.
- `js/renderer.js`: stitched pixel-art panoramas, depth-sorted fighters, scrolling ground, combat effects, and the supplied mascot.
- `js/game.js`: keyboard, simultaneous touch contacts, gamepad, pause, fullscreen, score storage, and optional embedding bridge.
- `js/audio.js`: original synthesized effects and six musical variations. Starts on interaction; Sound Off is remembered; pause/backgrounding stop playback.
- `skin/gameslop/`: self-contained game art. The mascot and enemies are redrawn as 16-bit pixel art while preserving their supplied likenesses. See docs/slop-in-time-pixel-art-v2.md for the asset prompts.

Run `node --test` inside this directory. The tests cover input-driven combat, jump kicks, throws and collateral hits, boss resistance, pickups, co-op, pause, continues, deterministic replay, and a complete six-era campaign fought using real inputs and finite health.

Browser check from repository root:

```text
node tools/cdp-shot.js http://127.0.0.1:8765/slop-in-time/?debug=1 1440 1080 docs/game-screenshots/slop-in-time-qa.png --script tools/cdp-drivers/slop-in-time-qa.js --wait 150
```

The Chrome driver verifies keyboard and touch combat, quick taps, second-finger pause, input release on rotation, portrait and landscape phone layouts, fullscreen/fallback, loaded artwork, and all era visuals. Device emulation is automated; physical-phone testing remains manual.

Use `tools/cdp-drivers/slop-in-time-pixel-qa.js` with the same command to check all six panorama joins, end-of-route scenery coverage, boss power warnings and actual red sprite pixels. The art renders at 480 × 270 with nearest-neighbor enlargement; the HUD stays at 960 × 540. All final artwork and generation prompts are documented in `docs/slop-in-time-pixel-art-v2.md` at the repository root.

`?seed=42` fixes the simulation seed; `?debug=1` exposes `window.__gameslop.{engine,renderer,audio,touch}`. There are no account or network multiplayer services. The optional iframe game-over message contains only game statistics.

The adventure update adds `js/content.js` for route geometry, weapons and story text. Run `tools/cdp-drivers/slop-in-time-adventure-qa.js` through the browser command above for attack pose captures, actual southbound traversal and aerial enemy checks. New sprite assets and final prompts are recorded in `docs/slop-in-time-adventure-art-v3.md`.
