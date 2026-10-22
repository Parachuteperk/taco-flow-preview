// Text-comment limiter: dedupe, cooldown, concurrent caps. Emoji thought bubbles stay elsewhere.
// Deterministic: advances only via step(dt) / setClock — no Math.random, no wall clock.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.SpeechGate = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var G = {
    COOLDOWN: 7,
    DEDUPE: 20,
    PHONE_MAX: 1,
    DESKTOP_MAX: 2,
    PHONE_VW: 480,
    clock: 0,
    lastAt: -1e9,
    active: [],
    recent: [],
    queue: [],
    vw: 390
  };

  function now() { return G.clock; }

  function maxSlots(vw) {
    if (vw == null) vw = G.vw;
    return vw > G.PHONE_VW ? G.DESKTOP_MAX : G.PHONE_MAX;
  }

  function prune() {
    var t = now();
    G.active = G.active.filter(function (a) { return a.until > t; });
    G.recent = G.recent.filter(function (r) { return r.until > t; });
  }

  function onScreen(text) {
    return G.active.some(function (a) { return a.text === text; });
  }

  function recently(text) {
    return G.recent.some(function (r) { return r.text === text; });
  }

  function cooldownOk() {
    return (now() - G.lastAt) >= G.COOLDOWN;
  }

  function canShow() {
    return G.active.length < maxSlots() && cooldownOk();
  }

  function extend(text, secs) {
    var until = now() + Math.max(0.5, secs || 3.5);
    for (var i = 0; i < G.active.length; i++) {
      if (G.active[i].text === text) {
        G.active[i].until = Math.max(G.active[i].until, until);
        return true;
      }
    }
    return false;
  }

  function activate(text, secs, critical) {
    var until = now() + Math.max(0.5, secs || 3.5);
    G.active.push({ text: text, until: until, critical: !!critical });
    if (!recently(text)) G.recent.push({ text: text, until: now() + G.DEDUPE });
    G.lastAt = now();
  }

  function bumpAmbient() {
    for (var i = 0; i < G.active.length; i++) {
      if (!G.active[i].critical) {
        G.active.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  function enqueue(text, secs) {
    if (!G.queue.some(function (q) { return q.text === text; })) {
      G.queue.push({ text: text, secs: secs });
    }
  }

  function promote() {
    while (G.queue.length && G.active.length < maxSlots() && cooldownOk()) {
      var next = G.queue.shift();
      if (onScreen(next.text)) continue;
      activate(next.text, next.secs, true);
    }
  }

  G.setViewport = function (vw) { if (typeof vw === 'number' && vw > 0) G.vw = vw; };
  G.setClock = function (t) { G.clock = t; };
  G.reset = function () {
    G.clock = 0; G.lastAt = -1e9; G.active = []; G.recent = []; G.queue = [];
  };
  G.resetLevel = function () { G.reset(); };
  G.maxSlots = maxSlots;
  G.now = now;
  G.onScreen = function (text) { prune(); return onScreen(String(text || '')); };
  G.queued = function () { return G.queue.map(function (q) { return q.text; }); };
  G.live = function () { prune(); return G.active.map(function (a) { return a.text; }); };

  G.allows = function (text) {
    prune();
    text = String(text || '');
    if (!text) return false;
    return onScreen(text);
  };

  // Start or queue a text comment. Returns 'live' | 'queued' | 'rejected'.
  G.begin = function (text, opts) {
    opts = opts || {};
    text = String(text || '');
    if (!text) return 'rejected';
    prune();
    promote();
    var critical = !!opts.critical;
    var secs = opts.secs != null ? opts.secs : 3.5;

    if (onScreen(text)) {
      extend(text, secs);
      return 'live';
    }

    // Same line again within the dedupe window (ambient or critical): skip.
    if (recently(text)) return 'rejected';

    if (canShow()) {
      activate(text, secs, critical);
      return 'live';
    }

    if (critical) {
      // Named cast / story beats preempt ambient chatter without waiting out its cooldown.
      if (G.active.length >= maxSlots() && bumpAmbient() && G.active.length < maxSlots()) {
        activate(text, secs, true);
        return 'live';
      }
      enqueue(text, secs);
      return 'queued';
    }
    return 'rejected';
  };

  G.step = function (dt) {
    if (!(dt > 0)) return;
    G.clock += dt;
    prune();
    promote();
  };

  G.install = function (TF) {
    if (!TF || G._installed) return G;
    G._installed = true;
    TF.SpeechGate = G;
    TF.plugins.push({
      step: function (dt) {
        if (TF.Render && TF.Render.vw) G.setViewport(TF.Render.vw);
        G.step(dt);
      },
      resetLevel: function () { G.reset(); }
    });
    if (TF.Week && typeof TF.Week.resetForLevel === 'function' && !G._wrapReset) {
      G._wrapReset = true;
      var prev = TF.Week.resetForLevel;
      TF.Week.resetForLevel = function () {
        var r = prev.apply(this, arguments);
        G.reset();
        return r;
      };
    }
    return G;
  };

  return G;
}));
