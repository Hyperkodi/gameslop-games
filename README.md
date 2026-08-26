# Armara Arcade

Six browser games — Armaratris, Serpent, Breaker, Aegis, Flight, Starfall — sharing one kit
(`_kit/`: `rng.js`, `draw.js`, `skin.js`, `audio.js`, `input.js`, `shell.js`, `kit.css`). Static,
no build step, no server-side code. `index.html` is the arcade hub.

## Run locally

Double-click any `index.html` (games work fully offline over `file://`), or serve the folder so
`fetch()`-based skin loading works everywhere:

```bash
npx serve games
```

Then open `http://localhost:3000/` for the hub, or `http://localhost:3000/<game>/` for a game
directly. Query params: `?skin=<name>` picks a skin folder (default `armara`); `?seed=<n>` fixes
the RNG seed for deterministic runs; `?debug=1` exposes `window.__gameslop.{engine,renderer}` for
console/CDP inspection.

## Test

Every game and the kit itself has its own `node --test` suite:

```bash
cd games/_kit && node --test
cd games/armaratris && node --test
cd games/serpent && node --test
cd games/breaker && node --test
cd games/aegis && node --test
cd games/flight && node --test
cd games/starfall && node --test
```

Run from inside each folder (not `node --test games/<id>/tests/` — passing a path fails on
Node 24; passing none discovers `tests/` from the cwd).

Current expected total: 98 tests — kit 12, Armaratris 35, Serpent 11, Breaker 9, Aegis 15,
Flight 7, and Starfall 9.

## Add a game

Every game lives at `games/<id>/` with exactly:

1. **`skin/armara/skin.json`** — copy an existing game's `skin.json`, change `title`, add
   `"wordmark": "ARMARA"`, replace `strings` labels with the new game's stat labels (keep
   `best,start,paused,resume,gameOver,restart`), replace `tiles` with the game's `sprites`
   (tones drawn from the shared palette: gold, bronze, marble, obsidian, deep gold — each a
   `{base,hi,lo,edge?}` triple). Games may also declare optional `background` and `art` assets;
   keep their filenames in the skin manifest so another sponsor can replace them without touching
   game logic. Generate `skin.js` from `skin.json` with the one-liner in `armaratris/README.md`;
   copy `logo.png` (identical across every game — same sponsor mark).
2. **`js/engine.js`** — pure, `require`-able, attaches `window.Game.createEngine` and exports
   `module.exports = { createEngine, ...constants }`. Uses `GameSlopKit.mulberry32/fnv1a` in the
   browser, `require("../../_kit/rng.js")` in Node.
3. **`tests/engine.test.js`** — write first, watch it fail, implement, watch it pass.
4. **`js/renderer.js`** — `Game.createRenderer({skin, wellCanvas, wrapEl})` →
   `{ resize(), draw(state, extras), cell }`, using `GameSlopKit.drawTile/drawBevelRect/
   setupCanvas/hexToRgba/drawLogo`; presentation art must have a procedural fallback.
5. **`js/game.js`** — `Game.config` for `GameSlopKit.createShell` (game id, sounds, events, stats,
   input map, a game-appropriate `startsOnAnyAction` value, and optional `endOverlay`) plus the
   `DOMContentLoaded` call. Coordinate-driven games can map a normalized `gestures.tapAt(point)` to a stable semantic
   action string; only that string should reach the deterministic engine.
6. **`index.html`** — title/tagline/logo header, stats panel, framed well, brand + mute button,
   `#touch` nav. Script order: `_kit/rng.js`, `_kit/draw.js`, `_kit/skin.js`, `_kit/audio.js`,
   `_kit/input.js`, `_kit/shell.js`, then `js/engine.js`, `js/renderer.js`, `js/game.js`.
7. **Verify**: `cd games/<id> && node --test` (pristine pass); `node --check` every `.js`;
   screenshots via `node tools/cdp-shot.js <url> 1280 800 docs/game-screenshots/<id>-desktop.png`
   and `... 390 844 ... <id>-mobile.png`.
