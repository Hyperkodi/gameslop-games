/* Shared boot + game loop. Fixed 60 Hz timestep so seed + inputLog reproduces a game.
   Generalized from games/armaratris/js/main.js: every game supplies a cfg (see spec §3.6) and
   calls GameSlopKit.createShell(cfg) on DOMContentLoaded.

   cfg shape (see spec §3.6 for the full picture):
   {
     game,                          // id used in localStorage keys and the bridge payload
     skinDir,                       // default "skin/"
     createEngine, createRenderer,
     sounds, events, onEvent, drawExtras, stats,
     endOverlay,                    // optional (state, skin) -> {title, body, button} for custom endings
     input: { keys, repeatKeys, gestures, buttons },
     startsOnAnyAction,             // any action (not listed in ignoreWhileReady) starts the game while "ready"
     ignoreWhileReady,              // array of action names to silently drop while "ready" instead of
                                     // starting the game (e.g. held-input actions like "softDropOn"/"leftOn"
                                     // that a stray touch/keyboard event could fire before the player's
                                     // first real move); default []
     forwardStartAction,            // boolean, default false. When the action that starts the game from
                                     // "ready" is also the game's primary action (flap/launch/fire), the
                                     // player's first press would otherwise only start the game and be
                                     // swallowed. If true, immediately re-dispatch that same action right
                                     // after start() so it also takes effect on the first press.
     // A renderer may optionally expose capturePrevious(state), pausesSimulation(), and
     // closePanel(), and may consume draw(state, extras, {alpha, stepMs, now}). These hooks are
     // presentation-only; engines retain the same fixed-step and input-log contracts.
   } */
