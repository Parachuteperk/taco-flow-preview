// Per-look speech bubbles (Pass 6D). Uses all 28 customer looks + data/look-quips.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      (function () { try { return require('../data/look-quips'); } catch (e) { return null; } })()
    );
  } else { root.TF = root.TF || {}; root.TF.LookQuips = factory(root.TF.LOOK_QUIPS); }
}(typeof window !== 'undefined' ? window : this, function (Quips) {
  'use strict';
  var LQ = { rate: 0.08 };
  // Map every spawnable look id onto a LOOK_QUIPS category (or general).
  var LOOK_TO_QUIP = {
    hoodie: 'headphones', tank: 'gym', capguy: 'undergrad', sundress: 'undergrad',
    glasses: 'grad', ponytail: 'undergrad', jersey: 'athlete', cardigan: 'professor',
    cowboy: 'cowboy', bandtee: 'goth',
    athlete: 'athlete', skater: 'skater', rotc: 'rotc', bandkid: 'band',
    hijab: 'undergrad', movein_dad: 'parent',
    sorority: 'greek', frat: 'greek', cowboy2: 'cowboy', nursing: 'nursing',
    artstudent: 'artsy', gymgirl: 'gym',
    professor: 'professor', tuber: 'tuber', engineer: 'grad', gradstudent: 'grad',
    footballfan: 'alumni', groundskeeper: 'general'
  };
  function bag() {
    if (Quips && Quips.general) return Quips;
    if (typeof TF !== 'undefined' && TF.LOOK_QUIPS) return TF.LOOK_QUIPS;
    return null;
  }
  LQ.LOOK_TO_QUIP = LOOK_TO_QUIP;
  LQ.allLooks = function (P) {
    P = P || (typeof TF !== 'undefined' ? TF.ArtPeople : null);
    if (!P) return Object.keys(LOOK_TO_QUIP);
    if (P.ALL_LOOKS) return P.ALL_LOOKS.slice();
    return (P.VARIANTS || []).concat(P.VARIANTS_B2 || [], P.VARIANTS_B3 || [], P.VARIANTS_B4 || []);
  };
  LQ.lookName = function (variant, P) {
    var looks = LQ.allLooks(P);
    if (!looks.length) return 'hoodie';
    return looks[((variant % looks.length) + looks.length) % looks.length];
  };
  LQ.quipsForLook = function (lookId) {
    var q = bag(); if (!q) return [];
    var cat = LOOK_TO_QUIP[lookId] || 'general';
    return (q[cat] || q.general || []).slice();
  };
  LQ.pick = function (lookId, rng) {
    var list = LQ.quipsForLook(lookId);
    if (!list.length) return '';
    var r = rng && typeof rng === 'function' ? rng() : (rng && rng.next ? rng.next() : Math.random());
    return list[Math.floor(r * list.length) % list.length];
  };
  LQ.everyLookHasQuip = function (P) {
    return LQ.allLooks(P).every(function (id) { return LQ.quipsForLook(id).length > 0; });
  };
  LQ.install = function (TF) {
    if (!TF || LQ._installed) return LQ;
    LQ._installed = true;
    if (TF.ArtPeople && !TF.ArtPeople.ALL_LOOKS) {
      TF.ArtPeople.ALL_LOOKS = (TF.ArtPeople.VARIANTS || []).concat(TF.ArtPeople.VARIANTS_B2 || [], TF.ArtPeople.VARIANTS_B3 || [], TF.ArtPeople.VARIANTS_B4 || []);
    }
    function chatter() { return TF.Rng && TF.Rng.ambient ? TF.Rng.ambient() : Math.random(); }
    // Adapt the existing idle caller without touching the parallel Aaron integration lane.
    if (TF.Aaron && TF.Aaron.idleLine) {
      var idleLine = TF.Aaron.idleLine;
      TF.Aaron.idleLine = function () { return idleLine({ next: chatter }); };
    }
    var wrap = TF.Sim && TF.Sim.spawnGuest;

    // Cosmetic quips must NOT touch Sim.rand — per-frame rolls desync the customer stream
    // (week-run desktop then can't afford Day-4 stand 2).
    function quipRand() { return chatter(); }   // ambient stream, not the customer RNG (review M5)
    function gate() { return TF.SpeechGate; }
    function tryAmbient(line, secs) {
      var G = gate();
      if (!line) return false;
      if (!G) return true;
      return G.begin(line, { critical: false, secs: secs }) === 'live';
    }
    if (typeof wrap === 'function') {
      TF.Sim.spawnGuest = function () {
        var g = wrap.apply(this, arguments);
        if (g) {
          g._lookId = LQ.lookName(g.variant, TF.ArtPeople);
          g._quipT = 1.5 + quipRand() * 2;
          if (quipRand() < LQ.rate) {
            var line = LQ.pick(g._lookId, quipRand);
            if (tryAmbient(line, 3.5)) { g.speech = line; g.speechT = 3.5; }
          }
        }
        return g;
      };
    }
    LQ.step = function (dt) {
      if (!TF.Sim) return;
      TF.Sim.guests.forEach(function (g) {
        if (g.speechT > 0) {
          g.speechT -= dt;
          if (g.speechT <= 0) g.speech = null;
        } else if (!g.speech && g.state === 'QUEUE') {
          g._quipT = (g._quipT || 2) - dt;
          if (g._quipT <= 0) {
            g._quipT = 2.5 + quipRand() * 2;
            if (quipRand() < 0.12) {
              g._lookId = g._lookId || LQ.lookName(g.variant, TF.ArtPeople);
              var line = LQ.pick(g._lookId, quipRand);
              if (tryAmbient(line, 3)) { g.speech = line; g.speechT = 3; }
            }
          }
        }
        if (g.speech && g.speechT > 0 && TF.Arcs && TF.Render) {
          var G = gate();
          if (G && !G.allows(g.speech)) return;
          var p = TF.Render.toScreen(g.x, g.y);
          TF.Arcs.bubbles.push({ text: g.speech, x: p.x, y: p.y - 44 * TF.Render.cam.z, bg: 'rgba(40,20,15,0.9)', small: true });
        }
      });
    };
    TF.plugins.push(LQ);
    return LQ;
  };
  return LQ;
}));
