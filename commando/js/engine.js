(function (root) {
  'use strict';
  const { buildLevel, levels } = typeof module !== 'undefined' ? require('./levels.js') : root.SlopCommando;
  const { mulberry32, fnv1a } = typeof module !== 'undefined' ? require('../../_kit/rng.js') : root.GameSlopKit;
  const W = 960, H = 540, STEP = 1 / 60;
  const COYOTE_TIME = .1, JUMP_BUFFER_TIME = .12;
  const weapons = {
    P: { name: 'RIFLE', delay: .19, speed: 690, damage: 1 },
    M: { name: 'MACHINE GUN', delay: .09, speed: 780, damage: 1 },
    S: { name: 'SPREAD GUN', delay: .22, speed: 640, damage: 1 },
    L: { name: 'LASER RIFLE', delay: .31, speed: 1150, damage: 3, pierce: true, width: 18 },
    F: { name: 'FLAMETHROWER', delay: .1, speed: 400, damage: 2, ttl: .6, height: 14 },
    G: { name: 'GRENADE LAUNCHER', delay: .52, speed: 480, damage: 3, ttl: 1.35, gravity: 430, splash: 52, splashDamage: 3, width: 12, height: 12 },
    H: { name: 'HOMING ROCKET', delay: .46, speed: 430, damage: 4, ttl: 1.4, homing: 5.25, splash: 42, splashDamage: 2, width: 16, height: 8 },
    W: { name: 'WAVE CANNON', delay: .34, speed: 840, damage: 2, ttl: 1.15, pierce: true, width: 30, height: 16 },
    T: { name: 'TESLA CARBINE', delay: .38, speed: 760, damage: 2, chain: 2, width: 12, height: 10 },
    I: { name: 'CRYO BLASTER', delay: .23, speed: 620, damage: 1, slow: 2.5, width: 14, height: 12 },
    A: { name: 'PLASMA CANNON', delay: .6, speed: 520, damage: 5, splash: 65, splashDamage: 3, width: 20, height: 20 }
  };
  const difficultyRules = {
    easy: { lives: 12, dropChance: .1, cacheStep: 2, waveInterval: 6, enemyLimit: 14, fireScale: 1.3, holster: true, nukes: true },
    normal: { lives: 3, dropChance: .045, cacheStep: 4, waveInterval: 4.5, enemyLimit: 16, fireScale: 1, holster: true, nukes: true },
    hard: { lives: 3, dropChance: .015, cacheStep: 9, waveInterval: 2.5, enemyLimit: 22, fireScale: .75, holster: false, nukes: false }
  };
  const stageEnemies = ['vineMantis','securitySpider','riverRay','reactorOrb','iceWolf','slagCrab','caveBat','sporeWasp'];
  const specialEnemies = {
    vineMantis: { hp: 4, speed: 58, flying: false }, securitySpider: { hp: 5, speed: 65, flying: false },
    riverRay: { hp: 4, speed: 65, flying: true }, reactorOrb: { hp: 6, speed: 35, flying: true },
    iceWolf: { hp: 4, speed: 100, flying: false }, slagCrab: { hp: 8, speed: 24, flying: false },
    caveBat: { hp: 3, speed: 95, flying: true }, sporeWasp: { hp: 5, speed: 55, flying: true }
  };
  const weaponTier = p => Math.min(5, p.weaponLevels?.[p.weapon] || 1);
  const weaponDropTypes = ['P', 'S', 'M', 'L', 'F', 'G', 'H', 'W', 'T', 'I', 'A', 'B', 'R', 'C', 'N'];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function createEngine(options = {}) {
    let rng, id = 0;
    const state = { status: 'ready', seed: options.seed ?? 1978, tick: 0, elapsed: 0, score: 0, stage: 0, players: [], enemies: [], bullets: [], effects: [], pickups: [], inputLog: [], events: [], camera: { x: 0, y: 0 }, continues: 3, room: 0, boss: null, kills: 0 };
    function event(type, data = {}) { state.events.push({ type, ...data }); }
    const rules = () => difficultyRules[state.difficulty] || difficultyRules.normal;
    function makePlayer(n) { return { id: n, x: 110 + n * 70, y: 400, w: 30, h: 42, vx: 0, vy: 0, face: 1, lives: rules().lives, weapon: 'P', holstered: null, weaponLevels: {P:1}, cloak: 0, shield: 0, rapid: 0, invincible: 2, cooldown: 0, grounded: false, prone: false, jumpHeld: false, swapHeld: false, dropHeld: false, jumpQueued: false, jumpDownQueued: false, dropQueued: false, jumpBuffer: 0, coyoteTime: 0, jumpTime: 0, held: {}, aimX: 1, aimY: 0, distance: 0 }; }
    function resetMovementInput(p) {
      p.held = {}; p.jumpHeld = false; p.swapHeld = false; p.dropHeld = false;
      p.jumpQueued = false; p.jumpDownQueued = false; p.dropQueued = false;
      p.jumpBuffer = 0; p.coyoteTime = 0;
    }
    function equip(p, type) {
      p.weaponLevels ||= {P:1};
      if (type === p.weapon || (rules().holster && type === p.holstered)) {
        p.weaponLevels[type] = Math.min(5, (p.weaponLevels[type] || 1) + 1);
      } else {
        if (rules().holster) p.holstered = p.weapon;
        else { p.holstered = null; p.weaponLevels = {}; }
        p.weapon = type; p.weaponLevels[type] ||= 1;
      }
    }
    function resetEquipment(p) {
      p.weapon='P'; p.holstered=null; p.cloak=0; p.rapid=0; p.shield=0;
      if (!rules().holster) p.weaponLevels={P:1};
    }
    function populateRoute() {
      const l=state.level;
      if(l.mode==='base')return;
      const ledges=l.platforms.filter(p=>!p.ground&&p.w<900);
      const guns=Object.keys(weapons);
      const pool=[guns[state.stage%guns.length],guns[(state.stage+3)%guns.length],guns[(state.stage+7)%guns.length]];
      if(l.mode==='climb') {
        // Climbing caches are optional detours authored with the route, never automatic
        // weapon replacements on the next required landing.
        l.supplies=l.supplies.filter(p=>(!p.modes||p.modes.includes(state.difficulty))&&(p.type!=='N'||rules().nukes));
      } else {
        l.supplies=[];
        ledges.forEach((p,i)=>{
          if(i%rules().cacheStep===0) l.supplies.push({x:p.x+40,y:p.y-43,type:pool[Math.floor(i/rules().cacheStep)%pool.length]});
          if(i===3||i===Math.floor(ledges.length*.65)) l.supplies.push({x:p.x+p.w-70,y:p.y-43,type:i===3?'C':rules().nukes?'N':'B'});
        });
      }
      const extra=l.spawns.filter((_,i)=>i%(state.difficulty==='hard'?2:4)===0).map(e=>{
        const kind=stageEnemies[state.stage];
        const support=l.platforms.filter(p=>p.x<=e.x&&p.x+p.w>=e.x+32&&p.y>=e.y).sort((a,b)=>a.y-b.y)[0];
        return {...e,kind,y:!specialEnemies[kind].flying&&support?support.y-34:e.y};
      });
      if(state.difficulty==='hard')l.spawns.push(...extra);
      else extra.forEach(e=>{const old=l.spawns.find(s=>s.x===e.x);Object.assign(old,e);});
    }
    function loadStage(index) {
      state.stage = index; state.level = buildLevel(index); state.room = 0;
      populateRoute();
      state.enemies = []; state.bullets = []; state.pickups = []; state.effects = []; state.boss = null;
      state.camera = { x: 0, y: state.level.mode === 'climb' ? state.level.height - H : 0 };
      state.checkpoint = { x: 110, y: state.level.mode === 'climb' ? state.level.height - 94 : 410 };
      state.spawned = {}; state.stageTime = 0; state.waveTime = 0; state.banner = 3.4; state.roomTransition=0; state.nukeFlash=0;
      state.players.forEach((p, i) => { resetMovementInput(p); Object.assign(p, { x: 110 + i * 65, y: state.checkpoint.y, vy: 0, vx: 0, grounded: false, jumpTime: 0, invincible: 3 }); if (p.lives <= 0) p.lives = 1; });
      if (state.level.mode === 'base') loadRoom();
      event('stage', { stage: index });
    }
    function loadRoom() {
      state.enemies = []; state.bullets = []; state.pickups = [];
      for (let i = 0; i < 3; i++) state.enemies.push({ id: id++, kind: 'core', x: 220 + i * 250, y: 125, w: 42, h: 50, hp: 7 + state.stage, maxHp: 7 + state.stage, cooldown: 1.3 + i * .5 });
      state.players.forEach((p, i) => { resetMovementInput(p); p.jumpTime = 0; p.x = 390 + i * 80; p.y = 420; p.aimX = 0; p.aimY = -1; p.invincible = 2; });
      state.waveTime = 0;
      // Each bunker cache introduces a distinct part of the arsenal across both assaults.
      const cacheWeapons = state.stage===1?['T','L','M']:['A','F','I'];
      const cacheCount=state.difficulty==='easy'?4:state.difficulty==='hard'?(state.room%2===0?1:0):2;
      for(let i=0;i<cacheCount;i++)state.pickups.push({x:260+i*140,y:320+(i%2)*85,w:24,h:24,type:cacheWeapons[(state.room+i)%3],ttl:999});
      state.pickups.push({x:750,y:400,w:24,h:24,type:state.room===1&&rules().nukes?'N':'C',ttl:999});
      spawnEnemy({kind:stageEnemies[state.stage],x:160,y:280});
      if(state.difficulty==='hard')spawnEnemy({kind:stageEnemies[state.stage],x:770,y:280});
    }
    function start(config = {}) {
      state.seed = config.seed ?? state.seed; rng = mulberry32(state.seed); id = 0;
      const difficulty=config.difficulty==='assist'?'easy':config.difficulty==='arcade'?'normal':config.difficulty||'normal';
      Object.assign(state, { status: 'playing', tick: 0, elapsed: 0, score: 0, kills: 0, inputLog: [], events: [], difficulty: difficultyRules[difficulty]?difficulty:'normal', continues: 3, creditsUsed: 0, extraLifeAt: 15000 });
      state.players = Array.from({ length: config.players === 2 ? 2 : 1 }, (_, i) => makePlayer(i));
      loadStage(0);
    }
    function input(player, action, down) {
      const p = state.players[player]; if (!p || state.status !== 'playing') return;
      if (!['left', 'right', 'up', 'down', 'fire', 'jump', 'swap', 'drop'].includes(action) || p.held[action] === down) return;
      p.held[action] = down; state.inputLog.push({ tick: state.tick, player, action, down });
      // Capture presses here as well as held state so a quick tap can finish
      // between physics ticks without losing its jump or changing a drop intent.
      if (action === 'jump' && down) { p.jumpQueued = true; p.jumpDownQueued = !!p.held.down; }
      if (action === 'drop' && down) p.dropQueued = true;
    }
    function release() { state.players.forEach(resetMovementInput); }
    function pause() { if (state.status === 'playing') { state.status = 'paused'; release(); } else if (state.status === 'paused') state.status = 'playing'; }
    function advance() {
      if (state.status !== 'clear') return;
      if (state.stage === levels.length - 1) { state.status = 'victory'; event('victory'); }
      else { state.status = 'playing'; loadStage(state.stage + 1); }
    }
    function continueRun() {
      if (state.status !== 'gameover' || state.continues <= 0) return false;
      state.continues--; state.creditsUsed++;
      state.players.forEach(p => { p.lives = rules().lives; resetEquipment(p); });
      state.status = 'playing'; loadStage(state.stage); return true;
    }
    function addScore(points) {
      state.score += points;
      if (state.score >= state.extraLifeAt) { state.extraLifeAt += 15000; state.players.forEach(p => p.lives++); event('life'); }
    }
    function burst(x, y, color, count = 14) {
      for (let i = 0; i < count; i++) state.effects.push({ x, y, vx: (rng() - .5) * 290, vy: (rng() - .5) * 290, ttl: .25 + rng() * .45, color });
    }
    function awardEnemyKill(e) {
      burst(e.x + e.w / 2, e.y + e.h / 2, '#ff923d', e.kind === 'boss' ? 70 : 20);
      state.kills++; addScore(e.kind === 'boss' ? 5000 : e.kind === 'core' ? 500 : 150); event('explosion', { kind: e.kind });
      if (e.kind === 'boss') { state.status = 'clear'; state.bullets = []; release(); event('clear'); }
      else if (e.kind !== 'core' && !state.detonating && rng() < rules().dropChance) {
        const types=weaponDropTypes.filter(t=>rules().nukes||t!=='N');
        state.pickups.push({ x: e.x, y: e.y, w: 24, h: 24, type: types[Math.floor(rng() * types.length)], ttl: 18 });
      }
    }
    function damageEnemy(e, damage, impact) {
      if (e.hp <= 0) return false;
      e.hp -= damage; e.flash = .07;
      burst(impact.x, impact.y, '#ffcf73', 3);
      if (e.hp <= 0) awardEnemyKill(e);
      return true;
    }
    function steerHomingProjectile(b, targets, dt) {
      const target = targets.filter(e => e.hp > 0).reduce((nearest, e) => {
        const distance = Math.hypot(e.x + e.w / 2 - b.x, e.y + e.h / 2 - b.y);
        return !nearest || distance < nearest.distance ? { e, distance } : nearest;
      }, null);
      if (!target) return;
      const current = Math.atan2(b.vy, b.vx);
      const desired = Math.atan2(target.e.y + target.e.h / 2 - b.y, target.e.x + target.e.w / 2 - b.x);
      const delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
      const angle = current + clamp(delta, -b.homing * dt, b.homing * dt);
      const speed = b.speed || Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
    }
    function explodeProjectile(b, targets, directTarget) {
      if (b.exploded || !b.splash) return;
      b.exploded = true;
      event('impact', { weapon: b.weapon });
      burst(b.x, b.y, b.weapon === 'G' ? '#ff9b42' : '#ff5c45', 16);
      for (const e of targets) {
        if (e === directTarget || e.hp <= 0) continue;
        const distance = Math.hypot(e.x + e.w / 2 - b.x, e.y + e.h / 2 - b.y);
        if (distance <= b.splash) damageEnemy(e, b.splashDamage, b);
      }
    }
    function damagePlayer(p, falling = false) {
      if (p.lives <= 0 || (!falling && (p.invincible > 0 || p.shield > 0 || (state.level.mode === 'base' && p.jumpTime > 0)))) return;
      p.lives--; burst(p.x + 15, p.y + 20, '#ff433c', 22); event('death');
      resetEquipment(p); resetMovementInput(p); p.jumpTime = 0;
      if (p.lives > 0) {
        const c = state.checkpoint;
        p.x = c.x + p.id * 35; p.y = c.y; p.vy = 0; p.invincible = 3; p.grounded = false;
        if (state.level.mode === 'base') { p.x = 390 + p.id * 80; p.y = 420; }
      }
      if (state.players.every(q => q.lives <= 0)) { state.status = 'gameover'; release(); event('gameover'); }
    }
    function fire(p) {
      const tier=weaponTier(p),rank=tier-1;
      const w = weapons[p.weapon], base = state.level.mode === 'base';
      let dx = Number(!!p.held.right) - Number(!!p.held.left), dy = Number(!!p.held.down) - Number(!!p.held.up);
      if (!base && p.grounded && dy > 0) dy = 0;
      if (!dx && !dy) { dx = base ? 0 : p.face; dy = base ? -1 : 0; }
      const angle = Math.atan2(dy, dx); p.aimX = Math.cos(angle); p.aimY = Math.sin(angle);
      const angles = p.weapon === 'S' ? [-.25, -.125, 0, .125, .25] : [0];
      for (const spread of angles) {
        const a = angle + spread;
        state.bullets.push({
          id: id++, x: p.x + 15 + Math.cos(a) * 19, y: p.y + (p.prone ? 30 : 19) + Math.sin(a) * 13,
          vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, speed: w.speed,
          w: (w.width || 8)*(1+rank*.08), h: (w.height || 5)*(1+rank*.08), team: 'player', damage: w.damage*(1+rank*.3), weapon: p.weapon, tier,
          ttl: w.ttl || 1.5, gravity: w.gravity || 0, homing: w.homing || 0,
          splash: (w.splash || 0)*(1+rank*.12), splashDamage: (w.splashDamage || 0)*(1+rank*.3), pierce: !!w.pierce, hits: [], chain:(w.chain||0)+(w.chain?rank:0), slow:(w.slow||0)*(1+rank*.2)
        });
      }
      p.cooldown = w.delay * (1-rank*.075) * (p.rapid > 0 ? .65 : 1); event('shot', { weapon: p.weapon, player: p.id });
    }
    function enemyShot(e, target, offset = 0, speed = 180) {
      if(!target || target.cloak>0)return;
      const x = e.x + e.w / 2, y = e.y + e.h / 2;
      const a = Math.atan2(target.y + 20 - y, target.x + 15 - x) + offset;
      state.bullets.push({ x, y, w: 9, h: 9, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, team: 'enemy', ttl: 5 });
    }
    function spawnEnemy(spec) {
      const hp = specialEnemies[spec.kind]?.hp || (spec.kind === 'turret' ? 5 : 2);
      state.enemies.push({ ...spec, id: id++, originX: spec.x, originY: spec.y, w: 32, h: 34, hp, maxHp: hp, cooldown: .8 + rng(), phase: rng() * 6, vx: -35 });
    }
    function spawnBoss() {
      const l = state.level, base = l.mode === 'base', climb = l.mode === 'climb';
      const hp = 95 + state.stage * 18;
      state.boss = { id: id++, kind: 'boss', x: base ? 400 : climb ? 710 : l.width - 230, y: base ? 130 : climb ? 46 : 310, w: 130, h: 144, hp, maxHp: hp, cooldown: 1.2, phase: 0, attack: 0, variant: state.stage, name: l.boss, originX: base ? 400 : climb ? 710 : l.width - 230, originY: base ? 130 : climb ? 46 : 310 };
      state.bullets = state.bullets.filter(b => b.team === 'player'); event('boss'); state.banner = 2;
    }
    function movePlayer(p, dt) {
      if (p.lives <= 0) return;
      const l = state.level, base = l.mode === 'base';
      p.cooldown -= dt; p.invincible -= dt; p.shield -= dt; p.rapid -= dt; p.cloak=Math.max(0,(p.cloak||0)-dt); p.jumpTime = Math.max(0, p.jumpTime - dt);
      if(p.held.swap&&!p.swapHeld&&rules().holster&&p.holstered){[p.weapon,p.holstered]=[p.holstered,p.weapon];event('swap');}
      p.swapHeld=!!p.held.swap;
      const dx = Number(!!p.held.right) - Number(!!p.held.left), dy = Number(!!p.held.down) - Number(!!p.held.up);
      const jumping = p.jumpQueued || (p.held.jump && !p.jumpHeld);
      const downJump = jumping && (p.jumpQueued ? p.jumpDownQueued : !!p.held.down);
      const dropping = p.dropQueued || (p.held.drop && !p.dropHeld);
      p.jumpQueued = false; p.jumpDownQueued = false; p.dropQueued = false;
      p.jumpHeld = !!p.held.jump; p.dropHeld = !!p.held.drop;
      p.jumpBuffer = Math.max(0, (p.jumpBuffer || 0) - dt);
      p.coyoteTime = Math.max(0, (p.coyoteTime || 0) - dt);
      p.prone = !base && p.grounded && !!p.held.down && !jumping;
      if (dx) p.face = dx;
      p.vx = dx * (p.prone ? 0 : 225);
      if (base) {
        const scale = dx && dy ? Math.SQRT1_2 : 1;
        p.x = clamp(p.x + p.vx * dt * scale, 100, 830); p.y = clamp(p.y + dy * 205 * dt * scale, 260, 478);
        p.jumpBuffer = 0; p.coyoteTime = 0;
        if (jumping && !dropping && p.jumpTime <= 0) { p.jumpTime = .6; event('jump'); }
      } else {
        const wasGrounded = p.grounded;
        let leftByAction = false;
        const support = p.grounded && l.platforms.find(platform=>Math.abs(p.y+p.h-platform.y)<=1&&p.x+p.w>platform.x&&p.x<platform.x+platform.w);
        if (dropping || downJump) {
          // A downward request never waits for a landing and must not become a
          // buffered jump or leave coyote time available to undo the descent.
          p.jumpBuffer = 0; p.coyoteTime = 0;
          if (support && !support.ground) {
            // Move the feet past this one-way surface. Other platforms remain solid,
            // including close shelves immediately below the boss arena.
            p.y += 3; p.vy = 90; p.grounded = false; leftByAction = true; event('drop');
          }
          else if (!dropping && p.grounded) p.jumpBuffer = JUMP_BUFFER_TIME;
        }
        else if (jumping) p.jumpBuffer = JUMP_BUFFER_TIME;
        const launch = () => { p.vy = -510; p.grounded = false; p.jumpBuffer = 0; p.coyoteTime = 0; leftByAction = true; event('jump'); };
        if (p.jumpBuffer > 1e-9 && (p.grounded || p.coyoteTime > 1e-9)) launch();
        p.x = clamp(p.x + p.vx * dt, state.camera.x, l.width - p.w);
        const feet = p.y + p.h; p.vy += 1150 * dt; p.y += p.vy * dt; p.grounded = false;
        if (p.vy >= 0) {
          let landing=null;
          for (const platform of l.platforms) {
            if (p.x + p.w > platform.x && p.x < platform.x + platform.w && feet <= platform.y + 1 && p.y + p.h >= platform.y && (!landing||platform.y<landing.y)) landing=platform;
          }
          if(landing) {
            p.y = landing.y - p.h; p.vy = 0; p.grounded = true; p.onGround = !!landing.ground; p.coyoteTime = 0;
            if (l.mode === 'climb' && landing.y < state.checkpoint.y + p.h) state.checkpoint = { x: landing.x + 45, y: landing.y - p.h };
            if (p.jumpBuffer > 1e-9) launch();
          }
        }
        if (wasGrounded && !p.grounded && !leftByAction) p.coyoteTime = COYOTE_TIME;
        if (p.y > l.height + 40 || (l.mode === 'climb' && p.y > state.camera.y + H + 70)) damagePlayer(p, true);
      }
      if (p.held.fire && p.cooldown <= 0) fire(p);
      if (!base && dx) { p.aimX = dx; p.aimY = p.held.up ? -1 : 0; }
    }
    function tick() {
      if (state.status !== 'playing') return;
      const dt = STEP, l = state.level;
      state.tick++; state.elapsed += dt; state.stageTime += dt; state.banner = Math.max(0, state.banner - dt);
      state.roomTransition=Math.max(0,(state.roomTransition||0)-dt); state.nukeFlash=Math.max(0,(state.nukeFlash||0)-dt);
      state.players.forEach(p => movePlayer(p, dt));
      if (state.status !== 'playing') return;
      const alive = state.players.filter(p => p.lives > 0), lead = alive.reduce((a,b) => l.mode === 'climb' ? (a.y < b.y ? a : b) : (a.x > b.x ? a : b));
      if (l.mode === 'run') {
        // Both players share the screen; the rear player cannot be left outside it.
        const rear = Math.min(...alive.map(p => p.x));
        lead.x = Math.min(lead.x, rear + W - 80);
        state.camera.x = Math.max(state.camera.x, clamp(lead.x - W * .42, 0, l.width - W));
        const segment = l.platforms.find(p => p.ground && p.x <= state.camera.x + 80 && p.x + p.w > state.camera.x + 130);
        if (segment) state.checkpoint = { x: Math.max(110, state.camera.x + 80), y: 410 };
        if (!state.boss && lead.x > l.width - 780) spawnBoss();
      } else if (l.mode === 'climb') {
        // Keep a quiet center band, but follow both ascent and deliberate retreats.
        if (lead.y < state.camera.y + 235) state.camera.y = clamp(lead.y - 235, 0, l.height - H);
        else if (lead.y > state.camera.y + 340) state.camera.y = clamp(lead.y - 340, 0, l.height - H);
        if (!state.boss && lead.y < 350) spawnBoss();
      }
      l.spawns.forEach((e, i) => {
        if (!state.spawned[i] && e.x < state.camera.x + W + 80 && e.y > state.camera.y - 100 && e.y < state.camera.y + H + 40) { state.spawned[i] = true; spawnEnemy(e); }
      });
      l.supplies.forEach((p, i) => {
        if (!state.spawned['p' + i] && p.x < state.camera.x + W && p.y > state.camera.y - 100 && p.y < state.camera.y + H) { state.spawned['p' + i] = true; state.pickups.push({ ...p, w: 24, h: 24, ttl: 999 }); }
      });
      state.waveTime += dt;
      if (state.waveTime > rules().waveInterval*(l.mode==='base'?.65:1) && state.enemies.length < rules().enemyLimit) {
        state.waveTime = 0;
        const kind=rng()<.55?stageEnemies[state.stage]:'drone';
        if (l.mode === 'base') spawnEnemy({ kind, x: rng() > .5 ? 130 : 800, y: 280 });
        else if (!state.boss) {
          const flying=kind==='drone'||specialEnemies[kind]?.flying;
          const ground=l.platforms.find(p=>p.ground&&p.x<=state.camera.x+W-70&&p.x+p.w>=state.camera.x+W-20);
          if(flying||ground)spawnEnemy({kind,x:state.camera.x+W-65,y:flying?state.camera.y+130+rng()*110:ground.y-34});
        }
      }
      for (const e of state.enemies) {
        e.cooldown -= dt; e.phase = (e.phase || 0) + dt;
        e.slow=Math.max(0,(e.slow||0)-dt);const speedScale=e.slow>0?.35:1;
        const target = alive.filter(p=>!p.cloak).reduce((a,b) => !a||Math.hypot(b.x-e.x,b.y-e.y)<Math.hypot(a.x-e.x,a.y-e.y)?b:a,null);
        if (e.kind === 'soldier' && target) {
          const nx = e.x + (target.x > e.x ? 32 : -32) * dt*speedScale;
          if (l.platforms.some(p => p.x < nx && p.x + p.w > nx + e.w && Math.abs(p.y - e.y - e.h) < 3)) e.x = nx;
        }
        if (e.kind === 'drone') { if(target)e.x += (target.x > e.x ? 55 : -55) * dt*speedScale; e.y = e.originY + Math.sin(e.phase * 2) * 30; }
        const special=specialEnemies[e.kind];
        if(special){
          if(target){
            const dx=target.x-e.x,dy=target.y-e.y,d=Math.max(1,Math.hypot(dx,dy));
            const dash=e.kind==='iceWolf'&&Math.sin(e.phase*2)>.7?2:1;
            const step=special.speed*speedScale*dash*dt;
            if(special.flying||l.mode==='base'){
              e.x+=dx/d*step;e.y+=dy/d*step*(e.kind==='reactorOrb'?.35:1);
            }else{
              const nx=e.x+Math.sign(dx)*step;
              if(l.platforms.some(p=>nx>=p.x&&nx+e.w<=p.x+p.w&&Math.abs(p.y-e.y-e.h)<4))e.x=nx;
            }
          }
          if(special.flying)e.y+=Math.sin(e.phase*(e.kind==='caveBat'?12:5))*dt*12*speedScale;
        }
        if (target && e.cooldown <= 0 && e.x > state.camera.x - 40 && e.y > state.camera.y - 40) {
          if(e.kind==='slagCrab'||e.kind==='reactorOrb')for(const offset of [-.2,0,.2])enemyShot(e,target,offset,145);
          else if(e.kind!=='iceWolf'&&e.kind!=='caveBat')enemyShot(e, target, 0, 160 + state.stage * 8);
          e.cooldown = (e.kind === 'turret' ? 1.4 : e.kind==='sporeWasp'?1.3:2.2) * rules().fireScale / speedScale;
        }
        for (const p of alive) { const box = playerBox(p); if (hit(e, box)) damagePlayer(p); }
      }
      const boss = state.boss;
      if (state.status !== 'playing') return;
      if (boss) {
        boss.phase += dt; boss.cooldown -= dt;
        if (l.mode === 'base') boss.x = 410 + Math.sin(boss.phase * .7) * 230;
        if (state.stage === 2) boss.x = boss.originX - (1 + Math.sin(boss.phase * .7)) * 160;
        if (state.stage === 4) boss.x = boss.originX - (1 + Math.sin(boss.phase * .8)) * 80;
        if (state.stage >= 6) boss.y = boss.originY - Math.abs(Math.sin(boss.phase)) * 65;
        if (boss.cooldown <= 0) {
          const rage = boss.hp < boss.maxHp * .45;
          boss.attack++;
          if (state.stage === 1 || state.stage === 3) {
            // Bunker sentries sweep lanes; the player can jump over the salvo.
            for (let i = 0; i < (rage ? 7 : 5); i++) enemyShot(boss, { x: 100 + i * (rage ? 110 : 160), y: 540 }, 0, 175);
          } else if ((state.stage === 6 || state.stage === 7) && boss.attack % 2 === 0) {
            // The final guardians emit a radial burst instead of aimed fire.
            const count = rage ? 16 : 12;
            for (let i = 0; i < count; i++) enemyShot(boss, { x: boss.x + 200, y: boss.y + 50 }, i * Math.PI * 2 / count + boss.phase * .1, 160);
          } else {
            const target=alive.find(p=>!p.cloak);
            for (let i = -1; i <= 1; i++) enemyShot(boss, target, i * (rage ? .25 : .18), 185 + state.stage * 7);
            if (rage) { enemyShot(boss, target, -.5, 180); enemyShot(boss, target, .5, 180); }
          }
          if ((state.stage === 2 || state.stage === 6) && boss.attack % 3 === 0 && state.enemies.length < 10) spawnEnemy({ kind: 'drone', x: boss.x - 40, y: boss.y + 30 });
          if ((state.stage === 4 || state.stage === 5) && boss.attack % 2 === 0) {
            state.bullets.push({ x: boss.x - 15, y: 436, w: 22, h: 16, vx: -210, vy: 0, team: 'enemy', ttl: 5 });
          }
          boss.cooldown = (rage ? .95 : 1.5) + (state.stage === 7 ? .15 : 0);
          event('cannon');
        }
        alive.forEach(p => { if (hit(boss, playerBox(p))) damagePlayer(p); });
      }
      if (state.status !== 'playing') return;
      for (const b of state.bullets) {
        if (state.status !== 'playing') break;
        const targets = b.team === 'player' ? [...state.enemies, ...(boss ? [boss] : [])] : [];
        if (b.team === 'player' && b.homing) steerHomingProjectile(b, targets, dt);
        b.vy += (b.gravity || 0) * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.ttl -= dt;
        if (b.team === 'player') {
          b.hits = b.hits || [];
          for (const e of targets) {
            if (e.hp <= 0 || b.ttl <= 0 || b.hits.includes(e.id) || !hit(b, e)) continue;
            b.hits.push(e.id); damageEnemy(e, b.damage, b);
            if(b.slow)e.slow=b.slow;
            if(b.chain){
              let source=e;
              for(let jump=0;jump<b.chain;jump++){
                const next=targets.filter(t=>t.hp>0&&!b.hits.includes(t.id)&&Math.hypot(t.x-source.x,t.y-source.y)<160)
                  .sort((a,z)=>Math.hypot(a.x-source.x,a.y-source.y)-Math.hypot(z.x-source.x,z.y-source.y))[0];
                if(!next)break;
                state.effects.push({x:source.x+16,y:source.y+16,x2:next.x+16,y2:next.y+16,vx:0,vy:0,ttl:.18,color:'#b3a0ff',arc:true});
                b.hits.push(next.id);damageEnemy(next,b.damage*.65,b);source=next;
              }
            }
            if (b.splash) { explodeProjectile(b, targets, e); b.ttl = 0; break; }
            if (!b.pierce) b.ttl = 0;
            if (state.status !== 'playing') break;
          }
          if (b.ttl <= 0 && b.splash) explodeProjectile(b, targets);
        } else {
          for (const p of alive) if (hit(b, playerBox(p))) { damagePlayer(p); b.ttl = 0; break; }
        }
      }
      state.enemies = state.enemies.filter(e => e.hp > 0 && e.x > state.camera.x - 150 && e.y < state.camera.y + H + 150);
      state.enemies.forEach(e => e.flash = Math.max(0, (e.flash || 0) - dt));
      if (boss) boss.flash = Math.max(0, (boss.flash || 0) - dt);
      state.bullets = state.bullets.filter(b => b.ttl > 0 && b.x > state.camera.x - 100 && b.x < state.camera.x + W + 100 && b.y > state.camera.y - 80 && b.y < state.camera.y + H + 100);
      for (const p of state.pickups) {
        p.ttl -= dt;
        // Pickups are now wide weapon silhouettes, so their full visible width collects.
        const pickupBox = { x: p.x - 12, y: p.y - 5, w: p.w + 24, h: p.h + 10 };
        for (const player of alive) if (hit(pickupBox, player)) {
          if (weapons[p.type]) equip(player,p.type);
          else if (p.type === 'B') player.shield = 12;
          else if (p.type === 'R') player.rapid = 20;
          else if (p.type === 'C') player.cloak = 8;
          else if (p.type === 'N' && rules().nukes) {
            state.detonating=true;
            const screen={x:state.camera.x,y:state.camera.y,w:W,h:H};
            for(const enemy of state.enemies)if(enemy.kind!=='boss'&&enemy.hp>0&&hit(enemy,screen))damageEnemy(enemy,enemy.hp,enemy);
            state.detonating=false;state.nukeFlash=1.2;
            state.bullets=state.bullets.filter(b=>b.team==='player'||!hit(b,screen));event('nuke');
          }
          p.ttl = 0; addScore(200); event('pickup', { weapon: p.type }); break;
        }
      }
      state.pickups = state.pickups.filter(p => p.ttl > 0);
      for (const h of l.hazards) if ((state.tick + h.phase) % 240 > 120) alive.forEach(p => { if (hit(playerBox(p), h)) damagePlayer(p); });
      for (const e of state.effects) { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 250 * dt; e.ttl -= dt; }
      state.effects = state.effects.filter(e => e.ttl > 0);
      if (l.mode === 'base' && !state.boss && state.enemies.every(e => e.kind !== 'core')) {
        if (state.room < 2) { state.room++; loadRoom(); state.roomTransition=.65; state.banner = 2; event('room'); }
        else spawnBoss();
      }
    }
    function playerBox(p) { return { x: p.x + 6, y: p.y + (p.prone ? 27 : 6), w: p.w - 12, h: p.prone ? 14 : p.h - 9 }; }
    function drainEvents() { return state.events.splice(0); }
    // A ready scene is real level data and uses the same renderer as gameplay.
    state.difficulty = 'normal'; rng = mulberry32(state.seed); state.players = [makePlayer(0)]; loadStage(0); state.events = [];
    return { state, start, input, tick, pause, release, advance, continueRun, drainEvents, hash: () => fnv1a(JSON.stringify(state.inputLog)) };
  }
  const api = { createEngine, weapons, weaponTier, difficultyRules, stageEnemies, specialEnemies, W, H, STEP, hit };
  root.SlopCommando = Object.assign(root.SlopCommando || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
