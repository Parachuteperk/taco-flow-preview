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
      if (day % 5 === 0 && ctx.rentPaidToday) add('WEST', 'rent', 10);
      if (ctx.trashOverflowOnVisit) add('WEST', 'trash', -10);
      if (ctx.failedRentWeek) add('WCO', 'failed-rent', 0, 0.25);
      if (ctx.paidRentEarly) add('WCO', 'early-rent', 0, -0.20);
      if (ctx.hackDay) add('TACO', 'hack', 80 - (ticker('TACO') || {}).risePct);
      if (ctx.sunny && day % 5 === 0) add('TUBE', 'sunny', 70 - (ticker('TUBE') || {}).risePct);
      for (var n = 0; n < (ctx.antonioLevelUps || 0); n++) add('HACKR', 'level-up', 0, 0.20);
      if (day === state.viralDay) add('BOBA', 'viral', 0, 2);
      // ticker drivers (small probability nudges; ignored if signal absent)
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
        state.preRolls[t.sym] = {p: p, dir: (t.sym === 'COIN' ? hash(state.seed, day, t.sym, 'daily') : rng.next()) < p / 100 ? 'up' : 'down', v: t.v,
          fromCents: state.prices[t.sym], failedHack: false};
      });
      var rolls = state.preRolls;
      if (ctx.hackDay && rolls.TACO) {
        rolls.TACO.failedHack = rng.next() < 0.05;
        if (rolls.TACO.failedHack) { rolls.TACO.dir = 'down'; add('TACO', 'failed-hack', 0, -0.40); }
      }
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
    setState: function (s) {
      var m = migrate(s);
      state = m.state; state.scheduledCatalysts = state.scheduledCatalysts || []; state.boughtToday = state.boughtToday || {}; state.lastDrinkSales = state.lastDrinkSales || 0; tickers = state.tickers;
      // Delisted shares go back to cash at their last price (no fee). The ledger is always restored
      // before the market, so a save or Monday checkpoint that still holds them pays out exactly once.
      m.refunds.forEach(function (r) { post('trade', r.cents, 'DELISTED ' + r.sym + ' x' + r.shares + ' @' + r.price + ' refund'); });
      rng.setState(state.rngState); }};
  }
  // Pass 7 (Aaron: "too many stocks"): these tickers left the board. migrate() strips them from a saved
  // Exchange state (a copy) and lists the refunds owed at each one's last price. Holdings or prices
  // outside the board's own limits (whole 1-20 shares, $1-$500) are dropped without a refund.
  var DELISTED = ['GOLD', 'SLVR', 'NAPZ', 'MAVS', 'SHADE', 'QUAD'];
  function migrate(s) {
    var state = copy(s), refunds = [];
    var gone = function (sym) { return DELISTED.indexOf(sym) >= 0; };
    if (!state || !Array.isArray(state.tickers) || !state.tickers.some(function (t) { return t && gone(t.sym); })) return {state: state, refunds: refunds};
    function strip(map) { if (map && typeof map === 'object') DELISTED.forEach(function (sym) { delete map[sym]; }); }
    state.tickers.forEach(function (t) {
      if (!t || !gone(t.sym)) return;
      var n = state.holdings ? state.holdings[t.sym] : 0, px = state.prices ? state.prices[t.sym] : 0;
      if (Number.isInteger(n) && n > 0 && n <= 20 && Number.isInteger(px) && px >= 100 && px <= 50000) refunds.push({sym: t.sym, shares: n, price: px, cents: n * px});
    });
    state.tickers = state.tickers.filter(function (t) { return !t || !gone(t.sym); });
    [state.prices, state.holdings, state.preRolls, state.openPrices, state.boughtToday].forEach(strip);
    var keep = function (e) { return !e || !gone(e.sym); };
    ['catalysts', 'scheduledCatalysts', 'hintLog'].forEach(function (k) { if (Array.isArray(state[k])) state[k] = state[k].filter(keep); });
    if (state.publicCatalysts) Object.keys(state.publicCatalysts).forEach(function (k) { if (gone(k.split(':')[0])) delete state.publicCatalysts[k]; });
    if (state.lastClose) ['moves', 'headlines'].forEach(function (k) { if (Array.isArray(state.lastClose[k])) state.lastClose[k] = state.lastClose[k].filter(keep); });
    state.goldBoostDay = 0;
    return {state: state, refunds: refunds};
  }
  return {create: create, clampP: clampP, hash: hash, migrate: migrate, DELISTED: DELISTED, ACCURACY: copy(accuracy)};
}));
