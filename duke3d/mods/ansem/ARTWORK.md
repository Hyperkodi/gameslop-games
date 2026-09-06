# Ansem enemy artwork

Created with the built-in `image_gen.imagegen` tool, September 6, 2026.
Current asset: `ansem-atlas-v2.png`, 1024 × 1536, 40 poses in five columns and eight rows.
The original generated PNG is preserved. The browser loader keys its baked light checkerboard at render time.

The yellow shirt and temple fade use the user's supplied portrait as the reference.
Earlier likeness reference: https://xxx-strapi.s3.us-east-1.amazonaws.com/ansem.png
The reference photographs are not included in the public player.

This is a fictional arcade caricature, with no affiliation or endorsement implied.
The optional mod replaces the trooper animation tiles (1680–1759). It uses the
player's own retail GRP palette, original tile dimensions and offsets at runtime.
No original game pixels or palette are distributed. The GRP and map layouts are
never modified. The shareware edition does not enable the mod.

## Final image edit prompt

Edit the previously generated Ansem game sprite atlas using the user's newest photo as the appearance reference. Keep the same five-column, eight-row atlas layout, exact poses, full-body framing, playful pixel-art caricature face, blasters, jetpacks, blue jeans and sneakers. Make TWO precise changes to every sprite: (1) Replace the olive overshirt and gray undershirt with a single plain warm yellow short-sleeve T-shirt, matching the yellow shirt in the supplied photo. (2) Match the photo's hairstyle: a tall textured afro top with a clearly visible clean temple fade immediately in front of the ear and tapered very short sides around the ear; show the skin-to-short-hair fade clearly in the front three-quarter and side profiles. Do not make the hairstyle a round uninterrupted afro around the ear. Preserve the subject's recognizable identity and consistent hair shape across all five viewing directions. No extra design changes, text, logos or grid lines. Preserve all 40 sprite positions, consistent scale and the non-graphic defeat poses. Background should be truly transparent with alpha if supported, never paint a checkerboard into the actual pixels. This is a fictional arcade parody character.

## Preview and integration

- `preview.html` displays the walking, firing, flying, crouching and defeat poses.
- `sprites.js` samples the atlas and compiles the replacement ART in browser memory.
- `../../engine.js` mounts the ART and a DEF file before starting a retail game.
- The mod has a separate save profile from the unmodified game.
- This replaces troopers only; other enemy types retain their original appearance.
