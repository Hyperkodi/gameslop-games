# Armaratris

Armara-branded Tetris. Static — open `index.html`. Runs on the shared kit at `../_kit/` (`rng.js`,
`draw.js`, `skin.js`, `audio.js`, `input.js`, `shell.js`); `js/engine.js` is the pure Tetris engine,
`js/renderer.js` draws it (using the kit's `drawTile`/`setupCanvas` helpers), `js/game.js` is the
`GameSlopKit.createShell` config (sounds, key/gesture/button map, stats, the clear-flash hook).

- `?skin=<name>` selects `skin/<name>/` (default `armara`); `?seed=<n>` fixes the piece sequence.
- Controls: ← → move · ↑ / X rotate · Z rotate CCW · ↓ soft drop · Space hard drop · C / Shift hold · P pause · M mute. Touch: drag to move, tap to rotate, flick down to drop, swipe up to hold.
- Tests: `node --test` (run from `games/armaratris/`; `node --test tests/` fails on Node 24 — pass no path). `js/engine.js` and `tests/` are untouched by the kit migration.
- Screenshots taken while verifying this game live in `docs/armaratris-screenshots/` (repo root), not shipped inside `games/armaratris/`.
- Music: optional `music` (file in the skin folder, looped) and `musicVolume` (0–1) keys in `skin.json`; Armara ships `music.mp3` ("Pixel Paradise").
- Mute preference is shared across every kit game under `gameslop:muted`; best score is per game+skin under `gameslop:armaratris:<skin>:best`.
- New sponsor: copy `skin/armara/` to `skin/<name>/`, edit `skin.json`, replace `logo.png`, then regenerate `skin.js` from `skin/<name>/` with:
  ```bash
  node -e '
  const fs=require("fs");
  const j=fs.readFileSync("skin.json","utf8");
  fs.writeFileSync("skin.js",
  "// GENERATED from skin.json (source of truth). Regenerate with the command in README.md.\n"+
  "window.Armaratris = window.Armaratris || {};\n"+
  "window.Armaratris.skins = window.Armaratris.skins || {};\n"+
  "window.Armaratris.skins."+JSON.parse(j).name+" = "+j.trim()+";\n");
  '
  ```
- Play-to-earn hook: on game over the page posts `{v:1, type:"gameover", game, skin, score, seed, inputsHash, stats}` to its parent frame, where `stats` is `{score, level, lines}` (every stat configured in `js/game.js`). The engine is deterministic (seed + input log), so a server can replay a game to verify a score.