(function (global) {
  "use strict";
  const K = global.GameSlopKit = global.GameSlopKit || {};
  const STEP = 1000 / 60;
  const MAX_STEPS_PER_FRAME = 8;

  function $(id) { return document.getElementById(id); }

  function bestKey(game, skin) { return "gameslop:" + game + ":" + skin + ":best"; }
  function readBest(game, skin) { try { return Number(localStorage.getItem(bestKey(game, skin))) || 0; } catch (e) { return 0; } }
  function writeBest(game, skin, v) { try { localStorage.setItem(bestKey(game, skin), String(v)); } catch (e) { /* ignore */ } }

  async function createShell(cfg) {
    const params = new URLSearchParams(location.search);
    const skin = await K.loadSkin(params.get("skin"), cfg.skinDir || "skin/");
    const engine = cfg.createEngine({ seed: K.parseSeed(params.get("seed")) });
    const audio = K.createAudio(cfg.sounds);
    // Looping background music from the skin (optional). Started on the first play gesture,
    // follows the mute toggle, pauses while the tab is hidden.
    const music = skin.music ? new Audio(skin.base + skin.music) : null;
    let musicStarted = false;
    if (music) { music.loop = true; music.preload = "auto"; music.volume = skin.musicVolume == null ? 0.35 : skin.musicVolume; }
    function musicPlay() { if (music && !audio.muted) { musicStarted = true; music.play().catch(function () { /* autoplay blocked until a gesture */ }); } }
    function musicPause() { if (music) music.pause(); }

    const wrap = $("wellwrap");
    const sideCanvases = {};
    const holdCanvas = $("hold"), nextCanvas = $("next");
    if (holdCanvas) sideCanvases.hold = holdCanvas;
    if (nextCanvas) sideCanvases.next = nextCanvas;
    const renderer = cfg.createRenderer({ skin: skin, wellCanvas: $("well"), wrapEl: wrap, sideCanvases: sideCanvases });
    K.paintGround(skin);

    if (params.get("debug") === "1") global.__gameslop = { engine: engine, renderer: renderer };

    const statEls = (cfg.stats || []).map(function (s) { return { id: s.id, key: s.key, get: s.get, el: $(s.id) }; });
    function statValue(s) { return s.get ? s.get(engine.state) : engine.state[s.key]; }
    function refreshStats() { statEls.forEach(function (s) { if (s.el) s.el.textContent = statValue(s); }); }
    function statsObject() {
      const out = {};
      statEls.forEach(function (s) { out[s.id] = statValue(s); });
      return out;
    }

    const ui = { best: $("best"), overlay: $("overlay"), oTitle: $("overlayTitle"), oBody: $("overlayBody"), oBtn: $("overlayBtn"), mute: $("mute") };
    let best = readBest(cfg.game, skin.name);
    if (ui.best) ui.best.textContent = best;
    if (ui.mute) ui.mute.setAttribute("aria-pressed", String(audio.muted));

    function showOverlay(title, body, btn) {
      if (ui.oTitle) ui.oTitle.textContent = title;
      if (ui.oBody) ui.oBody.textContent = body;
      if (ui.oBtn) { ui.oBtn.textContent = btn || ""; ui.oBtn.hidden = !btn; }
      if (ui.overlay) ui.overlay.hidden = false;
    }
    function hideOverlay() { if (ui.overlay) ui.overlay.hidden = true; }

    function onGameOver() {
      const s = engine.state;
      if (s.score > best) { best = s.score; writeBest(cfg.game, skin.name, best); if (ui.best) ui.best.textContent = best; }
      const fallbackOverlay = {
        title: skin.strings.gameOver,
        body: skin.strings.score + " " + s.score + "\n" + skin.strings.best + " " + best,
        button: skin.strings.restart,
      };
      const customOverlay = cfg.endOverlay ? cfg.endOverlay(s, skin) : null;
      const end = customOverlay || fallbackOverlay;
      showOverlay(
        end.title === undefined ? fallbackOverlay.title : end.title,
        end.body === undefined ? fallbackOverlay.body : end.body,
        end.button === undefined ? fallbackOverlay.button : end.button
      );
      if (global.parent !== global) {
        global.parent.postMessage({
          v: 1, type: "gameover", game: cfg.game, skin: skin.name, score: s.score, seed: s.seed,
          inputsHash: engine.hash(), stats: statsObject(),
        }, "*");
      }
    }

    function handleEvents(events) {
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (cfg.onEvent) cfg.onEvent(ev, { renderer: renderer, engine: engine, audio: audio });
        const soundName = cfg.events && cfg.events[ev.type];
        if (soundName) audio.play(soundName);
        if (ev.type === "gameover") onGameOver();
      }
      if (events.length) {
        refreshStats();
        if (renderer.side) renderer.side(engine.state);
      }
    }

    function start() {
      const st = engine.state.status;
      if (st === "ready") { audio.unlock(); musicPlay(); handleEvents(engine.dispatch("start")); hideOverlay(); }
      else if (st === "over") {
        engine.reset(K.parseSeed(params.get("seed")));
        refreshStats();
        if (renderer.side) renderer.side(engine.state);
        handleEvents(engine.dispatch("start"));
        hideOverlay();
      }
      else if (st === "paused") { engine.dispatch("resume"); hideOverlay(); }
    }
    function pause() {
      if (engine.state.status === "playing") { engine.dispatch("pause"); showOverlay(skin.strings.paused, "", skin.strings.resume); }
      else if (engine.state.status === "paused") start();
    }
    function toggleMute() {
      const m = audio.toggle();
      if (ui.mute) ui.mute.setAttribute("aria-pressed", String(m));
      if (m) musicPause(); else if (musicStarted) musicPlay();
    }

    const inputCfg = cfg.input || {};
    const input = K.createInput({
      wellEl: wrap, pointerEl: $("well"), touchEl: $("touch"), cellSize: function () { return renderer.cell; },
      keys: inputCfg.keys, repeatKeys: inputCfg.repeatKeys, gestures: inputCfg.gestures, buttons: inputCfg.buttons,
      onAction: function (action) {
        if (engine.state.status === "ready") {
          const ignored = (cfg.ignoreWhileReady || []).indexOf(action) !== -1;
          if (cfg.startsOnAnyAction && !ignored) {
            start();
            if (cfg.forwardStartAction) handleEvents(engine.dispatch(action));
          }
          return;
        }
        if (engine.state.status !== "playing") return;
        handleEvents(engine.dispatch(action));
      },
      onSystem: function (name) {
        if (name === "start") start();
        else if (name === "pause") {
          // Contextual game surfaces (for example a tower inspector) get first refusal on
          // Escape/P. Closing management resumes its presentation pause without changing the
          // engine's explicit playing/paused state or showing the standard pause overlay.
          if (!(renderer.closePanel && renderer.closePanel())) pause();
        }
        else if (name === "mute") toggleMute();
      },
    });

    if (ui.oBtn) ui.oBtn.addEventListener("click", function () { start(); });
    if (ui.overlay) ui.overlay.addEventListener("pointerdown", function (e) { e.stopPropagation(); if (e.target !== ui.oBtn) start(); });
    if (ui.mute) ui.mute.addEventListener("click", toggleMute);
    global.addEventListener("resize", function () { renderer.resize(); if (renderer.side) renderer.side(engine.state); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { if (engine.state.status === "playing") pause(); musicPause(); }
      else if (musicStarted) musicPlay();
    });

    // initial paint
    refreshStats();
    if (renderer.side) renderer.side(engine.state);
    showOverlay(skin.title, skin.strings.start, "");

    let last = performance.now(), acc = 0;
    function frame(now) {
      let dt = now - last; last = now;
      if (dt > 250) dt = 250;
      input.update(dt);
      const presentationPaused = !!(renderer.pausesSimulation && renderer.pausesSimulation());
      let steps = 0;
      if (presentationPaused) {
        // Do not bank combat time while a contextual management surface is open. Inputs and
        // rendering continue, so build/upgrade/sell actions remain immediately responsive.
        acc = 0;
      } else {
        acc += dt;
        while (acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
          if (renderer.capturePrevious) renderer.capturePrevious(engine.state);
          handleEvents(engine.tick(STEP));
          acc -= STEP; steps++;
        }
      }
      if (steps === MAX_STEPS_PER_FRAME) acc = 0;
      // Some engines accrue points silently inside tick() (e.g. Tetris soft-drop) without an
      // event on every frame, so the score readout would otherwise freeze mid-hold. Keep it
      // live while playing; cheap compared to the draw call below.
      if (engine.state.status === "playing") refreshStats();
      const extras = cfg.drawExtras ? cfg.drawExtras(engine) : undefined;
      renderer.draw(engine.state, extras, {
        alpha: presentationPaused ? 0 : Math.max(0, Math.min(1, acc / STEP)),
        stepMs: STEP,
        now: now,
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    document.body.dataset.ready = "1";
  }

  K.createShell = function (cfg) {
    createShell(cfg).catch(function (err) {
      console.error(err);
      const o = document.getElementById("overlayTitle"); if (o) o.textContent = "FAILED TO LOAD";
      const b = document.getElementById("overlayBody"); if (b) b.textContent = String(err && err.message || err);
    });
  };
})(typeof window !== "undefined" ? window : globalThis);
