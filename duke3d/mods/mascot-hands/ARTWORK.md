# Gameslop mascot hands

The selected `hands-a-v2.png` and `hands-b-v2.png` sheets were generated and
edited with the built-in ImageGen tool for this Gameslop project. They adapt
first-person weapon poses to matte red cartoon hands with three fingers and
a thumb, dark outlines, flat shading, and no glove cuffs or rubber shine.

The loader removes the magenta backdrop and compiles thirty hand-bearing
frames using the player's own game palette, tile dimensions, and animation
offsets. The muzzle-flash-only frame is preserved from the player's game data.
The sheets were developed from local first-person pose references and the
user-supplied Gameslop mascot reference. They are optional retail-game artwork;
the public player does not apply them to shareware. No GRP file is included.

The final ImageGen direction was to retain the weapon poses and atlas layout
while replacing glossy glove-like hands with rounded four-digit red cartoon
hands. The two sheets use a four-by-four cell layout and a magenta colour key.

`../branding/menu.js` draws original Gameslop menu type, geometric backgrounds,
and D-pad selectors in canvas before compiling native ART overlays. The browser
landing page reuses the project's Gameslop icon and user-provided mascot sheet.
