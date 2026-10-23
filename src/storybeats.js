// Show Calendar/Story beats for Days 1-20 (Pass 6D). Additive hooks only.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.StoryBeats = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var SB = { shown: {} };
  SB.beats = function (day, phase) {
    if (typeof TF === 'undefined' || !TF.Calendar) return [];
    return TF.Calendar.beatsFor(day, phase);
  };
  SB.allDaysHaveBeats = function () {
    if (typeof TF === 'undefined' || !TF.Calendar) {
      try {
        var Cal = require('./calendar');
        for (var d = 1; d <= 20; d++) {
          if (!Cal.beatsFor(d, 'morning').length) return false;
          if (!Cal.beatsFor(d, 'report').length) return false;
        }
        return true;
      } catch (e) { return false; }
    }
    for (var day = 1; day <= 20; day++) {
      if (!SB.beats(day, 'morning').length) return false;
      if (!SB.beats(day, 'report').length) return false;
    }
    return true;
  };
  SB.clearLevelDays = function (levelNo) {
    var n = levelNo || 1, lo = (n - 1) * 5 + 1, hi = n * 5;
    Object.keys(SB.shown).forEach(function (key) {
      var m = /^(morning|open|report):(\d+)$/.exec(key);
      if (m) {
        var day = +m[2];
        if (day >= lo && day <= hi) delete SB.shown[key];
      }
    });
  };
  SB.mount = function (host, beats, opts) {
    opts = opts || {};
    if (!host || !host.ownerDocument) throw new TypeError('Host required');
    var doc = host.ownerDocument, card = doc.createElement('section');
    card.id = opts.id || 'storyBeatCard';
    card.className = 'card2';
    card.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9;width:min(360px,calc(100% - 32px));box-sizing:border-box;background:#fff5d6;border:3px solid #501214;border-radius:12px;padding:14px;color:#2a1810;overflow-wrap:anywhere;word-break:break-word';
    var h = doc.createElement('h2'); h.textContent = opts.title || 'Morning'; h.style.margin = '0 0 8px';
    card.appendChild(h);
    (beats || []).forEach(function (b) {
      var p = doc.createElement('p');
      p.style.cssText = 'margin:0 0 8px;font-size:14px;overflow-wrap:anywhere';
      p.textContent = (b.who ? b.who.toUpperCase() + ': ' : '') + (b.text || '');
      card.appendChild(p);
    });
    var btn = doc.createElement('button');
    btn.type = 'button'; btn.textContent = opts.button || 'OK';
    btn.style.cssText = 'width:100%;min-height:44px;margin-top:8px';
    btn.onclick = function () { card.remove(); if (opts.onDone) opts.onDone(); };
    card.appendChild(btn);
    host.appendChild(card); btn.focus();
    return { element: card, destroy: function () { card.remove(); } };
  };
  SB.install = function (TF) {
    if (!TF || SB._installed) return SB;
    SB._installed = true;
    function absDay() {
      if (TF.Econ && typeof TF.Econ.abs === 'function' && TF.Week) return TF.Econ.abs(TF.Week.day);
      return TF.Week ? TF.Week.day : 1;
    }
    function showMorning() {
      if (!(TF.Week && TF.Week.active() && TF.Week.phase === 'prep' && TF.Calendar)) return;
      var day = absDay();
      var key = 'morning:' + day;
      if (SB.shown[key]) return;
      SB.shown[key] = true;
      var beats = SB.beats(day, 'morning');
      if (!beats.length) return;
      if (TF.Sim && TF.Sim.events) {
        beats.forEach(function (b) {
          TF.Sim.events.push({ type: 'toast', text: (b.who ? b.who + ': ' : '') + b.text });
        });
      }
    }
    function showOpenLine() {
      if (!(TF.Week && TF.Week.active() && TF.Week.phase === 'open' && TF.Calendar)) return;
      var day = absDay();
      var key = 'open:' + day;
      if (SB.shown[key] || TF.Week.t < 2) return;
      SB.shown[key] = true;
      var beats = SB.beats(day, 'open');
      if (beats[0] && TF.Sim && TF.Sim.events) {
        TF.Sim.events.push({ type: 'toast', text: (beats[0].who ? beats[0].who + ': ' : '') + beats[0].text });
      }
    }
    function showReport() {
      if (!(TF.Week && TF.Week.phase === 'report' && TF.Calendar)) return;
      var day = absDay();
      var key = 'report:' + day;
      var beats = SB.beats(day, 'report');
      var card = typeof document !== 'undefined' && document.getElementById('reportCard');
      if (!card || card.hidden || !beats[0]) return;
      // Key the inject by abs day so each report day gets its beat (innerHTML rebuilds wipe children).
      if (card.querySelector('[data-story-beat="' + day + '"]')) { SB.shown[key] = true; return; }
      card.dataset.storyBeat = String(day);
      SB.shown[key] = true;
      var div = document.createElement('div');
      div.className = 'scene';
      div.setAttribute('data-story-beat', String(day));
      div.style.cssText = 'overflow-wrap:anywhere';
      div.textContent = beats[0].text;
      var slot = card.querySelector('[data-slot="story"]');   // Pass 7: the report's Story & notes section
      if (slot) slot.appendChild(div);
      else if (card.firstChild) card.insertBefore(div, card.firstChild.nextSibling);
      else card.appendChild(div);
    }
    var tick = setInterval(function () { showMorning(); showOpenLine(); showReport(); }, 400);
    if (tick && typeof tick.unref === 'function') tick.unref();
    return SB;
  };
  return SB;
}));
