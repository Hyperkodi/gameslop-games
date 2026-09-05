/* Original GameSlop campaign. Coordinates and encounters are authored here. */
(function (root) {
  'use strict';
  const levels = [
    { name: 'Verdant Outpost', tag: 'JUNGLE INFILTRATION', mode: 'run', theme: 'jungle', width: 6600, boss: 'Bastion', briefing: 'Follow the river through the canopy, ravines, and perimeter cannon.', gaps: [[1290, 1405], [2430, 2550], [3615, 3740], [4890, 5005], [5310, 5430]] },
    { name: 'Signal Bunker', tag: 'SECURITY BREACH', mode: 'base', theme: 'base', width: 960, boss: 'Watchtower', briefing: 'Destroy the red security cores in all three chambers. Keep moving.' },
    { name: 'Spillway Ascent', tag: 'FORWARD ASCENT', mode: 'climb', theme: 'water', width: 960, height: 2860, boss: 'Undertow', briefing: 'Climb from the flood basin to the dam crest. The guardian waits above.' },
    { name: 'Furnace Network', tag: 'REACTOR BREACH', mode: 'base', theme: 'foundry', width: 960, boss: 'Overseer', briefing: 'Breach three reactor chambers. Jump to evade incoming fire.' },
    { name: 'Whiteout Relay', tag: 'FROZEN FRONT', mode: 'run', theme: 'snow', width: 6600, boss: 'Frostbite', briefing: 'Cross ice shelves, relay towers, and a whiteout pass to reach the siege walker.', gaps: [[1220, 1330], [2550, 2675], [3895, 4025], [4800, 4920], [5560, 5685]] },
    { name: 'Cinder Foundry', tag: 'INDUSTRIAL SABOTAGE', mode: 'run', theme: 'foundry', width: 6600, boss: 'Crucible', briefing: 'Sabotage conveyor spans, furnace decks, and timed flame vents.', gaps: [[1450, 1575], [2875, 2990], [4190, 4325], [5200, 5320], [5600, 5725]] },
    { name: 'The Underflow', tag: 'INTO THE DEEP', mode: 'run', theme: 'cave', width: 6600, boss: 'Maw', briefing: 'Push through flooded caverns, broken shelves, and drone nests beneath the city.', gaps: [[1320, 1440], [2710, 2830], [4110, 4245], [4990, 5110], [5580, 5705]] },
    { name: 'Heart of the Slop', tag: 'FINAL TRANSMISSION', mode: 'run', theme: 'alien', width: 6600, boss: 'The Source', briefing: 'Cross the living core, rupture its defense veins, and shut the source down.', gaps: [[1510, 1635], [2870, 2990], [4200, 4330], [5250, 5370], [5625, 5750]] },
  ];

  // Each route is a sequence of landmarks rather than a repeating tile cadence.
  // Low ledges create staging spots, high ledges make room for drones, and longer
  // bridges give each biome a distinct traversal rhythm.
  const runRoutes = {
    jungle: {
      platforms: [
        [350, 368, 200], [615, 298, 165], [915, 354, 240], [1515, 365, 275],
        [1840, 306, 190], [2110, 236, 170], [2665, 366, 255], [2980, 310, 190],
        [3215, 246, 175], [3790, 360, 245], [4080, 292, 205], [4410, 344, 260],
        [5135, 366, 260], [5450, 294, 190], [5700, 235, 175], [6220, 358, 265],
        [6570, 292, 190]
      ],
      encounters: [
        [650, 420, 'soldier'], [910, 238, 'drone'], [1110, 420, 'turret'], [1600, 330, 'soldier'],
        [1825, 228, 'drone'], [2070, 420, 'turret'], [2250, 420, 'soldier'], [2680, 328, 'soldier'],
        [3020, 220, 'drone'], [3380, 420, 'turret'], [3825, 326, 'soldier'], [4140, 202, 'drone'],
        [4490, 420, 'soldier'], [4740, 420, 'turret'], [5170, 332, 'soldier'], [5480, 205, 'drone'],
        [5770, 420, 'turret'], [6240, 324, 'soldier'], [6610, 215, 'drone']
      ],
      supplies: [[660, 250, 'S'], [2115, 188, 'M'], [4085, 248, 'G'], [5705, 190, 'L']]
    },
    snow: {
      platforms: [
        [360, 370, 270], [690, 332, 175], [935, 264, 180], [1450, 366, 305],
        [1800, 320, 210], [2105, 274, 175], [2755, 366, 285], [3105, 312, 190],
        [3370, 242, 190], [4140, 370, 320], [4525, 323, 205], [4805, 267, 180],
        [5445, 366, 295], [5800, 310, 200], [6090, 253, 180], [6610, 365, 320],
        [7000, 318, 205]
      ],
      encounters: [
        [620, 420, 'soldier'], [880, 235, 'drone'], [1130, 420, 'turret'], [1530, 420, 'soldier'],
        [1815, 275, 'turret'], [2050, 205, 'drone'], [2320, 420, 'soldier'], [2780, 330, 'soldier'],
        [3140, 220, 'drone'], [3560, 420, 'turret'], [4160, 332, 'soldier'], [4580, 278, 'turret'],
        [4910, 205, 'drone'], [5150, 420, 'soldier'], [5475, 330, 'soldier'], [5840, 215, 'drone'],
        [6210, 420, 'turret'], [6650, 330, 'soldier'], [7050, 230, 'drone']
      ],
      supplies: [[700, 287, 'W'], [2108, 229, 'B'], [4528, 278, 'R'], [6094, 211, 'S']]
    },
    foundry: {
      platforms: [
        [355, 372, 300], [735, 326, 185], [980, 258, 190], [1660, 370, 315],
        [2040, 304, 200], [2320, 242, 175], [3110, 371, 330], [3520, 316, 205],
        [3810, 252, 185], [4450, 366, 305], [4810, 298, 210], [5095, 230, 185],
        [5820, 368, 330], [6235, 311, 210], [6505, 247, 180], [7050, 365, 310],
        [7425, 302, 200]
      ],
      encounters: [
        [650, 420, 'soldier'], [945, 215, 'drone'], [1180, 420, 'turret'], [1690, 336, 'soldier'],
        [2055, 420, 'turret'], [2290, 190, 'drone'], [2600, 420, 'soldier'], [3140, 336, 'soldier'],
        [3550, 270, 'turret'], [3870, 195, 'drone'], [4070, 420, 'soldier'], [4485, 332, 'soldier'],
        [4865, 250, 'drone'], [5160, 420, 'turret'], [5430, 420, 'soldier'], [5850, 334, 'soldier'],
        [6260, 265, 'turret'], [6550, 192, 'drone'], [6730, 420, 'soldier'], [7080, 330, 'soldier'],
        [7450, 210, 'drone']
      ],
      supplies: [[738, 278, 'L'], [2324, 200, 'F'], [4814, 254, 'W'], [6509, 205, 'B']],
      hazards: [
        [1040, 407, 28, 47, 40], [1920, 407, 28, 47, 170], [2440, 407, 38, 47, 95],
        [3630, 407, 28, 47, 210], [4700, 407, 42, 47, 25], [6150, 407, 28, 47, 145],
        [6625, 407, 38, 47, 80], [7270, 407, 28, 47, 225]
      ]
    },
    cave: {
      platforms: [
        [320, 362, 250], [625, 300, 175], [875, 238, 180], [1570, 370, 290],
        [1935, 328, 190], [2210, 266, 175], [2975, 365, 300], [3330, 306, 185],
        [3590, 220, 190], [4380, 368, 330], [4780, 320, 190], [5040, 252, 175],
        [5750, 364, 320], [6140, 300, 205], [6430, 232, 185], [7050, 370, 330],
        [7460, 315, 195]
      ],
      encounters: [
        [600, 420, 'soldier'], [840, 205, 'drone'], [1110, 420, 'turret'], [1585, 336, 'soldier'],
        [1900, 420, 'soldier'], [2160, 205, 'drone'], [2460, 420, 'turret'], [3010, 330, 'soldier'],
        [3370, 225, 'drone'], [3710, 420, 'turret'], [4410, 332, 'soldier'], [4810, 260, 'turret'],
        [5110, 190, 'drone'], [5370, 420, 'soldier'], [5780, 330, 'soldier'], [6170, 250, 'drone'],
        [6460, 195, 'drone'], [6690, 420, 'turret'], [7080, 334, 'soldier'], [7500, 225, 'drone']
      ],
      supplies: [[628, 255, 'G'], [2214, 221, 'L'], [4784, 275, 'H'], [6434, 188, 'F']]
    },
    alien: {
      platforms: [
        [365, 366, 290], [730, 304, 185], [995, 232, 190], [1760, 367, 320],
        [2160, 310, 205], [2450, 246, 185], [3260, 365, 325], [3670, 292, 205],
        [3945, 218, 190], [4660, 370, 340], [5070, 314, 205], [5360, 244, 190],
        [6080, 366, 330], [6500, 300, 210], [6790, 224, 195], [7420, 368, 345],
        [7835, 304, 210]
      ],
      encounters: [
        [650, 420, 'soldier'], [940, 195, 'drone'], [1210, 420, 'turret'], [1780, 332, 'soldier'],
        [2180, 270, 'turret'], [2410, 185, 'drone'], [2750, 420, 'soldier'], [3300, 330, 'soldier'],
        [3710, 245, 'drone'], [4020, 180, 'drone'], [4250, 420, 'turret'], [4695, 334, 'soldier'],
        [5110, 275, 'turret'], [5390, 188, 'drone'], [5630, 420, 'soldier'], [6110, 332, 'soldier'],
        [6540, 255, 'drone'], [6820, 180, 'drone'], [7010, 420, 'turret'], [7450, 332, 'soldier'],
        [7860, 218, 'drone']
      ],
      supplies: [[734, 259, 'W'], [2454, 204, 'B'], [5074, 272, 'R'], [6794, 182, 'S']],
      hazards: [
        [1080, 407, 32, 47, 20], [1920, 407, 38, 47, 155], [2760, 407, 28, 47, 90],
        [3520, 407, 42, 47, 220], [4950, 407, 28, 47, 45], [5700, 407, 40, 47, 180],
        [6630, 407, 28, 47, 115], [7550, 407, 42, 47, 235]
      ]
    }
  };

  // The spillway is a long switchback of broad landings. Every step rises 83
  // pixels or less, below the 113 pixel jump envelope, so it is readable and fair.
  const climbLandings = [
    [78, 320], [250, 275], [470, 270], [640, 270], [440, 285], [220, 275],
    [70, 290], [255, 275], [485, 270], [650, 270], [455, 285], [235, 275],
    [78, 295], [270, 275], [510, 270], [660, 265], [450, 290], [225, 280],
    [62, 300], [250, 280], [490, 275], [645, 275], [430, 295], [205, 285],
    [55, 305], [245, 280], [500, 275], [665, 260], [445, 295], [210, 300],
    [80, 340]
  ];
  const climbEncounters = { 3: 'turret', 7: 'drone', 11: 'soldier', 15: 'turret', 19: 'drone', 23: 'soldier', 27: 'turret' };

  function buildLevel(index) {
    const spec = levels[index];
    const l = { ...spec, index, height: spec.height || 540, platforms: [], spawns: [], supplies: [], hazards: [] };
    if (l.mode === 'base') return l;
    if (l.mode === 'climb') {
      l.platforms.push({ x: 0, y: l.height - 50, w: 960, h: 50, ground: true });
      climbLandings.forEach(([x, w], i) => {
        const y = l.height - 140 - i * 83;
        l.platforms.push({ x, y, w, h: 18 });
        const kind = climbEncounters[i];
        if (kind) {
          l.spawns.push({ x: x + Math.min(w - 48, kind === 'drone' ? 115 : w - 66), y: y - (kind === 'drone' ? 78 : 34), kind });
        }
        const special = { 7: 'G', 16: 'H', 25: 'W' }[i];
        if (special) l.supplies.push({ x: x + Math.min(78, w - 58), y: y - 45, type: special });
      });
      // A broad crest gives the final encounter a real destination after the switchbacks.
      l.platforms.push({ x: 0, y: l.height - 2710, w: 960, h: 20 });
      return l;
    }

    const route = runRoutes[l.theme];
    let last = 0;
    for (const [a, b] of [...(l.gaps || []), [l.width, l.width]]) {
      l.platforms.push({ x: last, y: 454, w: a - last, h: 86, ground: true });
      last = b;
    }
    // Keep the final screen open for its boss; all authored landmarks stay inside
    // the seven stitched scenery sections and before the encounter arena.
    const routeEnd = l.width - 760;
    route.platforms.filter(([x]) => x < routeEnd).forEach(([x, y, w, h = 20]) => l.platforms.push({ x, y, w, h }));
    const overGap = x => (l.gaps || []).some(([a, b]) => x > a - 18 && x < b + 18);
    route.encounters.filter(([x]) => x < routeEnd).forEach(([x, y, kind]) => {
      if (!overGap(x)) l.spawns.push({ x, y, kind });
    });
    route.supplies.filter(([x]) => x < routeEnd).forEach(([x, y, type]) => l.supplies.push({ x, y, type }));
    (route.hazards || []).filter(([x]) => x < routeEnd).forEach(([x, y, w, h, phase]) => l.hazards.push({ x, y, w, h, phase }));
    return l;
  }
  const api = { levels, buildLevel };
  root.SlopCommando = Object.assign(root.SlopCommando || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
