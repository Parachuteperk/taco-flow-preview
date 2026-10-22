(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../data/economy'), require('../data/favors'));
  } else {
    root.TF = root.TF || {};
    root.TF.West = factory(root.TF.Economy, root.TF.Favors);
  }
}(this, function (Economy, Favors) {
  'use strict';
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function integer(value) { return typeof value === 'number' && isFinite(value) && Math.floor(value) === value; }
  function phaseName(phase) { return String(phase || '').toLowerCase(); }
  function favor(id) {
    for (var i = 0; i < Favors.length; i++) if (Favors[i].id === id) return Favors[i];
    return null;
  }
  function create(options) {
    options = options || {};
    if (typeof options.postTransaction !== 'function' || typeof options.getCash !== 'function') {
      throw new TypeError('postTransaction and getCash are required');
    }
    var state = { hard: !!options.hard, level: 1, week: 1, mood: 5, attempts: [1, 0, 0, 0], rentRecords: ['unpaid', 'unpaid', 'unpaid', 'unpaid'], paid: false, early: false, report: null, weeklyCounts: {}, active: {}, permits: {}, claimed: false };
    function ramp() { return Economy.levels[state.level - 1]; }
    function changeMood(delta) { state.mood = clamp(state.mood + delta, 0, 10); }
    function validDay(day) { return integer(day) && day >= (state.week - 1) * 5 + 1 && day <= state.week * 5; }
    function weekday(day) { return ((day - 1) % 5) + 1; }
    function due() { return Math.round(ramp().rentCents * (state.hard ? Economy.hard.rentMult : 1)); }
    function post(day, phase, cat, cents, ref) { options.postTransaction({ day: day, phase: phase, cat: cat, cents: cents, ref: ref || '' }); }
    function price(id, opts) {
      var f = favor(id);
      if (!f) throw new RangeError('Unknown favor: ' + id);
      return Math.round(f.l1Cents * ramp().favorMult * (state.hard ? Economy.hard.favorMult : 1) * (id === 'rainInsurance' && opts && opts.afterForecast ? 2 : 1));
    }
    // Optional opts also lets callers preview affordability at the forecast price.
    function canBuy(id, day, phase, opts) {
      var f = favor(id), total = 0, i;
      if (!f) return { ok: false, reason: 'unknownFavor' };
      if (!validDay(day)) return { ok: false, reason: 'invalidDay' };
      if (phaseName(phase) !== 'prep') return { ok: false, reason: 'prepOnly' };
      if (state.report) return { ok: false, reason: 'weekEnded' };
      for (i = 0; i < Favors.length; i++) total += state.weeklyCounts[Favors[i].id] || 0;
      if (total >= 3) return { ok: false, reason: 'weeklyCap' };
      if ((state.weeklyCounts[id] || 0) >= f.weeklyLimit) return { ok: false, reason: 'favorLimit' };
      if (f.neverMonday && weekday(day) === 1) return { ok: false, reason: 'neverMonday' };
      if (options.getCash() < price(id, opts)) return { ok: false, reason: 'insufficientCash' };
      return { ok: true, reason: null };
    }
    return {
      startLevel: function (level, opts) {
        if (!integer(level) || level < 1 || level > 4) throw new RangeError('Level must be 1..4');
        var index = level - 1;
        // A failed report increments the next attempt already. A checkpoint retry
        // can also explicitly mark a retry without a preceding report in memory.
        if (!state.attempts[index]) state.attempts[index] = opts && opts.retry ? 2 : 1;
        else if (opts && opts.retry && state.attempts[index] === 1) state.attempts[index] = 2;
        state.level = level; state.week = level;
        state.paid = false; state.early = false; state.report = null;
        state.weeklyCounts = {}; state.active = {}; state.permits = {}; state.claimed = false;
      },
      rentDue: due,
      rentStatus: function (cashCents, day, phase) {
        var amount = due(), covered = clamp(cashCents, 0, amount);
        if (state.paid) return { dueCents: amount, coveredCents: amount, pct: 1, state: 'covered', paid: true };
        var p = phaseName(phase), wd = weekday(day);
        var urgent = wd === 5 || (wd === 4 && (p === 'report' || p === 'close' || p === 'closed' || p === 'afterclose'));
        return { dueCents: amount, coveredCents: covered, pct: covered / amount, state: covered === amount ? 'covered' : urgent ? 'urgent' : 'short' };
      },
      payRentEarly: function (day) {
        if (!validDay(day) || weekday(day) === 5 || state.paid || state.report || options.getCash() < due()) return false;
        post(day, 'prep', 'rent', -due());
        state.paid = true; state.early = true; changeMood(3);
        state.rentRecords[state.level - 1] = state.attempts[state.level - 1] <= 1 ? 'firstTry' : 'retry';
        return true;
      },
      fridayReport: function (day) {
        if (!validDay(day) || weekday(day) !== 5) throw new RangeError('Friday report requires this level\'s Friday');
        if (state.report) return copy(state.report);
        var index = state.level - 1, firstTry = state.attempts[index] <= 1;
        if (!state.paid && options.getCash() >= due()) {
          post(day, 'report', 'rent', -due()); state.paid = true; changeMood(2);
        }
        if (state.paid) state.rentRecords[index] = firstTry ? 'firstTry' : 'retry';
        else {
          state.rentRecords[index] = 'unpaid'; changeMood(-2); state.attempts[index]++;
        }
        state.report = { paid: state.paid, early: state.early, firstTry: firstTry, retry: !state.paid && !(state.hard && state.level === Economy.hard.noRetryLevel) };
        return copy(state.report);
      },
      moodEvent: function (event) {
        var deltas = { goalHit: 1, cleanTrash: 1, trashOverflow: -1 };
        if (!Object.prototype.hasOwnProperty.call(deltas, event)) throw new RangeError('Unknown mood event');
        changeMood(deltas[event]); return state.mood;
      },
      mood: function () { return state.mood; },
      favorPrice: price,
      canBuy: canBuy,
      buyFavor: function (id, day, phase, opts) {
        var check = canBuy(id, day, phase, opts);
        var amount = favor(id) ? price(id, opts) : null;
        if (!check.ok) return { ok: false, reason: check.reason, price: amount };
        post(day, 'prep', 'favor', -amount, id);
        state.weeklyCounts[id] = (state.weeklyCounts[id] || 0) + 1;
        state.active[id] = (state.active[id] || 0) + 1;
        if (id === 'buildPermit') state.permits[day] = (state.permits[day] || 0) + 1;
        changeMood(1);
        return { ok: true, reason: null, price: amount };
      },
      hasFavor: function (id) { return !!state.active[id]; },
      consumeFavor: function (id) {
        if (!state.active[id]) return false;
        state.active[id]--; return true;
      },
      extraBuildsToday: function (day) { return state.permits[day] || 0; },
      rainClaim: function (day, prevDayAvgSalesCents, todaySalesCents) {
        if (!validDay(day) || state.claimed || !state.active.rainInsurance) return 0;
        if (!integer(prevDayAvgSalesCents) || !integer(todaySalesCents) || prevDayAvgSalesCents < 0 || todaySalesCents < 0) throw new TypeError('Sales must be nonnegative integer cents');
        var payout = Math.min(Math.max(0, prevDayAvgSalesCents - todaySalesCents), ramp().rainCapCents);
        if (payout) post(day, 'report', 'insurance', payout, 'rainInsurance');
        state.claimed = true; state.active.rainInsurance = 0;
        return payout;
      },
      galaScore: function (input) {
        var rent = 0, i;
        for (i = 0; i < 4; i++) rent += state.rentRecords[i] === 'firstTry' ? 100 : state.rentRecords[i] === 'retry' ? 50 : 0;
        var profit = clamp(Math.floor(Math.max(0, input.operatingProfitCents) / 1000), 0, 300);
        // Gains round down; negative net rounds up toward zero.
        var net = input.tradingNetCents;
        var trading = clamp((net < 0 ? Math.ceil(net / 2500) : Math.floor(net / 2500)) || 0, -50, 100);
        var mood = state.mood * 20, total = clamp(rent + profit + mood + trading, 0, 1000);
        var result = { total: total, rent: rent, profit: profit, mood: mood, trading: trading, win: total >= 700 };
        if (state.hard) result.hard = true;
        return result;
      },
      getState: function () { return copy(state); },
      setState: function (saved) { state = copy(saved); }
    };
  }
  return { create: create };
}));
