// The Quad Exchange, Level 1 slice (Pass 6A C5): GOLD, TACO and NAPZ on TF.Exchange (src/exchange.js:
// the odds engine: p = rise % + catalyst shifts clamped to 15-85 %, each close pre-rolled from p on the
// Exchange's own seeded market stream when PREP opens, hints only *report* that roll). This adapter
// owns the day cycle (openPrep at PREP, close at REPORT), the PREP-only rule (the engine stays in its
// 'prep' phase through our OPEN), whole-share trades of 1 with the $1 fee and the 20-share cap (both
// enforced by the engine), the University Star line per ticker (Grok's headlines, src/data/star-l1.js,
// picked to match the engine's 80 %-accurate hint), the INVEST panel section and the weekend summary.
(function (TF) {
  var Sim = TF.Sim, W = function () { return TF.Week; };
  var SYMS = ['GOLD', 'TACO', 'NAPZ', 'COIN', 'SHADE', 'QUAD'];
  var MK = { X: null, open: {}, weekStart: {}, log: [] };

  function econ() { return !!(TF.Econ && TF.Econ.on()); }
  function abs() { return TF.Econ.abs(W().day); }
  function cash() { return TF.Ledger.cash; }
  // L1 lists three tickers from Day 1 (the month's full board opens later, 6B)
  function tickers() {
    return (TF.Tickers || []).filter(function (t) { return SYMS.indexOf(t.sym) >= 0; })
      .map(function (t) { var c = JSON.parse(JSON.stringify(t)); c.opensDay = 1; return c; });
  }
  MK.create = function () {
    MK.X = TF.Market = TF.Exchange.create({ seed: TF.Rng.seed ^ 0xE8C4, tickers: tickers(), postTransaction: TF.postTransaction, getCash: cash });
    MK.open = {}; MK.weekStart = {};
    MK.openDay();
  };
  function phase() { return MK.X ? MK.X.getState().phase : null; }
  function day() { return MK.X ? MK.X.getState().day : 0; }
  MK.context = function () {
    var rows = TF.Ledger.rows || [], shade = 0, builds = 0, level = TF.Econ.levelNo || 1;
    // Prior locations remain part of the property market; today's value comes from
    // actual placed structures, so buying an unplaced stand never moves QUAD.
    rows.forEach(function (r) {
      if (r.day <= (level - 1) * 5 && (r.cat === 'build' || r.cat === 'upgrade') && /^(grill|banner|serving|canopy|stand2|drinks|picnic|trash)$/.test(r.ref)) {
        builds++; if (r.ref === 'canopy' || r.ref === 'picnic') shade++;
      }
    });
    Sim.stands.forEach(function (st) { if (st.placed) { builds += 1 + st.tier; if (st.tier >= 4) shade++; } });
    if (TF.Objects) TF.Objects.list.forEach(function (o) { builds++; if (o.kind === 'picnic') shade++; });
    var calendar = TF.Calendar && TF.Calendar.day(abs());
    return { shadeBuilds: shade, permanentBuilds: builds + level - 1, rain: !!(calendar && calendar.weather === 'rain') };
  };
  // PREP of a day: the engine pre-rolls every close now, before any hint is read.
  MK.openDay = function () {
    if (!MK.X || !econ()) return;
    var d = abs();
    if (day() === d && phase() === 'prep') return;
    if (phase() === 'prep' && day() !== d) MK.X.close(day());   // a level load mid-week: settle the old day first
    if (day() >= d) return;
    // no TACO hack-day catalyst in L1: Antonio is on the crew all Taco Week (hacks.js), so it would make
    // every day a p = 80 % day; the month's hack calendar brings it back (6B)
    MK.X.openPrep(d, MK.context());
    MK.open = {};
    MK.X.board().forEach(function (q) { MK.open[q.sym] = q.cents; if (MK.weekStart[q.sym] === undefined) MK.weekStart[q.sym] = q.cents; });
  };
  // REPORT: the pre-rolled closes land.
  MK.closeDay = function () {
    if (!MK.X || !econ() || phase() !== 'prep' || day() !== abs()) return null;
    var c = MK.X.close(abs(), MK.context());
    MK.log.push(c);
    if (MK.log.length > 20) MK.log.shift();
    return c;
  };
  // Week went back to a Monday (a level load or reset): the market's timeline goes back with it. The
  // engine only moves forward, so its clock is set to the evening before (closed) and that Monday's PREP
  // is pre-rolled from the current stream; holdings and prices carry over (C5 review: it stayed on the
  // old day, closed, until the calendar caught up).
  MK.rewindTo = function (d) {
    if (!MK.X || day() < d) return;
    var s = MK.X.getState(); s.day = d - 1; s.phase = 'close'; s.preRolls = {}; s.catalysts = [];
    MK.X.setState(s);
    MK.openDay();
  };
  // A test / debug jump to a later day: every day in between is settled (closed) and the next opened, so
  // prices and the trading P&L see each daily move (C5 review).
  MK.advanceTo = function (d) {
    if (!MK.X || !econ()) return;
    while (day() < d) {
      if (phase() === 'prep') MK.X.close(day());
      MK.X.openPrep(day() + 1, {});
      MK.open = {}; MK.X.board().forEach(function (q) { MK.open[q.sym] = q.cents; });
    }
  };
  MK.resetLevel = function () {
    if (!MK.X || (day() === abs() && phase() === 'prep')) return;   // already this Monday's PREP: keep its rolls
    if (day() >= abs()) MK.rewindTo(abs()); else MK.openDay();
    MK.syncPrices();
  };
  // after a checkpoint restore: today's open and the week's start are the restored (Monday) prices
  MK.syncPrices = function () { MK.open = {}; MK.weekStart = {}; MK.X.board().forEach(function (q) { MK.open[q.sym] = MK.weekStart[q.sym] = q.cents; }); };

  // ---- trading: PREP only, 1 whole share a tap -------------------------------------------------------
  MK.trade = function (sym, buying, n) {
    n = n === undefined ? 1 : n;
    if (!MK.X) return { ok: false, reason: 'Market closed' };
    if (W().phase !== 'prep') return { ok: false, reason: 'PREP only' };   // the engine can't tell OPEN from PREP
    var r = buying ? MK.X.buy(sym, n) : MK.X.sell(sym, n);
    Sim.events.push({ type: 'toast', text: r.ok ? (buying ? '📈 Bought ' : '📉 Sold ') + n + ' ' + sym + ' @ $' + (MK.X.quote(sym).cents / 100).toFixed(2) + ' (+$1 fee)'
      : 'Can’t ' + (buying ? 'buy' : 'sell') + ' ' + sym + ': ' + r.reason });
    if (r.ok && TF.Save) TF.Save.write('prep');
    if (TF.Invest) TF.Invest.render();
    return r;
  };

  // The Star's line for a ticker today: a Grok headline when its arrow matches the engine's Star hint,
  // otherwise a plain line in the same direction (the paper is 80 % right, never 100 %).
  MK.star = function (sym) {
    if (!MK.X || phase() !== 'prep') return null;
    var h = MK.X.hint('star', sym);
    if (!h) return null;
    var lines = (TF.STAR_L1 && TF.STAR_L1[W().day]) || [], g = lines.filter(function (l) { return l.sym === sym && l.dir === h.dir; })[0];
    var text = g ? g.text : sym + (h.dir === 'up' ? ' looks ready to climb' : h.dir === 'down' ? ' looking soft' : ' holding steady');
    return { dir: h.dir, text: text };
  };

  function $(c) { return '$' + (c / 100).toFixed(2); }
  // The INVEST panel section (invest.js calls html() then bind()).
  MK.html = function () {
    if (!MK.X || !econ()) return '';
    var prep = W().phase === 'prep', hold = MK.X.portfolio(), c = cash();
    var h = '<div class="icard exch"><div><b>📈 Quad Exchange</b> <small>' + (prep ? 'PREP only · whole shares · $1 a trade · max 20' : 'trading reopens at the next PREP') + '</small></div></div>';
    MK.X.board().forEach(function (q) {
      var open = MK.open[q.sym] || q.cents;
      var pct = (q.cents - open) / open * 100;
      var n = hold[q.sym] || 0;
      h += '<div class="icard tick" data-sym="' + q.sym + '"><div><b>' + q.sym + ' · ' + $(q.cents) + '</b> <span>' + (pct >= 0 ? '↑ +' : '↓ ') + pct.toFixed(1) + '% today</span>' +
        '<div>Owned: <b>' + n + '</b> · Value: <b>' + $(n * q.cents) + '</b></div></div><span class="trade-buttons">' +
        [1,5].map(function (qty) { return '<button data-ex-buy="' + q.sym + '" data-qty="' + qty + '"' + (!prep || !q.listed || n + qty > 20 || c < q.cents * qty + 100 ? ' disabled' : '') + '>Buy ' + qty + '</button>'; }).join('') +
        '<button data-ex-sell="' + q.sym + '" data-qty="1"' + (!prep || !n || c + q.cents < 100 ? ' disabled' : '') + '>Sell</button>' +
        '<button data-ex-sell="' + q.sym + '" data-qty="' + n + '"' + (!prep || !n || c + n * q.cents < 100 ? ' disabled' : '') + '>Sell all</button></span></div>';
    });
    return h;
  };
  MK.bind = function (list) {
    list.querySelectorAll('[data-ex-buy]').forEach(function (b) { b.addEventListener('click', function () { MK.trade(b.getAttribute('data-ex-buy'), true, Number(b.getAttribute('data-qty')) || 1); }); });
    list.querySelectorAll('[data-ex-sell]').forEach(function (b) { b.addEventListener('click', function () { MK.trade(b.getAttribute('data-ex-sell'), false, Number(b.getAttribute('data-qty')) || 1); }); });
  };

  // ---- the weekend verdict's numbers ------------------------------------------------------------------
  MK.summary = function () {
    if (!MK.X) return [];
    var hold = MK.X.portfolio();
    return MK.X.board().map(function (q) {
      var s = MK.weekStart[q.sym] || q.cents;
      return { sym: q.sym, shares: hold[q.sym] || 0, cents: q.cents, pct: Math.round((q.cents - s) / s * 1000) / 10 };
    });
  };
  MK.scorecard = function () { return MK.X ? MK.X.scorecard().week : null; };

  TF.Mkt = MK;
  if (TF.Exchange && TF.Week && TF.Week.active() && TF.Econ && TF.Econ.K) MK.create();
})(window.TF);
