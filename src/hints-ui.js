// Prep hints + tutorial tips from data/hints.js (Pass 6D).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      (function () { try { return require('../data/hints'); } catch (e) { return null; } })()
    );
  } else { root.TF = root.TF || {}; root.TF.HintsUI = factory(root.TF.HINTS); }
}(typeof window !== 'undefined' ? window : this, function (Hints) {
  'use strict';
  var H = { seen: {}, tipI: 0 };
  function data() {
    if (Hints && Hints.prep) return Hints;
    if (typeof TF !== 'undefined' && TF.HINTS) return TF.HINTS;
    return null;
  }
  H.prepHint = function (day, rng) {
    var d = data(); if (!d || !d.prep || !d.prep.length) return '';
    var i = typeof day === 'number' ? ((day - 1) % d.prep.length) : Math.floor((rng || Math.random()) * d.prep.length);
    return d.prep[i];
  };
  H.tutorial = function (id) {
    var d = data(); if (!d || !d.tutorial) return null;
    if (id) return d.tutorial.filter(function (t) { return t.id === id; })[0] || null;
    return d.tutorial.slice();
  };
  H.nextTutorial = function () {
    var d = data(); if (!d || !d.tutorial || !d.tutorial.length) return null;
    for (var i = 0; i < d.tutorial.length; i++) {
      var t = d.tutorial[i];
      if (!H.seen[t.id]) { H.seen[t.id] = true; return t; }
    }
    return null;
  };
  H.clearLevelDays = function (levelNo) {
    var n = levelNo || 1, lo = (n - 1) * 5 + 1, hi = n * 5;
    Object.keys(H.seen).forEach(function (key) {
      var m = /^prep:(\d+)$/.exec(key);
      if (m) {
        var day = +m[1];
        if (day >= lo && day <= hi) delete H.seen[key];
      }
    });
  };
  H.mountTip = function (host, tip) {
    if (!host || !host.ownerDocument || !tip) throw new TypeError('Host and tip required');
    var doc = host.ownerDocument, el = doc.createElement('div');
    el.id = 'hintTip';
    el.setAttribute('data-tip-id', tip.id || '');
    el.style.cssText = 'position:fixed;left:50%;bottom:max(64px,calc(env(safe-area-inset-bottom) + 56px));transform:translateX(-50%);z-index:8;max-width:min(360px,calc(100% - 24px));box-sizing:border-box;background:rgba(40,20,15,0.92);color:#fff5d6;padding:10px 12px;border-radius:8px;font:13px/1.35 system-ui;text-align:center;overflow-wrap:anywhere;word-break:break-word';
    el.textContent = tip.text || tip;
    host.appendChild(el);
    return { element: el, destroy: function () { el.remove(); } };
  };
  H.install = function (TF) {
    if (!TF || H._installed) return H;
    H._installed = true;
    // Surface the first unused tutorial tip via the existing #hint once Onboard places the stand.
    var last = '';
    H.step = function () {
      if (!(TF.Onboard && TF.ui && TF.ui.setHint)) return;
      if (TF.Onboard.opened || H.seen._boot) return;
      var tip = H.nextTutorial();
      if (tip && tip.text !== last) {
        last = tip.text;
        TF.ui.setHint(tip.text, 6);
        H.seen._boot = true;
      }
    };
    // PREP toast with a rotating prep hint.
    var prevOpen = TF.Week && TF.Week.refresh;
    if (TF.Week) {
      var hooked = false;
      function prepToast() {
        if (!(TF.Week.active && TF.Week.active()) || TF.Week.phase !== 'prep') return;
        var abs = TF.Econ && TF.Econ.abs ? TF.Econ.abs(TF.Week.day) : TF.Week.day;
        var key = 'prep:' + abs;
        if (H.seen[key]) return;
        H.seen[key] = true;
        var text = H.prepHint(abs);
        if (text && TF.Sim && TF.Sim.events) TF.Sim.events.push({ type: 'toast', text: text });
      }
      var tipTimer = setInterval(prepToast, 1000);
      if (tipTimer && typeof tipTimer.unref === 'function') tipTimer.unref();
      hooked = true;
    }
    TF.plugins.push(H);
    return H;
  };
  return H;
}));
