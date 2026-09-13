# Background continuity preview — September 13, 2026

The repaired version, numbered soundtrack, victory music and safe-respawn fixes are now the main release at https://hyperkodi.github.io/gameslop-games/commando/ . The earlier preview address `/commando-panorama/` remains available. The original build is preserved by the Git tag and workspace archive listed below. Use `background-review.html` beside this file to compare all six scrolling stages at matching camera positions.

## Artwork

All 36 original joins were reviewed and repaired with the built-in image-generation tool, using the original game artwork as the reference. Jungle, snow, foundry, cave and alien stages use localized repair bands, preserving the original pixels outside those regions (more than 56% of each horizontal panorama). The foundry received an additional localized correction to connect its molten-metal channel to the factory.

Spillway's first localized pass was rejected because mismatched viewpoints produced ghosted terraces. Its accepted second pass is a continuous vertical repaint based on the original, preserving the jungle dam setting, teal turbines, circular crest gate, grating and waterfalls. It changes more of the artwork than the other stages. Both overhead bunker floors already use continuous drawn scenery and remain unchanged.

## Rendering and validation

- 39 lossless PNG tiles, with 108 shared pixels horizontally and 96 vertically, sliced from complete panoramas. Each tile is smaller than 2048 pixels in either dimension.
- Original world positions and camera movement are preserved. No independent recropping or runtime crossfade is applied to repaired tiles. Current and next stages are cached.
- If a tile fails to load, the renderer uses the complete original atlas. `?scenery=original` explicitly selects the original artwork.
- All 33 adjacent tile overlaps are pixel-identical; reconstructing each panorama from its tiles reproduces the master exactly.
- 181 automated tests pass, including all gameplay tests, six panorama tests, and the mobile joystick policy.
- Native Canvas rendered 61 camera positions in each of eight stages (488 total), plus original/repaired captures at all 36 joins. Comparison controls were exercised for all six levels.
- A connected browser was unavailable during this pass. These checks are not a substitute for an on-device browser playthrough; frame rate and mobile download behavior remain device-dependent.

The additional panorama files total 34,921,900 bytes; the release manifest records individual file sizes and hashes. Only relevant stages load while playing, not all six at startup.

## Rollback and source artwork

The original release is Git tag `pepontra-before-background-repair-20260913`, commit `183800d4a275d19075296ebcf702eeacee0a1710`, in `Hyperkodi/gameslop-games`. The main `commando/` directory now serves the updated build; restore from this tag if a rollback is needed.

Workspace archive: `artifacts/slop-commando/background-repair/pepontra-original-183800d.zip` (SHA-256 `aa7e304af68d61a083b434c9ba852ed7511c89fba90cb63c9db22655e6721c67`).

Reproducible artwork pipeline and full prompts live in `artifacts/slop-commando/background-repair/`: `prepare.cjs`, `assemble.cjs`, `pack.cjs`, `prompts.json`, `spillway-prompt.json`, `foundry-prompt.json`. Original atlases remain in `skin/gameslop/`; the new game assets are in `skin/gameslop/panoramas-v1/`. The generated repair source images and assembled masters are retained in the workspace for further revisions.
