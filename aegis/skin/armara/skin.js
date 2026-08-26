// GENERATED from skin.json (source of truth). Regenerate with the command in README.md.
window.GameSlopKit = window.GameSlopKit || {};
window.GameSlopKit.skins = window.GameSlopKit.skins || {};
window.GameSlopKit.skins.armara = {
  "name": "armara",
  "title": "ARMARA AEGIS",
  "tagline": "HOLD THE ETERNAL GATE",
  "wordmark": "ARMARA",
  "logo": "logo.png",
  "musicVolume": 0.35,
  "fonts": {
    "display": "Cinzel",
    "body": "Cormorant Garamond",
    "googleFonts": "family=Cinzel:wght@400;700;900&family=Cormorant+Garamond:wght@400;600;700"
  },
  "palette": {
    "bg": "#07111A",
    "bg2": "#10212C",
    "marble": "#FFF3D1",
    "gold": "#F7C948",
    "goldDeep": "#A87316",
    "bronze": "#FF7A4A",
    "ink": "#FFF9EA",
    "muted": "#C8C9C2",
    "well": "#16323D",
    "grid": "#2B5360",
    "frame": "#F7C948",
    "ghost": "#27D7FF"
  },
  "background": {
    "image": "shell-bg.png",
    "position": "center",
    "overlay": 0.58
  },
  "art": {
    "battlefieldV2": "battlefield-v2.png",
    "enemyScoutAtlas": "enemy-scout-atlas.png",
    "enemyRaiderAtlas": "enemy-raider-atlas.png",
    "enemyGuardianAtlas": "enemy-guardian-atlas.png",
    "enemyTitanAtlas": "enemy-titan-atlas.png",
    "sentinelBaseAtlas": "sentinel-base-atlas.png",
    "chronosBaseAtlas": "chronos-base-atlas.png",
    "siegeBaseAtlas": "siege-base-atlas.png",
    "sentinelTopAtlas": "sentinel-top-atlas.png",
    "chronosTopAtlas": "chronos-top-atlas.png",
    "siegeTopAtlas": "siege-top-atlas.png",
    "towerCardAtlas": "tower-card-atlas.png",
    "gate": "gate.png",
    "breach": "breach.png"
  },
  "towers": {
    "sentinel": {
      "label": "SENTINEL",
      "role": "Fast, focused damage for single targets.",
      "cost": 40,
      "tone": { "base": "#27D7FF", "hi": "#E9FCFF", "lo": "#087EA8", "edge": "#FFF3D1" }
    },
    "chronos": {
      "label": "CHRONOS",
      "role": "Slows enemies and controls crowded lanes.",
      "cost": 55,
      "tone": { "base": "#B56CFF", "hi": "#ECDDFF", "lo": "#5E2E9D", "edge": "#63E7FF" }
    },
    "siege": {
      "label": "SIEGE",
      "role": "Heavy splash damage against grouped enemies.",
      "cost": 75,
      "tone": { "base": "#FF7A4A", "hi": "#FFC16B", "lo": "#A7372B", "edge": "#FFE1B2" }
    }
  },
  "enemies": {
    "scout": { "base": "#FF4D7A", "hi": "#FFB1C7", "lo": "#8B1741", "edge": "#FFE0E9" },
    "raider": { "base": "#E83258", "hi": "#FF8DA9", "lo": "#72162F", "edge": "#FFD1DD" },
    "guardian": { "base": "#B62B72", "hi": "#FF70B5", "lo": "#28162B", "edge": "#FFBADB" },
    "titan": { "base": "#7B1F57", "hi": "#FF3C88", "lo": "#160F24", "edge": "#FF9BC8" }
  },
  "effects": {
    "outline": "#071622",
    "sentinel": "#27D7FF",
    "chronos": "#B56CFF",
    "siege": "#FF7A4A",
    "enemy": "#FF3C78",
    "health": "#70F0A8",
    "danger": "#FF365D",
    "path": "#D9BE7A",
    "pathEdge": "#5C4422"
  },
  "watermarkAlpha": 0.025,
  "strings": {
    "score": "SCORE",
    "wave": "WAVE",
    "integrity": "INTEGRITY",
    "aether": "AETHER",
    "best": "BEST",
    "status": "COMMAND DECK",
    "planning": "PLANNING",
    "combat": "WAVE",
    "nextWave": "NEXT WAVE",
    "startWave": "START WAVE",
    "pause": "PAUSE",
    "sound": "SOUND",
    "storeTitle": "BUILD A DEFENSE",
    "inspectorTitle": "TOWER COMMAND",
    "build": "BUILD",
    "upgrade": "UPGRADE",
    "sell": "SELL",
    "maxLevel": "MAX LEVEL",
    "available": "AVAILABLE",
    "aetherShortfall": "MORE AETHER REQUIRED",
    "start": "PRESS ENTER OR TAP TO BEGIN\nSELECT A PAD · BUILD DEFENSES · LAUNCH THE WAVE",
    "paused": "TIME SUSPENDED",
    "resume": "RESUME DEFENSE",
    "gameOver": "THE GATE HAS FALLEN",
    "victory": "THE ETERNAL GATE STANDS",
    "victoryBody": "TWELVE WAVES BROKEN",
    "defeat": "THE GATE HAS FALLEN",
    "defeatBody": "THE LEGIONS BROKE THROUGH",
    "restart": "DEFEND AGAIN"
  }
};
