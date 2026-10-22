(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../data/economy'));
  else { root.TF = root.TF || {}; root.TF.Stock = factory(root.TF.Economy); }
}(this, function (Economy) {
  'use strict';
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function integer(value) { return Number.isSafeInteger(value); }
  function nonnegative(value) { return integer(value) && value >= 0; }
  function validLevel(level) { return integer(level) && level >= 1 && level <= Economy.levels.length; }
  function validDay(day) { return integer(day) && day >= 1; }
  function create(options) {
    options = options || {};
    if (typeof options.postTransaction !== 'function' || typeof options.getCash !== 'function') {
      throw new TypeError('postTransaction and getCash are required');
    }
    var level = options.level === undefined ? 1 : options.level;
    var capacity = options.stockMax === undefined ? 10 : options.stockMax;
    if (!validLevel(level)) throw new RangeError('Unknown level');
    if (!nonnegative(capacity)) throw new RangeError('stockMax must be nonnegative whole kits');
    var state = {
      level: level, day: (level - 1) * 5 + 1, phase: 'prep', standKits: 0, vanKits: 0,
      stockMax: capacity, tier: 'fair', priceAdd: 0, pending: [],
      lost: { soldOut: 0, tooPricey: 0 }, orderedToday: 0, yesterday: { kits: 0, tier: 'fair' }
    };
    function ramp() { return Economy.levels[state.level - 1]; }
    function price() { return ramp().prices[state.tier] + state.priceAdd; }
    function post(phase, cat, cents, ref) {
      options.postTransaction({ day: state.day, phase: phase, cat: cat, cents: cents, ref: ref });
    }
    function buy(kits, rush) {
      var cost = nonnegative(kits) ? Math.round(kits * ramp().kitCents * (rush ? Economy.rushMult : 1)) : null;
      function fail(reason) { return { ok: false, reason: reason, costCents: cost }; }
      if (state.phase !== (rush ? 'open' : 'prep')) return fail(rush ? 'openOnly' : 'prepOnly');
      if (!nonnegative(kits) || !nonnegative(cost) || !integer(state.orderedToday + kits) ||
          !integer(state.vanKits + kits)) return fail('invalidKits');
      if (options.getCash() < cost) return fail('insufficientCash');
      if (kits) {
        post(rush ? 'open' : 'prep', 'supplies', -cost,
          (rush ? 'RUSH ' : 'ORDER ') + kits + ' kits @' + ramp().kitCents);
        if (rush) state.pending.push({ kits: kits, etaS: Economy.rushDelayS });
        else state.vanKits += kits;
      }
      // Repeat all purchased kits, including rush purchases, in tomorrow's PREP.
      state.orderedToday += kits;
      return { ok: true, reason: null, costCents: cost };
    }
    return {
      order: function (kits) { return buy(kits, false); },
      rush: function (kits) { return buy(kits, true); },
      tick: function (dtSeconds) {
        if (typeof dtSeconds !== 'number' || !isFinite(dtSeconds) || dtSeconds < 0) throw new RangeError('Invalid elapsed seconds');
        var arrived = 0;
        state.pending = state.pending.filter(function (delivery) {
          delivery.etaS = Math.max(0, delivery.etaS - dtSeconds);
          // Repeated fractional frame steps can leave a tiny positive residue.
          if (delivery.etaS > 1e-9) return true;
          arrived += delivery.kits; return false;
        });
        state.vanKits += arrived;
        return arrived;
      },
      pendingRush: function () { return copy(state.pending); },
      refill: function () {
        var kits = Math.min(state.vanKits, Math.max(0, state.stockMax - state.standKits));
        state.vanKits -= kits; state.standKits += kits; return kits;
      },
      setStockMax: function (n) {
        if (!nonnegative(n)) throw new RangeError('stockMax must be nonnegative whole kits');
        state.stockMax = n;
        // Preserve purchased kits if a capacity modifier is removed.
        var overflow = Math.max(0, state.standKits - n);
        state.standKits -= overflow; state.vanKits += overflow;
      },
      needsRefill: function () { return state.standKits <= state.stockMax * 0.25; },
      soldOut: function () { return state.standKits === 0; },
      trySell: function (maxPayCents) {
        if (state.phase !== 'open') return { sold: false, reason: 'openOnly' };
        if (!state.standKits) { state.lost.soldOut++; return { sold: false, reason: 'soldOut' }; }
        if (typeof maxPayCents !== 'number' || !isFinite(maxPayCents) || maxPayCents < 0) throw new RangeError('Invalid maximum payment');
        var cents = price();
        if (maxPayCents < cents) { state.lost.tooPricey++; return { sold: false, reason: 'tooPricey' }; }
        post('open', 'sales', cents, state.tier);
        state.standKits--; return { sold: true, cents: cents };
      },
      lost: function () { return copy(state.lost); },
      setTier: function (tier) {
        if (state.phase !== 'prep' && state.phase !== 'open') throw new Error('Prices require PREP or OPEN');
        if (!Object.prototype.hasOwnProperty.call(ramp().prices, tier)) throw new RangeError('Unknown price tier');
        state.tier = tier;
      },
      price: price,
      setPriceAdd: function (cents) {
        if (!nonnegative(cents) || !integer(ramp().prices.bougie + cents)) throw new RangeError('Add-on must be nonnegative integer cents');
        state.priceAdd = cents;
      },
      faceFor: function (maxPayCents) {
        var p = price();
        return maxPayCents >= p * 1.5 ? '😀' : maxPayCents >= p * 1.15 ? '🙂' : maxPayCents >= p ? '😐' : '😤';
      },
      suggestOrder: function (input) {
        input = input || {};
        var sold = input.yesterdaySold === undefined || input.yesterdaySold === null ? 20 : input.yesterdaySold;
        var surge = input.surge || 1;
        if (!nonnegative(sold) || typeof surge !== 'number' || !isFinite(surge) || surge < 0) throw new RangeError('Invalid demand');
        var demand = Math.round(sold * (input.rain ? 0.85 : 1) * surge * 1e6) / 1e6;
        var kits = Math.max(0, Math.ceil((demand - state.standKits - state.vanKits) / 5) * 5);
        return { kits: kits, text: (input.yesterdaySold === undefined || input.yesterdaySold === null ? 'First day. ' : 'Yesterday you sold ' + sold + '. ') +
          (input.rain ? 'Star says rain. ' : '') + 'Suggest ' + kits + ' kits.' };
      },
      closeDay: function () {
        var leftover = state.standKits + state.vanKits;
        var spoiled = Math.round(leftover * ramp().spoilage);
        var vanLoss = Math.min(state.vanKits, spoiled);
        state.vanKits -= vanLoss; state.standKits -= spoiled - vanLoss;
        state.yesterday = { kits: state.orderedToday, tier: state.tier };
        state.orderedToday = 0; state.lost = { soldOut: 0, tooPricey: 0 };
        return { leftover: leftover, spoiledKits: spoiled, spoiledCostCents: spoiled * ramp().kitCents, kept: leftover - spoiled };
      },
      sameAsYesterday: function () { return copy(state.yesterday); },
      payWages: function (roster) {
        var names = Array.isArray(roster) ? roster : Object.keys(roster).filter(function (name) { return roster[name]; });
        var total = 0, seen = {};
        names.forEach(function (name) {
          if (!Object.prototype.hasOwnProperty.call(Economy.wagesCents, name) || seen[name]) return;
          var wage = Economy.wagesCents[name];
          post('report', 'wages', -wage, name); total += wage; seen[name] = true;
        });
        return total;
      },
      setLevel: function (level) {
        if (!validLevel(level)) throw new RangeError('Unknown level');
        state.level = level; state.day = (level - 1) * 5 + 1; state.phase = 'prep';
        state.standKits = 0; state.vanKits = 0; state.pending = [];
        state.priceAdd = 0; state.stockMax = capacity;
        state.lost = { soldOut: 0, tooPricey: 0 }; state.orderedToday = 0;
        state.yesterday = { kits: 0, tier: state.tier };
      },
      setPhase: function (phase, day) {
        phase = String(phase).toLowerCase();
        if (['prep', 'open', 'report'].indexOf(phase) < 0) throw new RangeError('Unknown phase');
        if (day !== undefined && !validDay(day)) throw new RangeError('Invalid day');
        state.phase = phase;
        if (day !== undefined) state.day = day;
      },
      setDay: function (day) {
        if (!validDay(day)) throw new RangeError('Invalid day');
        state.day = day;
      },
      snapshot: function () { return copy(state); },
      getState: function () { return copy(state); },
      setState: function (saved) { state = copy(saved); }
    };
  }
  return { create: create };
}));
