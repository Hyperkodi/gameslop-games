# Slop Commando

A complete eight-stage, original run-and-gun campaign starring GameSlop's glossy red mascot: expressive eyes, a droplet tuft, gloves, boots and a black belly D-pad. His likeness comes from the supplied `Assets/photo_2026-09-04_01-24-35.jpg` reference. Inspired by classic arcade shooters; does not include Contra's level layouts, characters, graphics, music, or code.

## Play

Open `index.html` directly, or serve the arcade root:

```powershell
python -m http.server 8765 --directory games
```

Visit `http://localhost:8765/commando/`. For a phone on the same Wi-Fi, use the computer's LAN IP with port 8765, subject to its existing firewall settings. There are no build steps, external assets, dependencies, accounts, or network requests required to play.

The canvas always uses a landscape 960 × 540 playfield. Phones can be held in portrait, but landscape gives much larger gameplay and thumb controls on either side. **Expand** requests native browser fullscreen and landscape orientation where supported. An expanded in-page view handles browsers without element fullscreen. Orientation locking is browser-dependent; manually rotate the phone if necessary. Touch controls remain inside the fullscreen container.

## Controls

| Action | Player 1 | Player 2 | Gamepad |
| --- | --- | --- | --- |
| Move / aim | Arrow keys | WASD | D-pad / left stick |
| Jump | Z / Space | G | A |
| Fire (hold) | X / C | H | X / B / RT |
| Pause | Escape / P | Shared | Start |
| Sound | M | Shared | Onscreen button |

Enter starts from the title screen. Down crouches, down + jump drops through one-way platforms, and airborne down aims downward. On phones, slide a thumb on the D-pad to move/aim diagonally and hold Fire with the other thumb. Multi-touch supports movement, jumping and firing together. In bunker missions, move within the foreground floor, fire at the three red cores, and jump to dodge enemy bullets. Fire defaults upward in bunkers. Co-op supports a shared keyboard or two standard-mapped gamepads; touch operates player one.

## Campaign

1. **Verdant Outpost** — a longer jungle route through canopy, ravines and the Bastion perimeter cannon.
2. **Signal Bunker** — three security chambers; Watchtower lane salvos.
3. **Spillway Ascent** — a 2,860px forward-looking 45° climb from flood basin to dam crest; Undertow drone carrier.
4. **Furnace Network** — three reactor chambers; Overseer sentry.
5. **Whiteout Relay** — ice shelves, relay towers and a whiteout pass; Frostbite siege walker and ground shots.
6. **Cinder Foundry** — conveyor spans, furnace decks and timed flame vents; Crucible furnace and ground shots.
7. **The Underflow** — flooded caverns, broken shelves and drone nests; Maw radial bursts and reinforcements.
8. **Heart of the Slop** — a longer living-core route; The Source's alternating aimed and radial barrages.

Eight guns: standard rifle, machine gun, spread shot, piercing laser, short-range flame, grenade launcher, homing rocket and wave cannon. Grenades arc and burst nearby targets, rockets seek the closest live enemy, and the wave cannon sends a wide piercing pulse. B grants a 12-second barrier; R grants 20 seconds of rapid fire. Every 15,000 points awards an extra life. Arcade starts with 3 lives per player; Assist starts with 12 and slows ordinary enemy firing. Both include 3 continues. Continuing restarts the current stage; a death respawns at a safe checkpoint with brief protection and the standard rifle. The campaign ends after the eighth boss and shows score, time and continues used.

Collectibles use actual weapon silhouettes instead of letter boxes: a twin-barrel spread gun, belt-fed machine gun, glowing rail-style laser rifle, flamethrower with fuel cylinders and hose, break-action grenade launcher, guided rocket tube, and coil-driven wave cannon. The mascot carries the matching weapon after collection. Barrier uses a shield, and rapid fire uses cartridges with a lightning symbol. A glow and orbiting sparks mark collectibles; nearby pickups show their names. Pickup collision includes the full weapon width. The guide uses the same illustrations, and special weapons are intentionally rare: only a few fixed caches per stage and a 2.5% temporary drop chance from ordinary enemies.

Best scores are stored locally by difficulty and player count. Sound uses the arcade's shared `gameslop:muted` preference. CRT is optional. The game pauses on focus loss and when backgrounded.

## Architecture

- `js/levels.js`: original level specifications and collision geometry, including longer 6,600px horizontal routes with biome-specific landmarks, enemy mixes, gaps and hazards, plus a 2,860px spillway switchback.
- `js/engine.js`: deterministic 60 Hz simulation; CommonJS export for tests and classic browser script. Uses the shared kit RNG. Rendering and audio never influence simulation.
- `js/renderer.js`: canvas composition, recognizable infantry, sentry, drone, reactor and boss silhouettes, projectile effects, and procedural scenery as an image-loading fallback.
- `js/environment.js`: connected illustrated scenery sections across each entire stage, with feathered joins, mist, snow, embers and textured terrain. Horizontal scenery follows the camera; Spillway uses a forward-looking 45° water-channel view and matching trapezoidal landings; bunker scenery advances smoothly as security cores and chambers are cleared. Only visible section canvases and the current/next stage atlases are retained during normal play. See `../../docs/commando-environments-v2.md` for assets, generation prompts and checks.
- `js/weapon-art.js`: shared canvas weapon models for world pickups, equipped guns and the field guide, using the skin's weapon palette. These work offline without additional images or dependencies.
- `js/mascot.js`: reference-based mascot sprite animation with idle, run, jump, crouch and victory poses, facing, gun aiming, co-op tint and a recognizable procedural fallback. Standing art renders 64 pixels tall while the existing collision box remains unchanged. Invulnerability fades him instead of hiding him completely.
- `js/game.js`: two-player input, multi-touch D-pad, gamepads, state overlays, audio, preferences and fullscreen. A dedicated landscape controller reuses the kit RNG/audio without altering the existing games' portrait shell.
- `skin/gameslop/`: supplied logo/icon copies, color/frame manifest, generated mascot and environment atlases, and offline JS twins. The original `Assets/` files are untouched. Mascot atlas loading composites out its pale background once, preserving enclosed eyes and highlights. Its embedded image source avoids cross-origin canvas restrictions when opened with `file://`. The environment atlas loads directly as a local PNG without pixel readback.

`?seed=42` fixes the random seed; `?debug=1` exposes `window.__gameslop.{engine,renderer}`. Engines record tick-indexed input changes. A completed/failed embedded run emits the existing arcade bridge shape: `{v:1, type:'gameover', game:'commando', skin:'gameslop', score, seed, inputsHash, stats}`. Like the other arcade games, this is a local game result, not an authoritative rewards service.

## Verification

```powershell
# From games/commando
node --test

# From repository root, with the local server running
node tools/cdp-shot.js "http://127.0.0.1:8765/commando/?debug=1" 1440 1080 docs/game-screenshots/commando-qa-final.png --script tools/cdp-drivers/commando-qa.js
```

The 39-test engine suite covers physics, collision, weapons, pickups, deaths, checkpoints, co-op, continues, deterministic replay, all eight boss transitions, all six bunker chambers, longer varied routes, the safe Spillway switchback, victory and bounded entity counts. The browser driver uses actual keyboard/multi-touch input and checks desktop/phone layouts, pause/resume, sound, CRT, native fullscreen and its fallback. The scrolling browser driver verifies all seven scenery sections in every stage. Chrome phone emulation is automated coverage; physical iOS/Android device and controller checks remain manual.
