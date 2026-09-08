/**
 * Game Slop SDK: the only thing a game needs to talk to the platform.
 *
 * A game never sees a wallet, a cookie, or an API key. It posts messages to the
 * host page, and the host does the privileged work. That keeps the trust boundary
 * at the frame edge, so an embedded game can never impersonate a player.
 *
 *   await GameSlop.ready();                  // cached automatic load-ready handshake
 *   const run = await GameSlop.startRun();   // server-issued play session
 *   ...play...
 *   await GameSlop.submit(score);            // final score, once per run
 *   await GameSlop.submit(score, result);    // optional display-only result signal
 *
 * Usage: <script src="/games/sdk.js"></script>
 *
 * Versioned protocol (see src/lib/game-protocol.ts for the shared,
 * unit-tested schema this mirrors): every outgoing message carries BOTH the
 * legacy `type` field (`ready`/`start`/`tick`/`submit`, which is what the current,
 * unmodified host reads today) AND a versioned `event` field
 * (`game:ready`/`game:start`/`game:score`/`game:complete`), plus
 * `protocolVersion`, `slug`, a monotonic `seq`, and `timestamp`. This is
 * additive: nothing here changes what the four call sites above look like,
 * or what today's host understands.
 *
 * New, optional, and safe even if the host never sends them:
 *   GameSlop.onPause(cb) / onResume(cb) / onRestart(cb): host -> game
 *   GameSlop.reportError(message): game -> host, `game:error`
 *
 * Active runs also pause locally after eight seconds without trusted player
 * input. The next trusted pointer or keyboard action resumes the same run.
 * This keeps unattended carts from advancing timers or completing by timeout.
 *
 * The SDK also emits the versioned-only `game:first_input` event once on the
 * first trusted pointerdown or non-modifier keydown. It intentionally carries
 * no key, pointer, coordinate, target, text, or other player data.
 */
