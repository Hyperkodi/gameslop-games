/* One decoded, gapless stage loop; reusable effects with individual mix levels. */
(function (root) {
  'use strict';
  const tracks = ['1.mp3', '2.mp3', '3.mp3', '4.mp3', '5.mp3', '6.mp3', '7.mp3', '8.mp3'];
  const musicLevel = .38;
  const victoryTrack = 'Level Victory.mp3';
  const sampleLevels = {
    'shot:P':.38, 'shot:M':.08, 'shot:S':.28, 'shot:L':.10, 'shot:F':.08, 'shot:G':.55,
    'shot:H':.14, 'shot:W':.35, 'shot:T':.10, 'shot:I':.16, 'shot:A':.17,
    'impact:H':.20, 'impact:G':.28, 'grenade:frag':.28, 'grenade:incendiary':.25,
    'grenade:electric':.10, bossExplosion:.16, nuke:.40, barrier:.22, cloak:.4
  };
  const isDialogue = cue => cue.startsWith('victory:') || cue.startsWith('ally:');
  const sampleLevel = cue => isDialogue(cue) ? .8 : sampleLevels[cue] ?? .5;
  const voiceLimit = cue => isDialogue(cue) ? 1 : cue.startsWith('shot:') || cue.startsWith('impact:') || cue.startsWith('grenade:') ? 2 : 3;
  const allyDialogue = {
    pawns: {name:'Pons',line:"All right, I'm with you. Let's murder these assholes.",file:'ally-pawns-v1.mp3'},
    wojak: {name:'Wojak',line:'Fine, if I must.',file:'ally-wojak-v1.mp3'},
    sloppy: {name:'Sloppy',line:"You're all fired.",file:'ally-sloppy-v1.mp3'}
  };
  const victoryDialogue = [
    ['Chump', "Yeah, fuck you, I'm the shit."],
    ['GreenHood', "You brought all that firepower and still couldn't hit me?"],
    ['ZZZ', "Go back to sleep. You're embarrassing yourself."],
    ['Boner', "Get that weak shit outta here."],
    ['Memory Cow Moo', 'Ha, squashed that beef.'],
    ['Pipedog', 'Where the fuck did you think you were going?'],
    ['Cash Cat', 'Next time, spend some of that money on backup.'],
    ['Artificial Inu', 'Somebody built you to fight? They did a shitty job.']
  ];
  const samples = {
    'shot:P':'Rifle Pop.wav', 'shot:M':'Machine Gun.mp3', 'shot:S':'Spread Gun.mp3', 'shot:L':'Laser Rifle.mp3',
    'shot:F':'Flame Thrower.mp3', 'shot:G':'Grenade Launcher.mp3',
    'shot:H':'Rocket Launcher.mp3', 'shot:W':'Wave Cannon.mp3',
    'shot:T':'Tesla Carbine.mp3', 'shot:I':'Cryo-Blaster.mp3', 'shot:A':'Plasma Cannon.mp3',
    'impact:G':'Grenade Explosion.mp3', 'impact:H':'Rocket Explosion.mp3',
    'grenade:frag':'Grenade Explosion.mp3', 'grenade:incendiary':'Grenade Explosion.mp3', 'grenade:electric':'Tesla Carbine.mp3',
    barrier:'Barrier.mp3', cloak:'Invisibility Cloak.mp3', nuke:'Nuke.mp3', bossExplosion:'Boss Explosion.mp3'
  };
  victoryDialogue.forEach((_, i) => { samples['victory:' + i] = 'victory-' + String(i + 1).padStart(2, '0') + '-american-v6.mp3'; });
  Object.entries(allyDialogue).forEach(([id,line])=>{samples['ally:'+id]=line.file;});
  // Keep distinct synthesized cues for actions without a supplied recording.
  const recipes = {
    shot:[[180,.045,'square',.018,0,70]],
    'shot:T':[[850,.09,'sawtooth',.025,0,110],[1400,.06,'square',.012,.03,250]],
    'shot:I':[[1400,.14,'triangle',.04,0,400]],
    'shot:A':[[95,.22,'sawtooth',.04,0,32]],
    jump:[[160,.11,'square',.025,0,480]],
    jetpackThrust:[[65,.17,'sawtooth',.009,0,48]],
    jetpackEmpty:[[180,.13,'triangle',.025,0,75]],
    companionJoined:[[330,.1,'triangle',.04],[440,.1,'triangle',.04,.12],[660,.28,'triangle',.04,.25]],
    grenadeThrow:[[280,.06,'triangle',.022,0,160]],
    grenadePulse:[[420,.075,'sawtooth',.012,0,190],[900,.04,'triangle',.008,.025,500]],
    'grenade:frag':[[75,.22,'sawtooth',.05,0,25]],
    'grenade:incendiary':[[100,.4,'sawtooth',.035,0,38]],
    'grenade:electric':[[1100,.22,'sawtooth',.025,0,120]],
    explosion:[[75,.17,'sawtooth',.05,0,25],[130,.12,'triangle',.035,0,30]],
    hurt:[[170,.09,'triangle',.025,0,90]],
    death:[[240,.22,'sawtooth',.04,0,35]],
    pickup:[[440,.07,'square',.04],[660,.08,'square',.04,.07],[880,.1,'square',.04,.14]],
    cloak:[[720,.35,'sine',.05,0,120]], swap:[[260,.05,'triangle',.035,0,520]],
    nuke:[[45,.8,'sawtooth',.07,0,15],[90,.5,'triangle',.05]],
    cannon:[[62,.18,'sawtooth',.035,0,30]],
    boss:[[110,.2,'square',.045],[130,.2,'square',.045,.22],[110,.4,'square',.045,.44]],
    stage:[[220,.1,'square',.035],[330,.1,'square',.035,.1],[440,.18,'square',.035,.2]],
    clear:[[330,.12,'square',.04],[440,.12,'square',.04,.14],[550,.12,'square',.04,.28],[660,.35,'square',.04,.42]],
    life:[[660,.12,'triangle',.05],[880,.18,'triangle',.05,.12]]
  };
  function cueFor(event) {
    if(event.type==='grenadeImpact')return 'grenade:'+event.grenade;
    if (event.type === 'shot') return 'shot:' + (event.weapon || 'P');
    if (event.type === 'impact') return 'impact:' + event.weapon;
    if (event.type === 'explosion' && event.kind === 'boss') return 'bossExplosion';
    if (event.type === 'pickup' && event.weapon === 'B') return 'barrier';
    if (event.type === 'pickup' && event.weapon === 'C') return 'cloak';
    if (event.type === 'pickup' && event.weapon === 'N') return null;
    return event.type;
  }
  function createAudio(options = {}) {
    const env = options.env || root;
    const buffers = new Map(), voices = [], pending = new Map(), failures = new Set();
    let ctx, master, musicGain, effectsGain, dialogueGain, unlocked = false, muted = false;
    let musicBuffer = null, musicSource = null, musicOffset = 0, musicStartedAt = 0;
    let musicPending = false, musicLoading = Promise.resolve();
    let stage = -1, status = 'ready', playingMusic = false, loading = Promise.resolve();
    let musicFailed = false, lastCue = null, lastSample = null, musicAttempt = 0;
    let dialogueAttempt = 0, lastDialogue = null;
    const heardAllies=new Set();let lastAllyDialogue=null;
    let bossSource=null;
    let victoryBuffer = null, victoryLoading = null, musicTrack = null;
    try { muted = env.localStorage?.getItem('gameslop:muted') === '1'; } catch (_) { /* Private mode. */ }
    const path = (folder, file) => folder + '/' + encodeURIComponent(file);
    function stopVoice(voice) {
      const index = voices.indexOf(voice); if (index < 0) return;
      voices.splice(index, 1); voice.source.onended = null;
      try { voice.source.stop(); } catch (_) { /* Already ended. */ }
      voice.source.disconnect(); voice.gain.disconnect();
      if(voice.cue.startsWith('ally:')) duckForAlly();
    }
    function duckForAlly(){
      if(!ctx||!musicGain||!effectsGain)return;
      const speaking=voices.some(v=>v.cue.startsWith('ally:'));
      for(const [gain,value]of [[musicGain,musicLevel*(speaking ? .45 : 1)],[effectsGain,.28*(speaking ? .5 : 1)]]){
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value,ctx.currentTime);
        gain.gain.linearRampToValueAtTime(value,ctx.currentTime+.12);
      }
    }
    function allyLine(id){
      if(!allyDialogue[id]||heardAllies.has(id))return;
      heardAllies.add(id);
      if(muted||!unlocked||!ctx||status!=='playing')return;
      const attempt=++dialogueAttempt,joinedStage=stage,deadline=ctx.currentTime+5,cue='ally:'+id;
      loadSample(cue).then(()=>{
        if(attempt!==dialogueAttempt||stage!==joinedStage||status!=='playing'||muted||ctx.currentTime>deadline||!buffers.has(cue))return;
        voices.filter(v=>isDialogue(v.cue)).forEach(stopVoice);
        lastAllyDialogue=id;play(cue);
      });
    }
    function stopEffects() { [...voices].forEach(stopVoice);bossSource=null; }
    function interrupt() { dialogueAttempt++; stopEffects(); stopMusic(); }
    function victoryLine() {
      if (muted || !unlocked || !ctx || !victoryDialogue[stage]) return;
      const attempt = ++dialogueAttempt, clearedStage = stage, cue = 'victory:' + stage;
      // Give the victory music a short lead before the spoken line.
      Promise.all([loadSample(cue), new Promise(resolve => (env.setTimeout || setTimeout)(resolve, 900))]).then(() => {
        if (attempt !== dialogueAttempt || status !== 'clear' || stage !== clearedStage || muted || !buffers.has(cue)) return;
        stopEffects(); lastDialogue = clearedStage; play(cue);
      });
    }
    function ensure() {
      if (!unlocked) return;
      if (!ctx) {
        const AC = env.AudioContext || env.webkitAudioContext;
        if (!AC) return;
        try {
          ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .8;
          const compressor = ctx.createDynamicsCompressor();
          master.connect(compressor); compressor.connect(ctx.destination);
          musicGain = ctx.createGain(); musicGain.gain.value = musicLevel; musicGain.connect(master);
          // Lower all combat and synthesized effects about 9 dB without losing speech.
          effectsGain = ctx.createGain(); effectsGain.gain.value = .28; effectsGain.connect(master);
          dialogueGain = ctx.createGain(); dialogueGain.gain.value = .8; dialogueGain.connect(master);
          loading = Promise.all(Object.keys(samples).map(loadSample));
          preloadVictory();
        } catch (_) { return; }
      }
      if (ctx.state === 'suspended') Promise.resolve(ctx.resume()).catch(() => {});
    }
    function sampleRegion(buffer) {
      // MP3 recordings can include silence before the transient. Align firing to it.
      const channels = Array.from({length:buffer.numberOfChannels}, (_, i) => buffer.getChannelData(i));
      let first = 0, last = buffer.length - 1;
      const audible = n => channels.some(channel => Math.abs(channel[n]) > .002);
      while (first < last && !audible(first)) first++;
      while (last > first && !audible(last)) last--;
      const offset = Math.max(0, first / buffer.sampleRate - .005);
      return {buffer, offset, duration:Math.max(.01, Math.min(buffer.duration, last / buffer.sampleRate + .04) - offset)};
    }
    function loadSample(cue) {
      if (pending.has(cue)) return pending.get(cue);
      const promise = env.fetch(path('Sound Effects', samples[cue]))
        .then(response => { if (!response.ok) throw new Error('Audio unavailable'); return response.arrayBuffer(); })
        .then(bytes => ctx.decodeAudioData(bytes))
        .then(buffer => buffers.set(cue, sampleRegion(buffer)))
        .catch(() => failures.add(cue));
      pending.set(cue, promise); return promise;
    }
    function addVoice(source, gain, cue) {
      const same = voices.filter(v => v.cue === cue);
      if (same.length >= voiceLimit(cue)) stopVoice(same[0]);
      while (voices.length >= 16) stopVoice(voices.find(v=>!isDialogue(v.cue))||voices[0]);
      const voice = {source, gain, cue}; voices.push(voice);
      source.onended = () => stopVoice(voice);
      source.connect(gain); gain.connect(isDialogue(cue) ? dialogueGain : effectsGain);
      if(cue.startsWith('ally:'))duckForAlly();
    }
    function synth(cue) {
      const fallback = cue.startsWith('shot:') ? 'shot' : cue.startsWith('impact:') || cue === 'bossExplosion' ? 'explosion' : cue === 'barrier' ? 'pickup' : cue;
      for (const [freq, duration, type, volume, delay = 0, slide] of recipes[cue] || recipes[fallback] || []) {
        const source = ctx.createOscillator(), gain = ctx.createGain(), time = ctx.currentTime + delay;
        source.type = type; source.frequency.setValueAtTime(freq, time);
        if (slide) source.frequency.exponentialRampToValueAtTime(slide, time + duration);
        const mix = sampleLevels[cue] !== undefined ? sampleLevels[cue] / (cue.startsWith('shot:') ? .55 : .8) : .7;
        gain.gain.setValueAtTime(volume * mix, time); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
        addVoice(source, gain, cue); source.start(time); source.stop(time + duration + .02);
      }
    }
    function play(cue) {
      if (!cue || muted || !unlocked || !ctx || status === 'paused' || status === 'ready') return;
      lastCue = cue;
      const sample = buffers.get(cue);
      lastSample = sample ? cue : null;
      if (!sample) { synth(cue); return; }
      const source = ctx.createBufferSource(), gain = ctx.createGain(); source.buffer = sample.buffer;
      gain.gain.value = sampleLevel(cue);
      addVoice(source, gain, cue); source.start(0, sample.offset, sample.duration);
    }
    function musicPosition() {
      if (!musicBuffer) return 0;
      const position = musicOffset + (musicSource ? Math.max(0, ctx.currentTime - musicStartedAt) : 0);
      return musicTrack === victoryTrack ? Math.min(position, musicBuffer.duration) : position % musicBuffer.duration;
    }
    function stopMusic(reset = false) {
      if (musicSource) {
        musicOffset = musicPosition();
        musicSource.onended = null;
        try { musicSource.stop(); } catch (_) { /* Already stopped. */ }
        musicSource.disconnect(); musicSource = null;
      }
      playingMusic = false;
      if (reset) { musicOffset = 0; musicBuffer = null; }
    }
    function selectTrack() {
      const attempt = ++musicAttempt, file = ['clear','victory'].includes(status) ? victoryTrack : tracks[stage];
      stopMusic(true); musicFailed = false; musicPending = false;
      musicTrack = file;
      if (!ctx || !unlocked || !file || status === 'ready') return;
      musicPending = true;
      // Keep one stage track plus the short, preloaded victory track in memory.
      const download = file === victoryTrack ? preloadVictory() : env.fetch(path('Soundtrack', file))
        .then(response => { if (!response.ok) throw new Error('Music unavailable'); return response.arrayBuffer(); })
        .then(bytes => attempt === musicAttempt ? ctx.decodeAudioData(bytes) : null);
      if (file === victoryTrack && victoryBuffer) {
        musicPending = false; musicBuffer = victoryBuffer; syncMusic(); return;
      }
      musicLoading = download.then(buffer => {
          if (attempt !== musicAttempt) return;
          if (!buffer) throw new Error('Music unavailable');
          musicPending = false; musicBuffer = buffer; syncMusic();
        })
        .catch(() => { if (attempt === musicAttempt) { musicPending = false; musicFailed = true; } });
    }
    function preloadVictory() {
      if (!victoryLoading) victoryLoading = env.fetch(path('Soundtrack', victoryTrack))
        .then(response => { if (!response.ok) throw new Error('Victory music unavailable'); return response.arrayBuffer(); })
        .then(bytes => ctx.decodeAudioData(bytes))
        .then(buffer => (victoryBuffer = buffer))
        .catch(() => { victoryLoading = null; return null; });
      return victoryLoading;
    }
    function syncMusic() {
      const shouldPlay = ctx && unlocked && !muted && ['playing','clear','victory'].includes(status) && musicBuffer && !musicFailed;
      if (!shouldPlay) { stopMusic(); return; }
      if (musicSource) return;
      if (musicTrack === victoryTrack && musicOffset >= musicBuffer.duration) return;
      playingMusic = true;
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setValueAtTime(musicTrack === victoryTrack ? musicLevel : 0, ctx.currentTime);
      if (musicTrack !== victoryTrack) musicGain.gain.linearRampToValueAtTime(musicLevel, ctx.currentTime + .6);
      musicSource = ctx.createBufferSource(); musicSource.buffer = musicBuffer;
      musicSource.loop = musicTrack !== victoryTrack; musicSource.connect(musicGain);
      const source = musicSource;
      if (!source.loop) source.onended = () => {
        if (musicSource !== source) return;
        musicOffset = musicBuffer.duration; playingMusic = false;
        source.disconnect(); musicSource = null;
      };
      musicStartedAt = ctx.currentTime;
      musicSource.start(0, musicOffset % musicBuffer.duration);
    }
    function update(state, events = []) {
      const changed = stage !== state.stage;
      const restart = events.some(event => event.type === 'stage');
      if(restart&&state.stage===0&&state.tick===0){heardAllies.clear();lastAllyDialogue=null;}
      const cleared = state.status === 'clear' && (status !== 'clear' || changed);
      if (status !== state.status || changed || restart) {
        if (state.status !== 'playing' || changed || restart) interrupt();
      }
      status = state.status; stage = state.stage;
      if (changed || restart || cleared) selectTrack();
      if (status === 'ready') { musicAttempt++; musicPending = false; stopMusic(true); }
      syncMusic();
      if(status==='boss-defeat'){
        const defeat=state.bossDefeat,sample=buffers.get('bossExplosion');
        if(!bossSource&&!muted&&unlocked&&ctx&&sample&&defeat&&defeat.elapsed<defeat.duration){
          const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=sample.buffer;
          // Keep the full recording (including its decay), aligned to the visual clock.
          const rate=sample.buffer.duration/defeat.duration;
          if(source.playbackRate)source.playbackRate.value=rate;
          gain.gain.value=sampleLevel('bossExplosion');addVoice(source,gain,'bossExplosion');
          bossSource=source;source.start(0,defeat.elapsed*rate);
          lastCue='bossExplosion';lastSample='bossExplosion';
        }
        return;
      }
      const heard = new Set();
      const nuke = events.some(event => event.type === 'nuke');
      for (const event of events) {
        if(event.type==='companionJoined'){allyLine(event.ally);continue;}
        if (event.type === 'clear' && victoryBuffer) continue;
        if (nuke && event.type === 'explosion' && event.kind !== 'boss') continue;
        const cue = cueFor(event);
        // One cue per type per frame keeps co-op salvos and mass explosions balanced.
        if (!cue || heard.has(cue)) continue;
        heard.add(cue); play(cue);
      }
      if (cleared) victoryLine();
    }
    function unlock() {
      unlocked = true; ensure();
      if (ctx && ['playing','clear','victory'].includes(status) && !musicBuffer && !musicPending) selectTrack();
      syncMusic(); return Promise.all([loading, musicLoading]);
    }
    function toggle() {
      muted = !muted;
      try { env.localStorage?.setItem('gameslop:muted', muted ? '1' : '0'); } catch (_) { /* Private mode. */ }
      if (master) master.gain.value = muted ? 0 : .8;
      if (muted) { interrupt(); syncMusic(); } else unlock();
      return muted;
    }
    return {update, unlock, toggle, interrupt, get muted() { return muted; },
      inspect: () => ({stage, status, muted, unlocked, context:ctx?.state || 'locked', track:musicTrack || tracks[stage] || null,
        musicPlaying:playingMusic, musicTime:musicPosition(), musicFailed, musicPending,
        loaded:[...buffers.keys()], failed:[...failures], voices:voices.length, lastCue, lastSample, lastDialogue, lastAllyDialogue})};
  }
  const api = {createAudio, audioTracks:tracks, victoryTrack, audioSamples:samples, audioCueFor:cueFor, victoryDialogue, allyDialogue};
  root.SlopCommando = Object.assign(root.SlopCommando || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
