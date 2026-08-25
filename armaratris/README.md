# Armaratris

Armara-branded Tetris. Static — open `index.html`.

- `?skin=<name>` selects `skin/<name>/` (default `armara`); `?seed=<n>` fixes the piece sequence.
- Controls: ← → move · ↑ / X rotate · Z rotate CCW · ↓ soft drop · Space hard drop · C / Shift hold · P pause · M mute. Touch: drag to move, tap to rotate, flick down to drop, swipe up to hold.
- Tests: `node --test` (run from `Armaratris/`; `node --test tests/` fails on Node 24 — pass no path)
- Screenshots taken while verifying this game live in `docs/armaratris-screenshots/` (repo root), not shipped inside `Armaratris/`.
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
- Play-to-earn hook: on game over the page posts `{v:1, type:"gameover", game, skin, score, lines, level, seed, inputsHash}` to its parent frame. The engine is deterministic (seed + input log), so a server can replay a game to verify a score.