(function () {
  'use strict';

  var HOST = 'gameslop-host';
  var GAME = 'gameslop-game';
  var PROTOCOL_VERSION = 1;
  var pending = {};
  var seq = 0;
  var requestedHost = new URLSearchParams(window.location.search).get('hostOrigin');
  var HOST_ORIGIN;
  try {
    HOST_ORIGIN = requestedHost ? new URL(requestedHost).origin : window.location.origin;
    if (!/^https?:\/\//.test(HOST_ORIGIN)) throw new Error('Unsupported host origin.');
  } catch (_) {
    HOST_ORIGIN = window.location.origin;
  }

  // Every entry path is /games/<slug>/..., in both same-origin and isolated
  // (dedicated content-host) modes. See gameContentUrl() in src/lib/game-origin.ts.
  // Deriving the slug from the path avoids needing a second query parameter.
  var SLUG = (function () {
    var m = /\/games\/([a-z0-9-]+)\//.exec(window.location.pathname);
    return m ? m[1] : 'unknown';
  })();

  var LEGACY_TO_EVENT = { ready: 'game:ready', start: 'game:start', tick: 'game:score', submit: 'game:complete' };
  var PLATFORM_EVENTS = { 'platform:pause': 1, 'platform:resume': 1, 'platform:restart': 1 };

  function envelope(type, data) {
    return Object.assign(
      {
        source: GAME,
        type: type,
        event: LEGACY_TO_EVENT[type],
        protocolVersion: PROTOCOL_VERSION,
        slug: SLUG,
        seq: ++seq,
        timestamp: Date.now(),
      },
      data || {},
    );
  }

  function eventEnvelope(event) {
    return {
      source: GAME,
      event: event,
      protocolVersion: PROTOCOL_VERSION,
      slug: SLUG,
      seq: ++seq,
      timestamp: Date.now(),
    };
  }

  function normalizeResult(result) {
    if (result === undefined) return undefined;
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('Result must be an object.');
    }
    var keys = Object.keys(result);
    if (keys.length !== 2 || keys.indexOf('outcome') === -1 || keys.indexOf('reason') === -1) {
      throw new Error('Result must contain only outcome and reason.');
    }
    if (result.outcome !== 'victory' && result.outcome !== 'defeat') {
      throw new Error('Result outcome must be victory or defeat.');
    }
    if (
      typeof result.reason !== 'string' ||
      result.reason.length < 1 ||
      result.reason.length > 32 ||
      !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(result.reason)
    ) {
      throw new Error('Result reason must be a short machine-readable key.');
    }
    return { outcome: result.outcome, reason: result.reason };
  }

  function post(type, data) {
    var id = ++seq;
    window.parent.postMessage(Object.assign(envelope(type, data), { id: id }), HOST_ORIGIN);
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      setTimeout(function () {
        if (pending[id]) {
          delete pending[id];
          reject(new Error('Host did not answer "' + type + '" in time.'));
        }
      }, 10000);
    });
  }

  // A frame can receive input before or after its load-ready handshake. Only
  // browser-trusted input counts, modifier-only/repeated keydowns do not, and
  // the emitted envelope contains no details about the interaction itself.
  var firstInputSent = false;
  var IGNORED_FIRST_KEYS = {
    Alt: 1,
    AltGraph: 1,
    CapsLock: 1,
    Control: 1,
    Meta: 1,
    NumLock: 1,
    ScrollLock: 1,
    Shift: 1,
    Unidentified: 1,
  };

  function isRelevantKeydown(event) {
    return !event.repeat && !event.isComposing && !IGNORED_FIRST_KEYS[event.key];
  }

  function removeFirstInputListeners() {
    window.removeEventListener('pointerdown', onFirstInput, true);
    window.removeEventListener('keydown', onFirstInput, true);
  }

  function onFirstInput(event) {
    if (firstInputSent || event.isTrusted !== true) return;
    if (event.type === 'keydown' && !isRelevantKeydown(event)) return;
    firstInputSent = true;
    removeFirstInputListeners();
    window.parent.postMessage(eventEnvelope('game:first_input'), HOST_ORIGIN);
  }

  window.addEventListener('pointerdown', onFirstInput, { capture: true, passive: true });
  window.addEventListener('keydown', onFirstInput, { capture: true });

  var lastPlatformSeq = -1;
  var handlers = { pause: null, resume: null, restart: null };
  var IDLE_TIMEOUT_MS = 8000;
  var runActive = false;
  var idleTimer = null;
  var idlePaused = false;
  var platformPaused = false;
  var effectivePaused = false;

  function notifyPauseState() {
    var nextPaused = platformPaused || idlePaused;
    if (nextPaused === effectivePaused) return;
    effectivePaused = nextPaused;
    var handler = nextPaused ? handlers.pause : handlers.resume;
    if (typeof handler === 'function') {
      try { handler(); } catch (_) { /* a game's callback throwing must not break the SDK */ }
    }
  }

  function setPauseSource(source, paused) {
    if (source === 'platform') platformPaused = paused;
    else idlePaused = paused;
    notifyPauseState();
  }

  function clearIdleTimer() {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = null;
  }

  function armIdleTimer() {
    clearIdleTimer();
    if (!runActive || idlePaused) return;
    idleTimer = setTimeout(function () {
      idleTimer = null;
      if (runActive) setPauseSource('idle', true);
    }, IDLE_TIMEOUT_MS);
  }

  function noteTrustedActivity(event) {
    if (event.isTrusted !== true) return;
    if (event.type === 'keydown' && !isRelevantKeydown(event)) return;
    if (!runActive) return;
    setPauseSource('idle', false);
    armIdleTimer();
  }

  function beginIdleGuard() {
    runActive = true;
    setPauseSource('idle', false);
    armIdleTimer();
  }

  function endIdleGuard() {
    runActive = false;
    clearIdleTimer();
    setPauseSource('idle', false);
  }

  window.addEventListener('pointerdown', noteTrustedActivity, { capture: true, passive: true });
  window.addEventListener('pointermove', noteTrustedActivity, { capture: true, passive: true });
  window.addEventListener('keydown', noteTrustedActivity, { capture: true });

  window.addEventListener('message', function (event) {
    if (event.origin !== HOST_ORIGIN || event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || msg.source !== HOST) return;

    // One-way, unprompted host -> game messages (no `id` to correlate to a
    // pending request). Validated inline: known event name, monotonically
    // increasing seq (rejects duplicates/replays/out-of-order; see
    // evaluateSequencedMessage in src/lib/game-protocol.ts for the same
    // logic, unit-tested there since this file can't import a TS module).
    if (typeof msg.event === 'string' && PLATFORM_EVENTS[msg.event]) {
      if (typeof msg.seq !== 'number' || msg.seq <= lastPlatformSeq) return;
      lastPlatformSeq = msg.seq;
      var key = msg.event.slice('platform:'.length);
      if (key === 'pause') setPauseSource('platform', true);
      else if (key === 'resume') setPauseSource('platform', false);
      else if (typeof handlers.restart === 'function') {
        try { handlers.restart(); } catch (_) { /* a game's callback throwing must not break the SDK */ }
      }
      return;
    }

    // Request/response: the host's answer to something this game asked.
    if (msg.id === undefined) return;
    var slot = pending[msg.id];
    if (!slot) return;
    delete pending[msg.id];
    if (msg.error) slot.reject(new Error(msg.error));
    else slot.resolve(msg.payload);
  });

  var currentRun = null;
  var readyPromise = null;

  function ready() {
    // One document sends exactly one ready request. Games that historically
    // called ready() before every run keep working by receiving this same
    // promise, without moving the load-ready timestamp to the first click.
    if (!readyPromise) {
      if (document.readyState === 'complete') {
        readyPromise = post('ready');
      } else {
        readyPromise = new Promise(function (resolve, reject) {
          window.addEventListener('load', function () {
            post('ready').then(resolve, reject);
          }, { once: true });
        });
      }
    }
    return readyPromise;
  }

  window.GameSlop = {
    /** Return the document's cached load-ready handshake promise. */
    ready: ready,

    /**
     * Ask the host to open a scoring run. Resolves with { runId, recordable }.
     * `recordable` is false for signed-out players, so let them play anyway.
     */
    startRun: function () {
      return post('start').then(function (run) {
        currentRun = run;
        beginIdleGuard();
        return run;
      });
    },

    /**
     * Submit the final score for the open run. One submission per run.
     * Optional result metadata is a strict display hint, never scoring authority.
     */
    submit: function (score, result) {
      if (!currentRun) return Promise.reject(new Error('No open run. Call startRun() first.'));
      var normalizedResult;
      try {
        normalizedResult = normalizeResult(result);
      } catch (error) {
        return Promise.reject(error);
      }
      var runId = currentRun.runId;
      currentRun = null;
      endIdleGuard();
      var payload = { runId: runId, score: Math.max(0, Math.floor(score)) };
      if (normalizedResult) payload.result = normalizedResult;
      return post('submit', payload);
    },

    /** Optional: live score, so the host chrome can mirror it outside the frame. */
    tick: function (score) {
      window.parent.postMessage(envelope('tick', { score: Math.max(0, Math.floor(score)) }), HOST_ORIGIN);
    },

    /**
     * Optional: tell the host something went wrong (e.g. a WebGL context
     * loss, an asset failing to load). This is fire-and-forget; the host may not
     * do anything with this yet; it costs the game nothing to send it.
     */
    reportError: function (message) {
      // 'error' has no legacy type an unmodified host recognizes (only
      // ready/start/tick/submit map to one). That's intentional: an
      // unmodified host's if/else-if chain simply won't match `type:
      // 'error'` and silently ignores it, which is the desired safe no-op
      // until the host is updated to act on game:error.
      var msg = envelope('error', { message: String(message).slice(0, 500) });
      msg.event = 'game:error';
      window.parent.postMessage(msg, HOST_ORIGIN);
    },

    /**
     * Optional host -> game hooks. Today's host never sends these; they
     * exist so a game CAN respond to being paused/resumed/asked to restart
     * once the host is updated to send them, without needing an SDK change
     * at that point. Safe no-ops until then.
     */
    onPause: function (cb) {
      handlers.pause = cb;
      if (effectivePaused && typeof cb === 'function') {
        try { cb(); } catch (_) { /* a game's callback throwing must not break the SDK */ }
      }
    },
    onResume: function (cb) { handlers.resume = cb; },
    onRestart: function (cb) { handlers.restart = cb; },
  };

  // Arm the handshake immediately, but do not post until actual window load.
  // Explicit GameSlop.ready() calls before/after that point reuse this promise.
  ready().catch(function () { /* A missing host is already surfaced to explicit callers. */ });
})();
