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

Collect hot dogs (+15 HP), pizza (+25), hamburgers (+35), ramen (+50), retro game cartridges (+30 Special), and era-specific melee weapons. The segmented health meter shows exact current/max HP. Each era has one heart that permanently adds one maximum HP for both co-op players during the current run, surviving deaths, stages and continues. A new run starts at 100 HP; collected hearts cannot be farmed by continuing. Food cannot heal beyond maximum HP. Every era has two weapons, with different reach, damage, swing speed and durability; there are twelve in total. Attack near a closed manhole, hatch or stone cover to lift and throw it through enemies. The open hole remains a hazard. There are only two throwable covers per era. Hit themed interactive scenery to stun foes or neutralize hazards. Use the clear lower lane to avoid overhead and tall hazards. Low hazards can be jumped. Steam rises in translucent clouds. Landing attacks and scoring knockouts charges Special. A full meter unleashes an area attack without costing health.

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

Each era contains ten combat arenas across seven named landmarks. Camera movement locks during combat and reinforcement gaps. Encounters randomly use one or two waves (up to three on Hard), separated by a short warning. Easy waves have 2-4 enemies, Normal 2-4 and Hard 3-6; co-op can add one, always capped at six. Boss encounters have one escort. Enemy health varies within each wave. Each era has its own arrangement of two or three curved diagonal descents. The detailed stitched panorama stays continuous through the bends, with the visible ground following the same geometry as collision. Story blocks are disabled pending the storyline. Routes measure 9,000–10,400 world pixels, longer than Commando’s 6,600-pixel outdoor stages. Clear enemies to release the camera and continue along the scrolling route. Health, energy and carried weapons are independent in co-op. There are no friendly attacks.

Each boss has its own original character art and two poses: transformer mech, crab pirate admiral, fossil tyrannosaur, spectral four-armed samurai, locomotive monster, and clock-headed sorcerer. Every boss has an armored, named superpower with marked danger areas and a dodge hint. At 30% health the boss turns red, moves faster, recovers faster, and uses its power more often. Warnings retain their full duration. Defeating a boss removes hazards and escorts, releases held controls, plays 2.3 seconds of cascading explosions, then fades the scene over two seconds before showing stage clear. Pause freezes this sequence too.

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

The adventure update adds `js/content.js` for route geometry, weapons, foods, enemy rosters and trap footprints. Run `tools/cdp-drivers/slop-in-time-adventure-qa.js` through the browser command above for attack pose captures, actual southbound traversal and aerial enemy checks. New sprite assets and final prompts are recorded in `docs/slop-in-time-adventure-art-v3.md`.


## Encounter revision

Each era has five themed enemies: basic fighter, shield guard, fast jumper, jumping projectile specialist, and flyer. Easy weights are 55/14/14/10/7 percent, Normal 36/18/19/17/10, and Hard 20/20/22/23/15. Ground enemies sometimes retreat defensively, and ordinary attacks have longer recovery. Projectile appearances match their era: arc bolts, bombs, venom, shurikens, bullets and pulses.

`tools/cdp-drivers/slop-in-time-revision-qa.js` captures all six diagonal routes, thirty enemy appearances, every food/cartridge/heart, interactive objects, cloud steam, and the boss explosion/fade/clear sequence. The existing mobile QA still covers all touch controls, rotation, co-op and browser fullscreen. No additional raster downloads are required: this revision reuses the stitched scene and character atlases with native Canvas pickup, trap and effect artwork.


## Camera and entrance update

Encounter release eases the horizontal camera toward its follow position, capped at 300 world pixels per second. Players remain inside the visible screen and the next encounter waits until its arena is in view. Player world positions are not recentered on release.

Fighters arrive from outside the screen in a staggered sequence: basic fighters leap in with an extended kick, guards charge, fast enemies flip, ranged fighters vault, and flyers swoop. Bosses have heavier themed arrivals: mech stomp, crab scuttle, fossil bound, spectral descent, locomotive charge, and rift materialization. Entrances count toward the six-enemy limit, pause with the game, and remain harmless/protected until landing, followed by a short attack recovery.

The six-era trap proposal is in `docs/slop-in-time-trap-proposal.html` at the source repository root. The approved design is implemented sparsely: three sites per era, never the reserve ideas. Run `tools/cdp-drivers/slop-in-time-entrance-qa.js` for actual entrance and camera-release browser checks.


## Sparse themed traps

There are exactly three hazard sites per era (after the opening encounters), spaced more than 1,700 world pixels apart. Each uses the upper lane and leaves at least 72 pixels clear below. Two themed types alternate across the three sites; difficulty does not add traps. Enemy entrance landings avoid the danger lane.

| Era | Hazards | Interactive scenery |
| --- | --- | --- |
| City | Wall-fed steam grate, live cabinet/cable/puddle | Hydrant, cutoff, rolling scooter |
| Pirate | Mounted cannon, crane-supported cargo sling | Guided powder barrel, capstan/net release |
| Jungle | Cracked-cliff rockfall, mineral geyser | Rolling log, slab to plug the vent |
| Temple | Guardian dart slots/pressure tiles, chained gate | Shrine bell, gate winch |
| West | Cart on rails, connected boiler outlet | Cart brake, cooling valve |
| Future | Gantry press, paired reactor nodes | Six-second pause console, battery canister |

Cycles start quietly when approached, with at least a full second of warning. Dart tiles require grounded contact. All hazards have a clear bypass; ordinary enemies can also be caught by them. Most controls disable their linked trap for the current stage visit. The press console becomes reusable after six seconds and restarts with a fresh warning cycle. Controls activate with Attack; guided objects travel to their linked mechanism. Two manholes remain per era. The old shared wrecking balls and generic crushers are no longer placed or drawn.

`tools/cdp-drivers/slop-in-time-traps-qa.js` checks all twelve hazard appearances, all linked controls, clear bypass lanes and the three-site limit in the browser.
