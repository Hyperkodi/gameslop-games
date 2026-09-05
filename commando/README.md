# Slop Commando

An original eight-stage GameSlop run-and-gun campaign starring the supplied red D-pad mascot. Play solo or local co-op in a landscape browser canvas, with keyboard, gamepad, or mobile touch controls.

## Play

Live: https://hyperkodi.github.io/gameslop-games/commando/

Open `index.html` directly, or run `python -m http.server 8765 --directory games` from the repository root and visit `http://localhost:8765/commando/`. All runtime assets are local; no install or build is needed.

Hold a phone in landscape for the largest playfield. **Expand** requests browser fullscreen and landscape orientation where supported. An in-page expanded view supports browsers without element fullscreen; rotate the phone manually if orientation locking is unavailable.

## Controls

| Action | Player 1 | Player 2 | Gamepad |
| --- | --- | --- | --- |
| Move / aim | Arrow keys | WASD | D-pad / left stick |
| Jump | Z / Space | G | A |
| Fire (hold) | X / C | H | X / B / RT |
| Swap holstered gun | V | J | Y |
| Pause | Escape / P | Shared | Start |
| Sound | M | Shared | Onscreen button |

On mobile, drag anywhere on the circular thumbstick to move or aim. **AUTO FIRE** starts enabled for touch play, so you can move with one thumb and use the larger **JUMP** button with the other. The toggle remembers your preference; **FIRE** remains available for manual firing. Player 1 keyboard and gamepad input turn off touch auto-fire until you touch the game again; Player 2 can keep playing alongside your touch controls.

**SWAP** exchanges carried guns, and **DROP** descends one ledge per tap without needing a down + jump combination. Drop is disabled in overhead bunker stages and does nothing on solid ground. Down crouches in side-scrolling stages; down + jump still drops through a ledge. In bunker stages, move on the overhead floor, fire upward toward cores, and jump to dodge shots.

Jump accepts a press up to 100ms after stepping off a ledge or 120ms before landing. Quick taps register even between simulation ticks. Rotation, pause, and backgrounding release held controls.

In Spillway, hold Down and press Jump to descend one ledge; release Jump before dropping again. The camera follows your retreat. The boss crest has safe landing shelves directly below its full width, and you can jump back up.

## Difficulty and equipment

| Mode | Lives | Gun supply | Weapon slots | Upgrade memory | Nukes |
| --- | --- | --- | --- | --- | --- |
| Easy | 12 | Frequent caches; 10% enemy drop chance | 2 | Retained for the run | Yes |
| Normal | 3 | Fewer caches; 4.5% enemy drop chance | 2 | Retained for the run | Yes |
| Hard | 3 | Rare caches; 1.5% enemy drop chance | 1 | Lost when discarded | No |

Drop probabilities include utility pickups. Hard also adds authored enemies, more frequent reinforcements, and faster enemy fire. All modes have three continues, checkpoint respawns, brief respawn protection, and an extra life every 15,000 points. Legacy `assist` and `arcade` engine configurations map to Easy and Normal.

A new gun becomes active and holsters your previous active gun on Easy/Normal. If both slots are occupied, the old holstered gun is discarded. Collecting a duplicate of either carried gun upgrades that gun without switching slots. Swap exchanges the two carried guns.

Every gun has five tiers. Each successive tier increases damage, projectile size, and firing speed; blast weapons also gain splash radius and damage. Tesla gains additional chain targets and cryo gains slow duration. Tier five is the cap. On Easy/Normal, re-acquiring a discarded or lost gun restores its previous tier for the current run, including after death and continues. Starting a new run resets progression. On Hard, replacing or losing a gun erases its upgrades; reacquiring it starts at tier one. Co-op equipment and progression are independent.

## Arsenal and power-ups

Eleven guns: rifle, machine gun, spread gun, laser rifle, flamethrower, grenade launcher, homing rocket, wave cannon, Tesla carbine, cryo blaster, and plasma cannon.

Tesla chains electricity between nearby targets. Cryo slows ordinary enemy movement and attack cadence. Plasma fires heavy explosive bolts. Grenades arc and explode; rockets seek; laser and wave projectiles pierce.

- **Cloak:** breaks enemy pursuit and aimed targeting for eight seconds. Enemies can target a visible co-op partner. Existing shots, contact, hazards, and non-aimed boss patterns remain dangerous.
- **Screen nuke:** detonates immediately on collection, destroys visible non-boss enemies, and clears visible enemy shots. Offscreen enemies and bosses survive. Disabled on Hard.
- **Barrier:** prevents ordinary damage for twelve seconds.
- **Rapid fire:** faster firing for twenty seconds.

Pickups and equipped weapons use distinct silhouettes. HUD labels show active tier, holstered gun/tier, and timed effects.

## Campaign

The outdoor run stages span 6,600px with biome-specific ledges, gaps, hazards, and encounters. Spillway spans 2,860px vertically. Each stage has a boss and one exclusive new enemy:

Spillway mixes narrow concrete steps, broad steel bridges, and optional side shelves. Its fixed gun caches are deliberately scarcer: five on Easy, three on Normal, and one on Hard. Guns sit in marked side alcoves away from the main ascent, with no fixed grenade launcher cache; enemy drops still use the difficulty's random loot rules.

| Stage | Route | New enemy |
| --- | --- | --- |
| 1. Verdant Outpost | Jungle canopy and ravines | Vine mantis with scythe forelegs |
| 2. Signal Bunker | Three overhead security chambers | Mobile security spider |
| 3. Spillway Ascent | Switchback spillway climb to the dam crest | Flying river ray |
| 4. Furnace Network | Three overhead reactor chambers | Reactor orb with a three-shot salvo |
| 5. Whiteout Relay | Ice shelves and relay towers | Charging ice wolf |
| 6. Cinder Foundry | Furnace decks and flame vents | Armored slag crab |
| 7. The Underflow | Flooded caves and broken shelves | Fast cave bat |
| 8. Heart of the Slop | Living alien fortress | Spore wasp |

Both bunker stages use a consistent overhead floor and low walls. Destroying cores does not pan or replace the background. Chamber changes use a brief fade, retaining the same floor coordinates. Outdoor stages retain seven stitched scrolling scenery panels.

## Audio

The supplied MP3s in `Soundtrack/` play and loop for their matching stages: Jungle, Bunker, Foundry (also used by Spillway), Reactor, Snow, Cave, and Alien.

The recordings in `Sound Effects/` cover machine gun, spread, laser, flame, grenade launcher, rocket launcher, wave cannon, Tesla, cryo, and plasma firing; grenade and rocket detonations; barrier and cloak activation; nuke detonation; and boss destruction. Other actions retain distinct synthesized cues. Leading silence is trimmed during decoding so weapon sounds start with the shot. Short effects are cached and concurrent voices are capped for rapid fire and co-op. Music streams one level at a time instead of downloading the entire soundtrack at startup.

Nukes begin with a near-white screen flash, then expand as a white-hot explosion and shock rings that race beyond the playfield while visible non-boss enemies are removed.

Audio starts after a player gesture. Pause and backgrounding stop music and effect tails; resume continues the track. Sound Off mutes both channels and remembers the preference. New runs and stage changes restart the appropriate track, while bunker room changes leave it playing. If an effect fails to load, a synthesized cue keeps that action audible.

## Implementation

- `js/engine.js`: deterministic 60 Hz simulation, difficulty, arsenal, upgrades, cloak/nuke effects, enemy behavior, and input replay.
- `js/levels.js`: campaign geometry and authored encounters; the engine populates difficulty-specific caches and themed enemies.
- `js/environment.js`: scrolling outdoor scenery and fixed overhead bunker rooms.
- `js/renderer.js`: enemies, projectiles, explosions, room fades, and scene composition.
- `js/weapon-art.js`: shared weapon, pickup, and guide illustrations.
- `js/mascot.js`: mascot poses, held/holstered weapons, cloak translucency, and co-op tint.
- `js/game.js`: HUD, keyboard/gamepad/touch input, fullscreen, audio, and local scores.
- `js/touch.js`: full-area thumbstick, direction dead zones, touch contacts, and remembered auto-fire preference.
- `js/audio.js`: recorded weapon/effect routing, streamed level music, mute/pause lifecycle, and synthesized fallback cues.
- `skin/gameslop/`: branding and bundled image assets. Keep `skin.json` and its browser copy `skin.js` synchronized.

`?seed=42` selects a replay seed. `?debug=1` exposes `window.__gameslop.{engine,renderer}`. The existing optional game-over bridge and local best-score storage remain supported.

## Validation

Run `node --test` inside `games/commando`. The suite covers weapons at all five tiers, holster behavior, progression across loss and continues, co-op isolation, cloak tracking and expiry, nuke screen bounds/boss immunity, mode-specific loot/enemies, safe routes, campaign victory, and scenery coverage.

The repository's `tools/cdp-drivers/commando-qa.js` tests desktop/mobile, touch, pause, fullscreen and fallback. `tools/cdp-drivers/commando-v4-qa.js` checks all eight themed enemies, stationary bunker floors during core destruction, tier-preserving keyboard swaps, mobile swaps and non-overlapping controls, and Hard's disabled holster. Chrome device emulation is automated; physical device testing remains manual.

`tools/cdp-drivers/commando-audio-qa.js` verifies actual MP3 decoding and playback, weapon/impact routing, all supplied level tracks, mute/pause/resume, mobile restart, and bounded effect voices.

`tools/cdp-drivers/commando-spillway-qa.js` checks reduced optional gun caches, keyboard and mobile down+jump, safe boss-platform retreat and return, and downward camera movement.

`tools/cdp-drivers/commando-touch-qa.js` exercises the thumbstick, auto-fire, simultaneous touch actions, dedicated Drop, input cancellation, rotation, fullscreen, and control sizing across phone viewports.
