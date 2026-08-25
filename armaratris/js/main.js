/* Boot + game loop. Fixed 60 Hz timestep so seed + inputLog reproduces a game. */
(function (global) {
  "use strict";
  const A = global.Armaratris;
  const STEP = 1000 / 60;
  const MAX_STEPS_PER_FRAME = 8;

  function $(id) { return document.getElementById(id); }

  function parseSeed(v) {
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? (n >>> 0) : (parseInt(A.fnv1a(String(v)), 16) >>> 0);
  }

  function bestKey(skin) { return "armaratris:" + skin + ":best"; }
  function readBest(skin) { try { return Number(localStorage.getItem(bestKey(skin))) || 0; } catch (e) { return 0; } }
  function writeBest(skin, v) { try { localStorage.setItem(bestKey(skin), String(v)); } catch (e) { /* ignore */ } }

  async function boot() {
    const params = new URLSearchParams(location.search);
    const skin = await A.loadSkin(params.get("skin"));
    const engine = A.createEngine({ seed: parseSeed(params.get("seed")) });
    if (params.get("debug") === "1") global.__armaratris = { engine: engine };
    const audio = A.createAudio();
    // Looping background music from the skin (optional). Started on the first play gesture,
    // follows the mute toggle, pauses while the tab is hidden.
    const music = skin.music ? new Audio(skin.base + skin.music) : null;
    let musicStarted = false;
    if (music) { music.loop = true; music.preload = "auto"; music.volume = skin.musicVolume == null ? 0.35 : skin.musicVolume; }
    function musicPlay() { if (music && !audio.muted) { musicStarted = true; music.play().catch(function () { /* autoplay blocked until a gesture */ }); } }
    function musicPause() { if (music) music.pause(); }
    const wrap = $("wellwrap");
    const renderer = A.createRenderer({ skin: skin, wellCanvas: $("well"), holdCanvas: $("hold"), nextCanvas: $("next"), wrapEl: wrap });
    renderer.paintGround();

    const ui = { score: $("score"), level: $("level"), lines: $("lines"), best: $("best"), overlay: $("overlay"), oTitle: $("overlayTitle"), oBody: $("overlayBody"), oBtn: $("overlayBtn"), mute: $("mute") };
    let best = readBest(skin.name);
    ui.best.textContent = best;
    ui.mute.setAttribute("aria-pressed", String(audio.muted));

    function showOverlay(title, body, btn) {
      ui.oTitle.textContent = title; ui.oBody.textContent = body;
      ui.oBtn.textContent = btn || ""; ui.oBtn.hidden = !btn;
      ui.overlay.hidden = false;
    }
    function hideOverlay() { ui.overlay.hidden = true; }

    function refreshStats() {
      ui.score.textContent = engine.state.score;
      ui.level.textContent = engine.state.level;
      ui.lines.textContent = engine.state.lines;
    }

    function handleEvents(events) {
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        switch (ev.type) {
          case "move": audio.play("move"); break;
          case "rotate": audio.play("rotate"); break;
          case "hold": audio.play("hold"); break;
          case "lock": audio.play("lock"); break;
          case "clear":
            audio.play(ev.lines === 4 ? "tetris" : "clear");
            renderer.flash(ev.rows, ev.board);
            break;
          case "gameover": onGameOver(); break;
          default: break;
        }
      }
      if (events.length) { refreshStats(); renderer.drawHold(engine.state.hold); renderer.drawNext(engine.state.queue); }
    }

    function onGameOver() {
      const s = engine.state;
      if (s.score > best) { best = s.score; writeBest(skin.name, best); ui.best.textContent = best; }
      audio.play("gameover");
      showOverlay(skin.strings.gameOver, skin.strings.score + " " + s.score + "\n" + skin.strings.best + " " + best, skin.strings.restart);
      if (global.parent !== global) {
        global.parent.postMessage({ v: 1, type: "gameover", game: "armaratris", skin: skin.name, score: s.score, lines: s.lines, level: s.level, seed: s.seed, inputsHash: engine.hash() }, "*");
      }
    }

    function start() {
      const st = engine.state.status;
      if (st === "ready") { audio.unlock(); musicPlay(); handleEvents(engine.dispatch("start")); hideOverlay(); }
      else if (st === "over") { engine.reset(parseSeed(params.get("seed"))); refreshStats(); renderer.drawHold(null); renderer.drawNext(engine.state.queue); handleEvents(engine.dispatch("start")); hideOverlay(); }
      else if (st === "paused") { engine.dispatch("resume"); hideOverlay(); }
    }
    function pause() {
      if (engine.state.status === "playing") { engine.dispatch("pause"); showOverlay(skin.strings.paused, "", skin.strings.resume); }
      else if (engine.state.status === "paused") start();
    }
    function toggleMute() {
      const m = audio.toggle(); ui.mute.setAttribute("aria-pressed", String(m));
      if (m) musicPause(); else if (musicStarted) musicPlay();
    }

    const input = A.createInput({
      wellEl: wrap, touchEl: $("touch"), cellSize: function () { return renderer.cell; },
      onAction: function (action) {
        if (engine.state.status === "ready") { if (action !== "softDropOn" && action !== "softDropOff") start(); return; }
        if (engine.state.status !== "playing") return;
        handleEvents(engine.dispatch(action));
      },
      onSystem: function (name) {
        if (name === "start") start();
        else if (name === "pause") pause();
        else if (name === "mute") toggleMute();
      },
    });

    ui.oBtn.addEventListener("click", function () { start(); });
    ui.overlay.addEventListener("pointerdown", function (e) { e.stopPropagation(); if (e.target !== ui.oBtn) start(); });
    ui.mute.addEventListener("click", toggleMute);
    global.addEventListener("resize", function () { renderer.resize(); renderer.drawHold(engine.state.hold); renderer.drawNext(engine.state.queue); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { if (engine.state.status === "playing") pause(); musicPause(); }
      else if (musicStarted) musicPlay();
    });

    // initial paint
    refreshStats();
    renderer.drawHold(null);
    renderer.drawNext(engine.state.queue);
    showOverlay(skin.title, skin.strings.start, "");

    let last = performance.now(), acc = 0;
    function frame(now) {
      let dt = now - last; last = now;
      if (dt > 250) dt = 250;
      acc += dt;
      input.update(dt);
      let steps = 0;
      while (acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
        handleEvents(engine.tick(STEP));
        acc -= STEP; steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) acc = 0;
      // Soft-drop points accrue silently inside tick() (it only emits events on lock/clear/etc.),
      // so the score readout would otherwise freeze mid-hold until the next discrete event. Keep
      // it live while playing; cheap (three short strings) compared to the draw call below.
      if (engine.state.status === "playing") refreshStats();
      renderer.draw(engine.state, engine.state.active && engine.state.status === "playing" ? engine.ghostY() : undefined);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    document.body.dataset.ready = "1";
  }

  global.addEventListener("DOMContentLoaded", function () {
    boot().catch(function (err) {
      console.error(err);
      const o = document.getElementById("overlayTitle"); if (o) o.textContent = "FAILED TO LOAD";
      const b = document.getElementById("overlayBody"); if (b) b.textContent = String(err && err.message || err);
    });
  });
})(window);
