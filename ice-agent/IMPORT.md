# ICE Agent import

Imported from https://github.com/shineyd1111/ice-agent-game at commit `91cb8d29a1db25010f1702a2c3c74c14c79b169c`.

Play at `../ice-agent/` from the arcade, or serve the repository's `games` directory and open `/ice-agent/`. This is a standalone static web app; it needs no build step or backend. The upstream README, testing checklist, setup guide, configuration, characters and gameplay are retained.

The supplied game currently draws simple Canvas characters and scenery. The repository includes a menu-background image but no level-background images or MP3 files. This deployment uses the game's existing solid-color backgrounds and silent behavior; no replacement artwork or soundtracks were invented. Leaderboards and achievements use local browser storage. The upstream crypto placeholders remain disabled.

Minimal compatibility fixes:

- Replaced four invalid optional-chain assignments in `mobile.js` that prevented the entire touch-controls script from parsing.
- Loaded `game.js` before `mobile.js`, so the mobile load handler can find the game instance.
- Fixed the boss constructor's lookup of a nonexistent `CONFIG.ENEMIES.boss` entry; it now reads the existing `CONFIG.BOSS` settings.
- Added `js/hosting.js` and `css/hosting.css` for an arcade link, pause, browser fullscreen, and scaling the authored 1280x720 playfield to the viewport. This keeps the original ground at y=550 visible on phones.
- Converted mouse/touch aiming coordinates to the scaled canvas, corrected multi-touch identifier selection, and handled cancelled touches.
- Adjusted only mobile control placement and menu scrolling so controls fit the screen and menus remain accessible. Host UI clears held input on pause/resize/backgrounding.
- Skipped requests for optional audio and level-background files absent from the imported revision. If those files are supplied later, remove the three fallback overrides at the start of `hosting.js` to use the upstream loaders.

Verification from the source workspace:

```text
node tools/cdp-shot.js http://127.0.0.1:8765/ice-agent/ 1440 1080 docs/game-screenshots/ice-agent-qa.png --script tools/cdp-drivers/ice-agent-qa.js --wait 100
```

The browser check exercises menu/difficulty selection, movement, jump, ammunition-consuming shooting, pause/resume, fullscreen, creation/rendering of all seven levels and their bosses, mobile initialization, two-thumb movement/shooting/release, and non-overlapping landscape controls. Every imported JavaScript file also passes `node --check`. This verifies a playable import, not completion of the source project's full gameplay checklist.
