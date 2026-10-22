(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../data/calendar'), require('../data/story'));
  } else {
    root.TF = root.TF || {};
    root.TF.Calendar = factory(root.TF.CALENDAR, root.TF.STORY);
  }
}(typeof window !== 'undefined' ? window : this, function (Calendar, Story) {
  'use strict';
  var MAX_ON_SCREEN = 3, RNG_DRAWS = 4;
  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function day(n) {
    if (typeof n !== 'number' || n !== Math.floor(n) || n < 1 || n > 20) {
      throw new RangeError('Day must be an integer 1..20');
    }
    return copy(Calendar[n - 1]);
  }
  function beatsFor(n, phase) {
    var d = day(n), b = Story.beats[d.day];
    var key = String(phase).toLowerCase();
    return copy(Object.prototype.hasOwnProperty.call(b.phases, key) ? b.phases[key] : []);
  }
  function castFor(n, rng, opts) {
    var d = day(n), cap = Math.min(MAX_ON_SCREEN, d.cast.max);
    if (!rng || typeof rng.next !== 'function') throw new TypeError('rng.next is required');
    var vip = opts && opts.vip;
    if (vip !== undefined && ['boko', 'bigorder', 'strutters'].indexOf(vip) < 0) {
      throw new RangeError('Unknown VIP');
    }
    // Exactly four draws per valid call, even when guaranteed/VIP members fill the cap:
    // draw 0 gates Bigorder (20%); draws 1..3 select weighted pool members.
    // VIP replaces a pool slot; guaranteed cast always keeps its order.
    // If guarantees fill the cap, drop the VIP for this call (no deferral).
    var rolls = [], i;
    for (i = 0; i < RNG_DRAWS; i++) rolls.push(rng.next());
    var result = d.cast.guaranteed.slice(0, cap);
    function insert(id) {
      if (result.indexOf(id) < 0 && result.length < cap) result.push(id);
    }
    if (vip) insert(vip);
    if (rolls[0] < 0.2) insert('bigorder');
    var pool = d.cast.pool.filter(function (p) {
      return p.id !== 'bigorder' && result.indexOf(p.id) < 0 && p.weight > 0;
    });
    for (i = 1; i < RNG_DRAWS; i++) {
      var total = pool.reduce(function (sum, p) { return sum + p.weight; }, 0);
      var target = rolls[i] * total, j;
      if (result.length >= cap || !total) continue;
      for (j = 0; j < pool.length - 1 && target >= pool[j].weight; j++) target -= pool[j].weight;
      insert(pool[j].id); pool.splice(j, 1);
    }
    return result;
  }
  return {
    MAX_ON_SCREEN: MAX_ON_SCREEN, RNG_DRAWS: RNG_DRAWS,
    DAYS: Calendar.DAYS, LEVEL_DAYS: copy(Calendar.LEVEL_DAYS),
    RENT_DAYS: copy(Calendar.RENT_DAYS), INSPECTION_DAYS: copy(Calendar.INSPECTION_DAYS),
    day: day, level: function (n) { return day(n).level; },
    isRentDay: function (n) { return day(n).rent !== null; },
    isInspection: function (n) { return day(n).inspection !== null; },
    beatsFor: beatsFor, castFor: castFor,
    exchangeCtx: function (n) {
      var e = day(n).exchange;
      return { hackDay: e.hackDay, rantDay: e.rantDay, rantDir: e.rantDir };
    },
    catalysts: function (n) { return day(n).exchange.catalysts; }
  };
}));