8. Add the game's card to `index.html` (mark, title, one-line description, `PLAY` link to
   `<id>/`) and its folder to this README's test list.

Use `aegis/` as the worked example for normalized pad selection, a five-command control bar,
skin-owned artwork, and distinct victory/defeat overlay copy.

## Skin format

Each game folder has `skin/<name>/skin.json` (+ generated `skin.js` twin for `file://` use):
`name`, `title`, `tagline`, `logo` (image filename), optional `music` (looped audio filename),
`musicVolume` (0–1), optional `background` (`image`, `position`, `overlay`) and `art` filename map,
`fonts` (`display`/`body` family names + `googleFonts` query string),
`palette` (`bg,bg2,marble,gold,goldDeep,bronze,ink,muted,well,grid,frame,ghost`), a game-specific
`tiles`/`sprites` map, `watermarkAlpha`, and `strings` (UI copy, including per-game overlay text).
`_kit/skin.js` turns this into CSS custom properties (`--c-*`, `--font-*`), loads Google Fonts,
and rewrites every `[data-str]` element, `#tagline`, `#wordmark`, `#titleLogo`/`#brandLogo`, the
favicon, and `theme-color`.

New sponsor skin: copy `skin/armara/` to `skin/<name>/`, edit `skin.json`, replace `logo.png` (and
`music.mp3` if the sponsor has a track), then regenerate `skin.js`:

```bash
node -e '
const fs=require("fs");
const j=fs.readFileSync("skin.json","utf8");
fs.writeFileSync("skin.js",
"// GENERATED from skin.json (source of truth). Regenerate with the command in README.md.\n"+
"window.GameSlopKit = window.GameSlopKit || {};\n"+
"window.GameSlopKit.skins = window.GameSlopKit.skins || {};\n"+
"window.GameSlopKit.skins."+JSON.parse(j).name+" = "+j.trim()+";\n");
'
```

Mute preference is shared across every game under `gameslop:muted`; best score is per
game+skin under `gameslop:<id>:<skin>:best`.

## Publish

`games/` is mirrored to a public repo (`Hyperkodi/gameslop-games`) served by GitHub Pages, via a
`git subtree split`:

```bash
bash tools/publish-games.sh
```

This splits `games/` out of the monorepo history onto a `games-mirror` branch and force-pushes it
to `https://github.com/Hyperkodi/gameslop-games.git:main`. Pass a different remote URL as `$1` to
publish elsewhere. Run it from the monorepo after committing hub/game changes; GitHub Pages (once
enabled, `main` branch, `/` root) picks up the new commit automatically. `games/.nojekyll` rides
along in the subtree split — without it, GitHub Pages runs the Jekyll build, which drops any
directory starting with `_` (including `_kit/`) and the whole site breaks.

**Verify the publish landed** once Pages has rebuilt (can take a minute or two):

```bash
curl -sI https://hyperkodi.github.io/gameslop-games/_kit/shell.js   # expect: HTTP/2 200
node tools/cdp-shot.js "https://hyperkodi.github.io/gameslop-games/aegis/?debug=1" \
  1280 800 /tmp/aegis-live.png --script driver.js
# driver.js: module.exports = async (cdp, evaluate) => evaluate("document.body.dataset.ready");
# expect the resolved value "1"
```

## URLs

- Hub: https://hyperkodi.github.io/gameslop-games/
- Armaratris: https://hyperkodi.github.io/gameslop-games/armaratris/
- Serpent: https://hyperkodi.github.io/gameslop-games/serpent/
- Breaker: https://hyperkodi.github.io/gameslop-games/breaker/
- Aegis: https://hyperkodi.github.io/gameslop-games/aegis/
- Flight: https://hyperkodi.github.io/gameslop-games/flight/
- Starfall: https://hyperkodi.github.io/gameslop-games/starfall/

The old standalone mirror, `https://hyperkodi.github.io/armaratris/`, now redirects to the
Armaratris URL above.
