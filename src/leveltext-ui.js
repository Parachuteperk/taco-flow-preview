// LEVEL_START / FRIDAY / RETRY text (Pass 6D). Wraps LevelFlow.card and Week end/retry.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      (function () { try { return require('../data/level-text'); } catch (e) { return null; } })()
    );
  } else {
    root.TF = root.TF || {};
    root.TF.LevelTextUI = factory({ LEVEL_START: root.TF.LEVEL_START, FRIDAY: root.TF.FRIDAY, RETRY: root.TF.RETRY });
  }
}(typeof window !== 'undefined' ? window : this, function (Data) {
  'use strict';
  var LT = {};
  function data() {
    if (Data && Data.LEVEL_START) return Data;
    if (typeof TF !== 'undefined') return { LEVEL_START: TF.LEVEL_START, FRIDAY: TF.FRIDAY, RETRY: TF.RETRY };
    return null;
  }
  LT.levelStart = function (n) {
    var d = data(); if (!d || !d.LEVEL_START) return null;
    return d.LEVEL_START['L' + n] || null;
  };
  LT.friday = function (n, win) {
    var d = data(); if (!d || !d.FRIDAY) return [];
    var block = d.FRIDAY['L' + n]; if (!block) return [];
    return (win ? block.win : block.lose).slice();
  };
  LT.retryLine = function (i) {
    var d = data(); if (!d || !d.RETRY) return '';
    var list = d.RETRY;
    return list[((i % list.length) + list.length) % list.length];
  };
  LT.applyCard = function (card, n) {
    var L = LT.levelStart(n); if (!L || !card) return card;
    card.title = /Level\s*\d/i.test(L.title) ? L.title : ('Level ' + n + ' · ' + L.title);
    card.twist = L.twist;
    card.landlord = L.rentLine;
    return card;
  };
  LT.clearEndFlags = function () {
    var end = typeof document !== 'undefined' && document.getElementById('endCard');
    if (end && end.dataset) {
      delete end.dataset.levelText;
      delete end.dataset.galaWired;
      delete end.dataset.galaShown;
    }
  };
  LT.mountLevelStart = function (host, n, onStart) {
    if (!host || !TF.LevelStartUI) throw new Error('LevelStartUI required');
    var base = TF.LevelFlow && TF.LevelFlow.card ? TF.LevelFlow.card(n, {}) : {
      title: 'Level ' + n, mapSize: '', rent: '', landlord: '', twist: '', goal: 'Pay Friday rent.',
      newUnlocks: [], cast: [], carried: [], reset: '', startLabel: 'START'
    };
    LT.applyCard(base, n);
    var ui = TF.LevelStartUI.mount(host, base, onStart || function () {});
    if (ui && ui.element) ui.element.id = 'levelStart';
    return ui;
  };
  LT.install = function (TF) {
    if (!TF || LT._installed) return LT;
    LT._installed = true;
    if (TF.LevelFlow && typeof TF.LevelFlow.card === 'function') {
      var orig = TF.LevelFlow.card;
      TF.LevelFlow.card = function (n, options) {
        return LT.applyCard(orig.call(TF.LevelFlow, n, options), n);
      };
    }
    function patchEnding() {
      var end = typeof document !== 'undefined' && document.getElementById('endCard');
      if (!end || end.hidden) return;
      if (!(TF.Week && TF.Week.ended && TF.Econ && TF.Econ.on())) return;
      var n = TF.Econ.levelNo || 1;
      var abs = TF.Econ.abs ? TF.Econ.abs(TF.Week.day) : TF.Week.day;
      var flag = n + ':' + abs + ':' + (TF.Week.rentPaid ? 'w' : 'l');
      if (end.querySelector('[data-friday-lines="' + flag + '"]')) return;
      var win = !!TF.Week.rentPaid;
      var lines = LT.friday(n, win);
      if (!lines.length) return;
      end.dataset.levelText = flag;
      var prev = end.querySelector('[data-friday-lines]');
      if (prev) prev.remove();
      var box = document.createElement('div');
      box.className = 'scene';
      box.setAttribute('data-friday-lines', flag);
      box.style.cssText = 'overflow-wrap:anywhere;word-break:break-word';
      lines.forEach(function (t) {
        var row = document.createElement('div'); row.textContent = t; box.appendChild(row);
      });
      if (end.firstChild) end.insertBefore(box, end.firstChild.nextSibling);
      else end.appendChild(box);
    }
    function patchRetry() {
      var btn = typeof document !== 'undefined' && document.getElementById('btnRetryWeek');
      if (!btn || btn.dataset.retryText === '1') return;
      btn.dataset.retryText = '1';
      btn.addEventListener('click', function () {
        var line = LT.retryLine((TF.Checkpoint && TF.Checkpoint.retried) || 0);
        if (line && TF.Sim && TF.Sim.events) TF.Sim.events.push({ type: 'toast', text: line });
      });
    }
    if (typeof document !== 'undefined') {
      var endTimer = setInterval(function () { patchEnding(); patchRetry(); }, 500);
      if (endTimer && typeof endTimer.unref === 'function') endTimer.unref();
    }
    return LT;
  };
  return LT;
}));
