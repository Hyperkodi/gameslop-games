# Verification — September 6, 2026

Passed:

- Six Node tests: GRP validation, CRC, save backup round trips and validation,
  and exclusion of original game files from the public directory.
- Desktop Chrome: source-built engine boot, first level, native keyboard movement,
  firing, jumping, fullscreen, saving, fresh engine restart and loading a save.
- Landscape Chrome touch emulation: original menu navigation, grounded jump,
  simultaneous movement and firing, touch release/cancellation, viewport bounds,
  and no touch-handler exceptions.
- Ansem: all 40 sprite bounds, transparent rendering, synthetic-palette ART
  compilation, tile range, pixel count and transparency index. Side-view preview
  visually checked for yellow shirt and temple fade.
- Runtime hashes match `runtime/build.json`. The accompanying source archive
  includes the current input/state bridge and contains no original game files.

Limitations:

- No retail GRP is available here. The retail-only Ansem mod is wired into startup
  but has not been verified in a running retail campaign.
- Shareware testing uses the original enemies, with no art modification.
- Physical iOS/Android devices, Safari and Firefox have not been tested.
- The deployment uses user-supplied game files and includes source/license downloads.

Release verification on September 6: desktop gameplay, actual save/load across
engine restart, fullscreen, and landscape touch controls passed after the
Slop Nukem 3D branding and optional hand/menu integration. Shareware retains its
original artwork; the new ART compilers are checked separately. Retail gameplay
coverage remains unavailable.

Run commands are in `README.md`; artwork provenance and prompt are in
`mods/ansem/ARTWORK.md`.
