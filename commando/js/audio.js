/* Stream one stage soundtrack; decode and reuse the short user-supplied effects. */
(function (root) {
  'use strict';
  const tracks = ['Jungle.mp3', 'Bunker.mp3', 'Foundry.mp3', 'Reactor.mp3', 'Snow.mp3', 'Foundry.mp3', 'Cave.mp3', 'Alien.mp3'];
  const samples = {
    'shot:M':'Machine Gun.mp3', 'shot:S':'Spread Gun.mp3', 'shot:L':'Laser Rifle.mp3',
    'shot:F':'Flame Thrower.mp3', 'shot:G':'Grenade Launcher.mp3',
    'shot:H':'Rocket Launcher.mp3', 'shot:W':'Wave Cannon.mp3',
    'impact:G':'Grenade Explosion.mp3', 'impact:H':'Rocket Explosion.mp3',
    barrier:'Barrier.mp3', bossExplosion:'Boss Explosion.mp3'
  };
  // Keep distinct synthesized cues for actions without a supplied recording.
  const recipes = {
    shot:[[180,.045,'square',.018,0,70]],
    'shot:T':[[850,.09,'sawtooth',.025,0,110],[1400,.06,'square',.012,.03,250]],
    'shot:I':[[1400,.14,'triangle',.04,0,400]],
    'shot:A':[[95,.22,'sawtooth',.04,0,32]],
    jump:[[160,.11,'square',.025,0,480]],
    explosion:[[75,.17,'sawtooth',.05,0,25],[130,.12,'triangle',.035,0,30]],
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
    let ctx, master, musicGain, effectsGain, music, unlocked = false, muted = false;
    let stage = -1, status = 'ready', playingMusic = false, loading = Promise.resolve();
    let musicFailed = false, lastCue = null, lastSample = null, musicAttempt = 0;
    try { muted = env.localStorage?.getItem('gameslop:muted') === '1'; } catch (_) { /* Private mode. */ }
    const path = (folder, file) => folder + '/' + encodeURIComponent(file);
    function stopVoice(voice) {
      const index = voices.indexOf(voice); if (index < 0) return;
      voices.splice(index, 1); voice.source.onended = null;
      try { voice.source.stop(); } catch (_) { /* Already ended. */ }
      voice.source.disconnect(); voice.gain.disconnect();
    }
    function stopEffects() { [...voices].forEach(stopVoice); }
    function ensure() {
      if (!unlocked) return;
      if (!ctx) {
        const AC = env.AudioContext || env.webkitAudioContext;
        if (!AC) return;
        try {
          ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .8;
          const compressor = ctx.createDynamicsCompressor();
          master.connect(compressor); compressor.connect(ctx.destination);
          musicGain = ctx.createGain(); musicGain.gain.value = .32; musicGain.connect(master);
          effectsGain = ctx.createGain(); effectsGain.gain.value = .8; effectsGain.connect(master);
          music = new env.Audio(); music.preload = 'none'; music.loop = true;
          music.setAttribute('playsinline', '');
          ctx.createMediaElementSource(music).connect(musicGain);
          music.addEventListener('error', () => { musicFailed = true; playingMusic = false; });
          loading = Promise.all(Object.keys(samples).map(loadSample));
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
      if (same.length >= 3) stopVoice(same[0]);
      while (voices.length >= 24) stopVoice(voices[0]);
      const voice = {source, gain, cue}; voices.push(voice);
      source.onended = () => stopVoice(voice);
      source.connect(gain); gain.connect(effectsGain);
    }
    function synth(cue) {
      const fallback = cue.startsWith('shot:') ? 'shot' : cue.startsWith('impact:') || cue === 'bossExplosion' ? 'explosion' : cue === 'barrier' ? 'pickup' : cue;
      for (const [freq, duration, type, volume, delay = 0, slide] of recipes[cue] || recipes[fallback] || []) {
        const source = ctx.createOscillator(), gain = ctx.createGain(), time = ctx.currentTime + delay;
        source.type = type; source.frequency.setValueAtTime(freq, time);
        if (slide) source.frequency.exponentialRampToValueAtTime(slide, time + duration);
        gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
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
      gain.gain.value = cue.startsWith('shot:') ? .55 : .8;
      addVoice(source, gain, cue); source.start(0, sample.offset, sample.duration);
    }
    function selectTrack(force = false) {
      if (!music) return;
      const file = tracks[stage], desired = file ? path('Soundtrack', file) : '';
      if (!force && music.getAttribute('src') === desired) return;
      musicAttempt++; music.pause(); playingMusic = false; musicFailed = false;
      if (desired) music.setAttribute('src', desired);
      else music.removeAttribute('src');
      music.load();
    }
    function syncMusic() {
      if (!music) return;
      const shouldPlay = unlocked && !muted && status === 'playing' && !!tracks[stage] && !musicFailed;
      if (!shouldPlay) { if (playingMusic) musicAttempt++; music.pause(); playingMusic = false; return; }
      if (playingMusic) return;
      playingMusic = true;
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setValueAtTime(0, ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(.32, ctx.currentTime + .6);
      // Rejections are retried on the next user gesture, never every animation frame.
      const attempt = ++musicAttempt;
      Promise.resolve(music.play()).catch(() => { if (attempt === musicAttempt) { musicFailed = true; playingMusic = false; } });
    }
    function update(state, events = []) {
      const changed = stage !== state.stage;
      const restart = events.some(event => event.type === 'stage');
      if (status !== state.status || changed || restart) {
        if (state.status !== 'playing' || changed || restart) stopEffects();
      }
      status = state.status; stage = state.stage;
      if (changed || restart) selectTrack(true);
      if (status === 'ready' && music?.getAttribute('src')) { music.pause(); music.removeAttribute('src'); music.load(); playingMusic = false; }
      syncMusic();
      const heard = new Set();
      const nuke = events.some(event => event.type === 'nuke');
      for (const event of events) {
        if (nuke && event.type === 'explosion' && event.kind !== 'boss') continue;
        const cue = cueFor(event);
        // One cue per type per frame keeps co-op salvos and mass explosions balanced.
        if (!cue || heard.has(cue)) continue;
        heard.add(cue); play(cue);
      }
    }
    function unlock() {
      unlocked = true; ensure(); musicFailed = false;
      if (music && status === 'playing' && !music.getAttribute('src')) selectTrack();
      syncMusic(); return loading;
    }
    function toggle() {
      muted = !muted;
      try { env.localStorage?.setItem('gameslop:muted', muted ? '1' : '0'); } catch (_) { /* Private mode. */ }
      if (master) master.gain.value = muted ? 0 : .8;
      if (muted) { stopEffects(); syncMusic(); } else unlock();
      return muted;
    }
    return {update, unlock, toggle, get muted() { return muted; },
      inspect: () => ({stage, status, muted, unlocked, context:ctx?.state || 'locked', track:tracks[stage] || null,
        musicPlaying:!!music && !music.paused, musicTime:music?.currentTime || 0, musicFailed,
        loaded:[...buffers.keys()], failed:[...failures], voices:voices.length, lastCue, lastSample})};
  }
  const api = {createAudio, audioTracks:tracks, audioSamples:samples, audioCueFor:cueFor};
  root.SlopCommando = Object.assign(root.SlopCommando || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
