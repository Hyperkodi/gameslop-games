# Testing Checklist for ICE AGENT Game

## Basic Functionality
- [ ] Game loads without errors (check browser console F12)
- [ ] Main menu displays correctly
- [ ] Can select difficulty and start game
- [ ] Player can move left/right with A/D or arrows
- [ ] Player can jump with W/Space
- [ ] Player can shoot with mouse

## Weapons
- [ ] Pistol works (limited ammo)
- [ ] Can switch weapons with 1-5 keys or mouse wheel
- [ ] Knife works as backup (infinite)
- [ ] Ammo counter updates correctly

## Enemies
- [ ] Machete Pirates spawn and attack
- [ ] Karen spawns, screams, and drops gun on death
- [ ] Glue Huffers rush and explode
- [ ] Suicide Bombers can be detonated early
- [ ] Gun Pirates shoot from distance (nerfed)
- [ ] RPG Pirates appear on level 3+ with slow rockets
- [ ] Boss spawns after kill requirement
- [ ] Boss has 3 phases (75%, 50%, 25% HP)

## Power-Ups
- [ ] Mushroom makes you fly with psychedelic effect
- [ ] Cocaine increases speed/fire rate with disco effect
- [ ] Cocaine comedown happens after duration
- [ ] Steroids increase size/damage
- [ ] Alcohol slows you but reduces damage
- [ ] Fentanyl makes you invulnerable with red vignette
- [ ] Health pickups heal player
- [ ] Extra life is rare (3% chance)

## Desks
- [ ] Desks can be opened with E or touch
- [ ] Desks drop random loot
- [ ] Loot stays on desk for 2 seconds before falling

## Level System
- [ ] 7 levels total
- [ ] Each level spawns correct enemy counts
- [ ] Kill counter updates
- [ ] Boss spawns after kill requirement met
- [ ] Level completes after boss defeated
- [ ] Camera follows player smoothly

## Lives & Difficulty
- [ ] 1 life on level 1
- [ ] 3 lives after beating level 1
- [ ] Easy mode: more HP, weaker enemies
- [ ] Normal mode: standard gameplay
- [ ] Hard mode: tougher enemies, more spawns, 2x score

## UI & Menus
- [ ] Pause with ESC key
- [ ] Resume from pause
- [ ] Game over screen shows stats
- [ ] Leaderboard saves and displays scores
- [ ] Achievements track progress
- [ ] Volume controls work

## Effects
- [ ] Particle effects on blood, explosions
- [ ] Screen shake on damage/explosions
- [ ] Popups show messages
- [ ] Drug effects overlay correctly

## Mobile (Test on phone/tablet)
- [ ] Virtual joystick controls movement
- [ ] Touch right side to aim and shoot
- [ ] Weapon switching buttons work
- [ ] Jump and interact buttons work
- [ ] Landscape warning shows in portrait mode

## Performance
- [ ] Game runs at smooth 60 FPS
- [ ] No lag with many enemies/particles
- [ ] No memory leaks over time

## Browser Compatibility
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works on mobile browsers

## Common Issues to Check
- [ ] No console errors on load
- [ ] Sounds load without errors (or gracefully fail if missing)
- [ ] Images load without errors (or use fallback colors)
- [ ] LocalStorage works for saves
- [ ] Game doesn't crash on player death
- [ ] Game doesn't crash on boss death
