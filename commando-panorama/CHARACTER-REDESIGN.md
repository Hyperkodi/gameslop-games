# Pepons and the meme army

The user approved the cast on 12 September 2026. All approved sprites and their expanded animations are integrated into the game and published at https://hyperkodi.github.io/gameslop-games/commando/.

Open `index.html` to play, or `cast-preview.html` to inspect all 21 designs in motion. The preview offers light/dark backgrounds, player poses, and a full enemy sequence or individual movement, wind-up, attack, hit and defeat states.

## Implemented

- Pepons: bare silver-crystal frog head, plus colored-crystal woodland camo clothing (fatigue jacket, belt/pouches, cargo trousers and boots) across eight running frames, two idle poses, takeoff, airborne, landing, crouch, hit reaction and victory. Weapons remain separate, with silver hands and a subtle co-op tint.
- Eleven combat types: Wojak, Thinking Cat, Microduck, FRONG, Bundle Cat, SLIPPY, ASTRO, YOLO, Swole Cat, Robin the Frog and SHROOM.
- Destructible objective: CATGPT security console, with an alert state. Mission instructions now describe consoles.
- Eight bosses: Chump, GreenHood, ZZZ, Boner, Memory Cow Moo, Pipedog, Cash Cat and Artificial Inu. Each has neutral, anticipation, recoil, damaged and powered-down defeat artwork; HUD and status text use the approved names.
- Added 48 enemy action poses and eight boss defeat poses. Every enemy/objective now has eight source poses, and every boss has five. New attack poses omit baked projectiles so only the engine's actual projectiles appear.
- Walk cycles advance with distance traveled, including slowdown effects. FRONG hops, YOLO leans into a running charge, Robin banks and dives, the hover characters bob at individual cadences, and the bosses have distinct chassis motion and recoil weights. Stationary turrets and consoles do not walk.
- Emitted shots stamp an `attackTick` for recoil. Cooldowns are used only for wind-up. YOLO and Robin remain contact attackers and never fake shooting because their cooldown reset. Hit poses briefly interrupt the animation; defeated actors collapse and fade. Retained dead bosses disappear once, without retriggering. Pausing freezes the presentation clock, and resuming never catches up through a long animation gap.
- Hitboxes, projectile timing, movement rules and difficulty values are preserved. Regular foes face the closest visible player, and aimed bosses face the first visible partner, matching their engine targeting. Cloaked players do not attract their aim. CATGPT's existing defensive shots trigger its typing pose.
- Generated magenta backgrounds are keyed once on image load. Boundary despill preserves interior pink skin and purple armor. Fixed per-character scale and foot anchors prevent poses from inflating or floating.
- All eight existing background artworks are preserved. Existing joystick controls are preserved.

## Validation

`node --test games/commando/tests/*.test.js tools/mobile-joystick-policy.test.mjs`

Result: **113 passing tests**, zero failures. Covers gameplay regression checks, source rectangles and anchors, cast coverage, keying/despill, actual engine shot cues, movement and pause timing, contact attackers, retained-boss defeat lifecycle, and the new frag/incendiary/electrical grenade mechanics.

`node artifacts/slop-commando/pepons-prototype/render-qa.cjs`

Result: all eight sprite sheets loaded; actual Canvas renderer exercised across eight stages, all 21 actor designs, and 120 hostile/objective action previews in both facings. Rendered boss death was checked until fully invisible without retriggering. PNGs and render-checks.json are in the same artifact directory. The harness uses @napi-rs/canvas installed under artifacts/slop-commando/render-tools.

Interactive browser verification was unavailable because no browser connection was exposed. Offscreen Canvas rendering is not an interactive browser or phone playthrough. These are sprite pose sequences with procedural motion, not skeletal animations.

## Sources and maintenance

Original reference sources and the approved role mapping are in `artifacts/slop-commando/mascot-review/`. New sprites were generated from those references using the image-generation tool. Original generated sheets are preserved in the skin directory; the game processes their matte at load time.

The camo revision uses the colored-glass clothing treatment in [Pepons' gallery](https://pepons.family/), particularly `/img/memes/m6.webp` and `/img/memes/m8.webp`. Those outfit references are saved under `artifacts/slop-commando/pepons-prototype/outfit-references/`. The current player atlas is `pepons-barehead-camo-v4.png`; earlier atlases remain as source backups. The helmet was removed from every pose at the user's request.

`artifacts/slop-commando/pepons-prototype/prepare-cast.py` reads the source sheets and regenerates skin metadata and the embedded atlas bundle for file:// previews. Empty row and column gutters keep fragments of neighboring poses out of the crops. Nominal horizontal pivots remain stable even when a crop gutter moves; source PNG bytes are unchanged. Keep both skin.json and skin.js synchronized.

The new sources are `enemies-actions-a-v2.png`, `enemies-actions-b-v2.png` and `bosses-defeat-v2.png` in `skin/gameslop/`. Built-in image generation prompts and reference roles are recorded in `artifacts/slop-commando/pepons-prototype/animation-prompts.md`. Visual checks are in `enemies-action-review.png` and `bosses-action-review.png` alongside that file.
