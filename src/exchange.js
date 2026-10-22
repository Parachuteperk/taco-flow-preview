(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../data/tickers.js'), root);
  else { root.TF = root.TF || {}; root.TF.Exchange = factory(root.TF.Tickers, root); }
}(typeof window !== 'undefined' ? window : this, function (defaultTickers, root) {
  'use strict';
  var sources = ['star', 'jared', 'antonio', 'west'];
  var accuracy = {star: 0.80, jared: 0.55, antonio: 0.90, west: 0.50};
  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function clampP(base, shifts) {
    var sum = Array.isArray(shifts) ? shifts.reduce(function (a, b) { return a + b; }, 0) : (shifts || 0);
    return clamp(base + clamp(sum, -30, 30), 15, 85);
  }
  function hash() {
    var h = 2166136261, i, j, str;
    for (i = 0; i < arguments.length; i++) {
      str = JSON.stringify(arguments[i]);
      str = str.length + ':' + str;
      for (j = 0; j < str.length; j++) h = Math.imul(h ^ str.charCodeAt(j), 16777619);
    }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function Stream(seed) {
    var state = seed >>> 0;
    this.next = function () {
      state = (state + 0x6D2B79F5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.getState = function () { return state; };
    this.setState = function (s) { state = s >>> 0; };
  }
  function emptyScores() {
    var result = {};
    sources.forEach(function (s) { result[s] = {hits: 0, total: 0}; });
    return result;
  }
  function create(options) {
    options = options || {};
    var tickers = copy(options.tickers || defaultTickers);
    var seed = options.seed === undefined ? 0 : options.seed;
    var rng = new Stream(typeof seed === 'number' ? seed : hash(seed) * 4294967296);
    var state = {seed: seed, tickers: tickers, day: 0, phase: 'idle', prices: {}, holdings: {},
      rngState: 0, viralDay: 6 + Math.floor(rng.next() * 15), preRolls: {}, catalysts: [],
      hintLog: [], scores: {weeks: {}, month: emptyScores()}, publicCatalysts: {}, scheduledCatalysts: [],
      fineDays: {}, goldBoostDay: 0, lastClose: null, ctx: {}, boughtToday: {}, lastDrinkSales: 0};
    tickers.forEach(function (t) { state.prices[t.sym] = t.startCents; state.holdings[t.sym] = 0; });
    function ticker(sym) {
      return tickers.filter(function (t) { return t.sym === sym; })[0];
    }
    function listed(t) { return !!t && state.day >= t.opensDay; }
    function price(cents) { return clamp(Math.round(cents), 100, 50000); }
    function finalClose(sym, r) {
      var cents = r.failedHack ? state.prices[sym] : Math.round(state.prices[sym] * (1 + (r.dir === 'up' ? r.v : -r.v)));
      if (sym === 'SHADE') {
        var shade = Math.max(0, (state.ctx.shadeBuilds || 0) - (state.buildCounts ? state.buildCounts.shade : 0));
        if (state.ctx.rain) cents = Math.round(r.fromCents * 0.90);
        else if (shade) cents = Math.round(r.fromCents * (1.02 + shade * 0.08));
      }
      if (sym === 'QUAD') {
        var builds = Math.max(0, (state.ctx.permanentBuilds || 0) - (state.buildCounts ? state.buildCounts.permanent : 0));
        cents = Math.round(r.fromCents * (1.005 + builds * 0.01));
      }
      state.catalysts.forEach(function (e) {
        if (e.sym === sym && sym !== 'COIN' && e.jump) cents = e.public ? cents + Math.round(r.fromCents * e.jump / 2) : Math.round(cents * (1 + e.jump));
      });
      return price(cents);
    }
    function outcome(from, to) { return to > from ? 'up' : to < from ? 'down' : 'flat'; }
    function post(cat, cents, ref, phase) {
      if (options.postTransaction) options.postTransaction({day: state.day, phase: phase || state.phase, cat: cat, cents: cents, ref: ref});
    }
    function eventKey(sym, c, index) { return sym + ':' + c.day + ':' + c.type + ':' + index; }
    function add(sym, type, shift, jump) { state.catalysts.push({sym: sym, type: type, day: state.day, shift: shift || 0, jump: jump || 0, public: false}); }
    function openPrep(day, ctx) {
      if (day !== Math.floor(day) || day < 1 || day > 20) throw new Error('Invalid day');
      if (state.day === day) return;
      if (state.phase === 'prep' || day < state.day) throw new Error('Close the current day before advancing');
      state.day = day; state.phase = 'prep'; state.ctx = copy(ctx || {});
      ctx = state.ctx;
      state.boughtToday = {};
      state.preRolls = {}; state.catalysts = [];
      tickers.forEach(function (t) {
        (t.catalysts || []).forEach(function (c, index) {
          if (c.day === day) {
            var ev = copy(c), announced = state.publicCatalysts[eventKey(t.sym, c, index)];
            ev.sym = t.sym; ev.public = announced !== undefined && announced < day;
            state.catalysts.push(ev);
          }
        });
      });
      (state.scheduledCatalysts || []).filter(function (c) { return c.day === day; }).forEach(function (c) { add(c.sym, c.type, c.shift, c.jump); });
      if (state.goldBoostDay === day) add('GOLD', 'flight-to-gold', 70 - (ticker('GOLD') || {}).risePct);
      if (day % 5 === 0 && ctx.rentPaidToday) add('WEST', 'rent', 10);
      if (ctx.trashOverflowOnVisit) add('WEST', 'trash', -10);
      if (ctx.failedRentWeek) add('WCO', 'failed-rent', 0, 0.25);
      if (ctx.paidRentEarly) add('WCO', 'early-rent', 0, -0.20);
      if (ctx.hackDay) add('TACO', 'hack', 80 - (ticker('TACO') || {}).risePct);
      if (ctx.sunny && day % 5 === 0) add('TUBE', 'sunny', 70 - (ticker('TUBE') || {}).risePct);
      if (ctx.rantDay) add('MAVS', 'rant', ctx.rantDir === 'down' ? -30 : 30);
      for (var n = 0; n < (ctx.antonioLevelUps || 0); n++) add('HACKR', 'level-up', 0, 0.20);
      if (day === state.viralDay) add('BOBA', 'viral', 0, 2);
      // ticker drivers (small probability nudges; ignored if signal absent)
      if (ctx.rain) add('SHADE', 'rain', -15);
      else if (ctx.hot || ctx.sunny) add('SHADE', 'hot', 6);
      if (ctx.shadeBuilds) add('SHADE', 'canopy', Math.min(12, (ctx.shadeBuilds || 0) * 2));
      var qb = ctx.permanentBuilds || ctx.builds || 0;
      if (qb) add('QUAD', 'builds', Math.min(18, qb));
      if (typeof ctx.drinkSales === 'number') {
        var prev = state.lastDrinkSales || 0;
        var diff = ctx.drinkSales - prev;
        var sh = Math.max(-12, Math.min(12, Math.round(diff / 4)));
        if (sh) add('BOBA', 'sales', sh);
        state.lastDrinkSales = ctx.drinkSales;
      }
      // All market rolls happen before any hint or public opening adjustment.
      tickers.forEach(function (t) {
        if (!listed(t)) return;
        var shifts = state.catalysts.filter(function (e) { return e.sym === t.sym; }).map(function (e) { return e.shift || 0; });
        var p = t.sym === 'COIN' ? 50 : clampP(t.risePct, shifts);
        state.preRolls[t.sym] = {p: p, dir: (['COIN', 'SHADE', 'QUAD'].indexOf(t.sym) >= 0 ? hash(state.seed, day, t.sym, 'daily') : rng.next()) < p / 100 ? 'up' : 'down', v: t.v,
          fromCents: state.prices[t.sym], failedHack: false};
      });
      var rolls = state.preRolls;
      if (ctx.hackDay && rolls.TACO) {
        rolls.TACO.failedHack = rng.next() < 0.05;
        if (rolls.TACO.failedHack) { rolls.TACO.dir = 'down'; add('TACO', 'failed-hack', 0, -0.40); }
      }
      if (ctx.jaredPitchDay && rolls.SLVR && rolls.GOLD) { rolls.SLVR.dir = rolls.GOLD.dir; rolls.SLVR.v *= 2; }
      if (ctx.rantDay && rolls.MAVS) rolls.MAVS.v *= 2;
      state.catalysts.forEach(function (e) {
        if (e.public && e.jump && rolls[e.sym]) state.prices[e.sym] = price(rolls[e.sym].fromCents * (1 + e.jump / 2));
      });
      state.openPrices = copy(state.prices);
      tickers.forEach(function (t) {
        var r = rolls[t.sym];
        if (!r) return;
        r.finalCents = finalClose(t.sym, r);
        r.outcome = outcome(r.fromCents, r.finalCents);
      });
    }
    function quote(sym) {
      var t = ticker(sym);
      if (!t) return null;
      return {cents: state.prices[sym], p: state.preRolls[sym] ? state.preRolls[sym].p : t.risePct, listed: listed(t)};
    }
    function feeFor(value) { return Math.max(100, Math.round(value * 0.02)); }
    function trade(sym, n, buying) {
      var t = ticker(sym), reason;
      if (state.phase !== 'prep' && state.phase !== 'close') reason = 'Trading closed';
      else if (!listed(t)) reason = 'Ticker not listed';
      else if (typeof n !== 'number' || !isFinite(n) || n <= 0 || Math.floor(n) !== n) reason = 'Whole positive shares required';
      else if (!buying && state.holdings[sym] < n) reason = 'Insufficient shares';
      else if (!buying && n > (state.holdings[sym] - (state.boughtToday[sym] || 0))) reason = 'No same-day round trip';
      else {
        var px = state.prices[sym], value = px * n, fee = feeFor(value);
        var cash = options.getCash ? options.getCash() : 1e15;
        if (buying && cash < value + fee) reason = 'Insufficient cash';
        else if (buying) {
          var curH = 0;
          for (var sy in state.holdings) curH += state.holdings[sy] * state.prices[sy];
          var newH = curH + value;
          var newC = cash - (value + fee);
          var tot = newC + newH;
          if (tot > 0 && newH > Math.floor(0.25 * tot + 0.5)) reason = 'Exposure cap exceeded';
        }
      }
      if (reason) return {ok: false, reason: reason};
      var ref = (buying ? 'BUY ' : 'SELL ') + sym + ' x' + n + ' @' + state.prices[sym];
      var cents = (buying ? -1 : 1) * state.prices[sym] * n;
      var fee = feeFor(state.prices[sym] * n);
      try { post('trade', cents, ref); }
      catch (error) { return {ok: false, reason: 'ledger error'}; }
      try { post('fee', -fee, ref); }
      catch (error) {
        try { post('trade', -cents, 'REVERSAL ' + ref); } catch (reversalError) { /* Best-effort compensation. */ }
        return {ok: false, reason: 'ledger error'};
      }
      state.holdings[sym] += buying ? n : -n;
      if (buying) state.boughtToday[sym] = (state.boughtToday[sym] || 0) + n;
      return {ok: true, reason: null};
    }
    function hint(source, sym) {
      var roll = state.preRolls[sym];
      if (state.phase !== 'prep' || sources.indexOf(source) < 0 || !roll) return null;
      var prior = state.hintLog.filter(function (h) { return h.day === state.day && h.source === source && h.sym === sym; })[0];
      if (prior) return copy(prior);
      var actual = roll.outcome || outcome(roll.fromCents, finalClose(sym, roll));
      var dir = hash(state.seed, state.day, source, sym) < accuracy[source] ? actual : (actual === 'up' ? 'down' : 'up');
      if (source === 'west' && (sym === 'WEST' || sym === 'WCO')) dir = 'up';
      var h = {source: source, sym: sym, dir: dir, day: state.day, expiresDay: state.day};
      state.hintLog.push(h);
      if (source === 'antonio' && !state.fineDays[state.day] && hash(state.seed, state.day, 'dean-fine') < 0.20) {
        state.fineDays[state.day] = true; post('fine', -2500, 'Dean: leaked emails');
      }
      return copy(h);
    }
    function starHeadlines(day) {
      if (state.phase !== 'prep' || day !== state.day) return [];
      var headlines = [];
      tickers.forEach(function (t) {
        (t.catalysts || []).forEach(function (c, index) {
          if (c.day > day && c.day <= day + 2) {
            var key = eventKey(t.sym, c, index);
            if (state.publicCatalysts[key] === undefined) state.publicCatalysts[key] = day;
            var item = copy(c); item.sym = t.sym; headlines.push(item);
          }
        });
      });
      return headlines;
    }
    function close(day, ctx) {
      if (state.phase === 'close' && day === state.day) return copy(state.lastClose);
      if (state.phase !== 'prep' || day !== state.day) throw new Error('No PREP for this day');
      if (ctx) state.ctx = Object.assign({}, state.ctx, copy(ctx));
      ['SHADE', 'QUAD'].forEach(function (sym) {
        var r = state.preRolls[sym];
        if (r) { r.finalCents = finalClose(sym, r); r.outcome = outcome(r.fromCents, r.finalCents); }
      });
      var moves = [], headlines = [];
      tickers.forEach(function (t) {
        var r = state.preRolls[t.sym];
        if (!r) return;
        state.prices[t.sym] = r.finalCents === undefined ? finalClose(t.sym, r) : r.finalCents;
        var fromC = r.fromCents, toC = state.prices[t.sym];
        moves.push({sym: t.sym, dir: outcome(fromC, toC), fromCents: fromC, toCents: toC});
        var pct = fromC ? (toC - fromC) / fromC : 0;
        if (Math.abs(pct) >= 0.05) {
          var dkey = pct >= 0 ? 'up' : 'down';
          var P7 = (typeof root !== 'undefined' && root.TF && root.TF.P7Content) || (typeof global !== 'undefined' && global.TF && global.TF.P7Content) || {};
          var arr = P7.headlines && P7.headlines[t.sym] && P7.headlines[t.sym][dkey];
          if (arr && arr.length) {
            var idx = Math.floor(hash(state.seed, day, t.sym, 'hl') * arr.length);
            headlines.push({sym: t.sym, pct: Math.round(pct * 1000) / 10, text: arr[idx]});
          }
        }
        if (t.sym !== 'GOLD' && toC <= fromC * 0.85) state.goldBoostDay = day + 1;
      });
      state.buildCounts = { shade: state.ctx.shadeBuilds || 0, permanent: state.ctx.permanentBuilds || 0 };
      state.phase = 'close';
      if (day % 5 === 0 && state.preRolls.WEST) post('dividend', 100 * state.holdings.WEST, 'WEST Friday dividend', 'close');
      var week = Math.ceil(day / 5);
      if (!state.scores.weeks[week]) state.scores.weeks[week] = emptyScores();
      state.hintLog.forEach(function (h) {
        if (h.day !== day) return;
        var hit = h.dir === outcome(state.preRolls[h.sym].fromCents, state.prices[h.sym]) ? 1 : 0;
        [state.scores.weeks[week], state.scores.month].forEach(function (scores) { scores[h.source].total++; scores[h.source].hits += hit; });
      });
      state.lastClose = {day: day, moves: moves, headlines: headlines};
      return copy(state.lastClose);
    }
    function scheduleCatalyst(c) {
      if (!ticker(c.sym) || typeof c.type !== 'string' || !c.type || !Number.isInteger(c.day) || c.day <= state.day || c.day > 21 || !Number.isFinite(c.shift) || (c.jump !== undefined && !Number.isFinite(c.jump))) throw new Error('Invalid scheduled catalyst');
      var pending = state.scheduledCatalysts || (state.scheduledCatalysts = []);
      if (!pending.some(function (x) { return x.sym === c.sym && x.type === c.type && x.day === c.day; })) pending.push(copy(c));
    }
    return {scheduleCatalyst: scheduleCatalyst, openPrep: openPrep, quote: quote, board: function () {
      return tickers.map(function (t) { var q = quote(t.sym); q.sym = t.sym; return q; });
    }, portfolio: function () { return copy(state.holdings); },
    portfolioValueCents: function () {
      return tickers.reduce(function (sum, t) { return sum + state.holdings[t.sym] * state.prices[t.sym]; }, 0);
    },
    buy: function (sym, n) { return trade(sym, n, true); }, sell: function (sym, n) { return trade(sym, n, false); },
    close: close, hint: hint, starHeadlines: starHeadlines,
    headlines: function (d) { return (state.lastClose && state.lastClose.day === d && state.lastClose.headlines) || []; },
    scorecard: function () { return {week: copy(state.scores.weeks[Math.ceil(state.day / 5)] || emptyScores()), month: copy(state.scores.month)}; },
    getState: function () { state.rngState = rng.getState(); return copy(state); },
    setState: function (s) { state = copy(s); state.scheduledCatalysts = state.scheduledCatalysts || []; state.boughtToday = state.boughtToday || {}; state.lastDrinkSales = state.lastDrinkSales || 0; tickers = state.tickers;
      defaultTickers.filter(function (t) { return ticker('GOLD') && ticker('TACO') && ticker('NAPZ') && ['COIN', 'SHADE', 'QUAD'].indexOf(t.sym) >= 0; }).forEach(function (t) {
        if (ticker(t.sym)) return;
        tickers.push(copy(t)); state.prices[t.sym] = t.startCents; state.holdings[t.sym] = 0;
        if (state.day >= t.opensDay && state.phase === 'prep') {
          var r = state.preRolls[t.sym] = { p: 50, dir: hash(state.seed, state.day, t.sym, 'migration') < 0.5 ? 'up' : 'down', v: t.v, fromCents: t.startCents, failedHack: false };
          r.finalCents = finalClose(t.sym, r); r.outcome = outcome(r.fromCents, r.finalCents);
          state.openPrices = state.openPrices || {}; state.openPrices[t.sym] = t.startCents;
        }
        if (state.lastClose && state.day >= t.opensDay) state.lastClose.moves.push({ sym: t.sym, dir: 'flat', fromCents: t.startCents, toCents: t.startCents });
      });
      rng.setState(state.rngState); }};
  }
  return {create: create, clampP: clampP, hash: hash};
}));
