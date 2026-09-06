# Slop Nukem 3D — Gameslop browser player

A static, free browser player for **user-supplied Duke Nukem 3D game data**.
The original map layouts are read unchanged from each player's local GRP.
An optional Ansem caricature replaces trooper enemies for retail editions.
The yellow T-shirt and temple fade follow the supplied appearance reference.
No original Duke maps, textures, music, sounds, scripts or GRP archives are shipped.
The shareware episode keeps its original enemies. Inspect the artwork without
game files at [the animated preview](mods/ansem/preview.html).

## Preview

From the repository root:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory games
```

Open http://127.0.0.1:8765/duke3d/ and select a compatible `DUKE3D.GRP`.
The local prototype's shareware file at `local/duke3d/data/shareware.grp` can
be selected for testing. That file stays outside this release directory.
The previous local prototype remains at http://127.0.0.1:8776/.

## Public distribution model

- Publish this folder, including its runtime, licenses, source archive and
  build instructions. Static HTTPS hosting is sufficient; no API server,
  accounts or file-upload endpoint is needed.
- Game bytes are loaded using the browser File API. Remembered data and saves
  use IndexedDB. Nothing sends a game file to a server.
- The game-file help links to a separate, complete shareware download and a
  retail store. The shareware episode is not repackaged or modified here.
- Keep distribution free of charge and noncommercial under the Build license.
  Preserve the credits, notices and accompanying engine source.
- Original map layouts remain copyrighted even if art changes. A future
  artwork mod must retain the user-supplied-data model or secure other rights.
  The shareware license does not allow the proposed art reskin of Episode One.

Deployment target: https://hyperkodi.github.io/gameslop-games/duke3d/.
The arcade hub links to this player. Players supply their own game files.

The Gameslop landing page accompanies custom native Slop Nukem 3D menus and
optional red mascot hands for retail game files. The shareware edition keeps
all original artwork and menus. The original save profile keys are retained.
Menu artwork is code-generated; hand artwork notes are in
`mods/mascot-hands/ARTWORK.md`. Character mods remain untested in a retail
campaign because no retail game file is available in this workspace.

## Engine provenance

This candidate replaces the local prototype's untraceable prebuilt runtime
with a build from a pinned, available source revision. See
[source/BUILD.md](source/BUILD.md), [credits.html](credits.html), and the full
source archive. The local prototype's runtime is not copied into this release.

## Browser behavior

- Desktop keyboard/mouse and pointer lock; browser fullscreen with fallback.
- Landscape touch stick, drag-to-look, jump/fire/use/crouch and weapon buttons.
- Original menus can be operated with the on-screen navigation buttons.
- A new iframe/engine instance is created per session so Exit/restart does not
  reuse a stopped runtime or leave game audio playing.
- In-game save slots and configs persist in IndexedDB. Storage failure keeps
  play available and surfaces instructions to export a backup.
- Save backups are portable JSON with strict edition/build and filename
  checks. Import preserves occupied local slots rather than overwriting them.
- Menu pause and held-input release when hidden; touch cancellation and screen
  rotation clear pressed keys.
- Source engine initialization errors show a recovery action.
- Recoverable browser pointer-lock refusals leave gameplay available.
- The Ansem mod compiles replacement ART locally using the player's palette and
  tile dimensions. It does not modify the GRP; it has separate save slots.
- No analytics, advertising, remote fonts or third-party runtime scripts.

## Tests

```powershell
node --test tools/duke-public.test.mjs
node tools/cdp-shot.js http://127.0.0.1:8765/duke3d/ 1280 900 .superpowers/duke-build/desktop-qa.png --script tools/cdp-drivers/duke-public-qa.js --wait 100
node tools/cdp-shot.js http://127.0.0.1:8765/duke3d/ 844 390 .superpowers/duke-build/mobile-qa.png --script tools/cdp-drivers/duke-public-mobile-qa.js --wait 100
node tools/cdp-shot.js http://127.0.0.1:8765/duke3d/mods/ansem/preview.html 1100 800 .superpowers/duke-build/ansem-side-qa.png --script tools/cdp-drivers/duke-ansem-qa.js --wait 100
```

Test assets are supplied from the private local shareware installation.
The six Node tests cover file validation, backup round trips and validation,
and accidental inclusion of loose game assets in the release tree.
The browser drivers exercise gameplay and real saves through the built engine.
Physical-device iOS/Android and retail-campaign coverage are separate from
Chrome emulation; do not claim they have been verified by these drivers.

Ansem integration has not been played through with a retail GRP: no retail copy
is available in this workspace. The preview and generated ART format can be
validated independently. See [artwork details and prompt](mods/ansem/ARTWORK.md).

The Ansem driver checks every pose's bounds and validates the compiled ART
header, dimensions, transparent index and pixel count using synthetic data.
