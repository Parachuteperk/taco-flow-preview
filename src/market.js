// The Quad Exchange adapter: full board from data/tickers.js (each on its opensDay;
// GOLD/COIN/SHADE/QUAD/SLVR day 1). Trading in PREP and REPORT. 2% fee (min $1),
// 25% exposure cap, no same-day round-trips. Drivers via MK.signal merged into ctx.
// Headlines for >=5% moves exposed as MK.headlines(day).
(function (TF) {
  var Sim = TF.Sim, W = function () { return TF.Week; };
  var MK = { X: null, open: {}, weekStart: {}, log: [], signals: {} };

  function econ() { return !!(TF.Econ && TF.Econ.on()); }
  function abs() { return TF.Econ.abs(W().day); }
  function cash() { return TF.Ledger.cash; }
  function tickers() { return TF.Tickers || []; }
  MK.create = function () {
    MK.X = TF.Market = TF.Exchange.create({ seed: TF.Rng.seed ^ 0xE8C4, tickers: tickers(), postTransaction: TF.postTransaction, getCash: cash });
    MK.open = {}; MK.weekStart = {};
    MK.openDay();
  };
  function phase() { return MK.X ? MK.X.getState().phase : null; }
  function day() { return MK.X ? MK.X.getState().day : 0; }
  MK.context = function () {
    var rows = TF.Ledger.rows || [], shade = 0, builds = 0, level = TF.Econ.levelNo || 1;
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
  MK.openDay = function () {
    if (!MK.X || !econ()) return;
    var d = abs();
    if (day() === d && phase() === 'prep') return;
    if (phase() === 'prep' && day() !== d) MK.X.close(day());
    if (day() >= d) return;
    MK.X.openPrep(d, Object.assign({}, MK.context(), MK.signals));
    MK.open = {};
    MK.X.board().forEach(function (q) { MK.open[q.sym] = q.cents; if (MK.weekStart[q.sym] === undefined) MK.weekStart[q.sym] = q.cents; });
  };
  MK.closeDay = function () {
    if (!MK.X || !econ() || phase() !== 'prep' || day() !== abs()) return null;
    var c = MK.X.close(abs(), Object.assign({}, MK.context(), MK.signals));
    MK.log.push(c);
    if (MK.log.length > 20) MK.log.shift();
    return c;
  };
  MK.rewindTo = function (d) {
    if (!MK.X || day() < d) return;
    var s = MK.X.getState(); s.day = d - 1; s.phase = 'close'; s.preRolls = {}; s.catalysts = [];
    MK.X.setState(s);
    MK.openDay();
  };
  MK.advanceTo = function (d) {
    if (!MK.X || !econ()) return;
    while (day() < d) {
      if (phase() === 'prep') MK.X.close(day());
      MK.X.openPrep(day() + 1, {});
      MK.open = {}; MK.X.board().forEach(function (q) { MK.open[q.sym] = q.cents; });
    }
  };
  MK.resetLevel = function () {
    if (!MK.X || (day() === abs() && phase() === 'prep')) return;
    if (day() >= abs()) MK.rewindTo(abs()); else MK.openDay();
    MK.syncPrices();
  };
  MK.syncPrices = function () { MK.open = {}; MK.weekStart = {}; MK.X.board().forEach(function (q) { MK.open[q.sym] = MK.weekStart[q.sym] = q.cents; }); };

  MK.trade = function (sym, buying, n) {
    n = n === undefined ? 1 : n;
    if (!MK.X) return { ok: false, reason: 'Market closed' };
    var ph = W().phase;
    if (ph !== 'prep' && ph !== 'report') return { ok: false, reason: 'Trading closed' };
    var r = buying ? MK.X.buy(sym, n) : MK.X.sell(sym, n);
    var feeNote = ' (2% fee, min $1)';
    Sim.events.push({ type: 'toast', text: r.ok ? (buying ? '📈 Bought ' : '📉 Sold ') + n + ' ' + sym + ' @ $' + (MK.X.quote(sym).cents / 100).toFixed(2) + feeNote
      : 'Can’t ' + (buying ? 'buy' : 'sell') + ' ' + sym + ': ' + r.reason });
    if (r.ok && TF.Save) TF.Save.write('prep');
    if (TF.Invest) TF.Invest.render();
    return r;
  };

  MK.star = function (sym) {
    if (!MK.X || phase() !== 'prep') return null;
    var h = MK.X.hint('star', sym);
    if (!h) return null;
    var lines = (TF.STAR_L1 && TF.STAR_L1[W().day]) || [], g = lines.filter(function (l) { return l.sym === sym && l.dir === h.dir; })[0];
    var text = g ? g.text : sym + (h.dir === 'up' ? ' looks ready to climb' : h.dir === 'down' ? ' looking soft' : ' holding steady');
    return { dir: h.dir, text: text };
  };

  function $(c) { return '$' + (c / 100).toFixed(2); }
  MK.html = function () {
    if (!MK.X || !econ()) return '';
    var ph = W().phase, tradable = ph === 'prep' || ph === 'report', hold = MK.X.portfolio(), c = cash();
    var h = '<div class="icard exch"><div><b>📈 Quad Exchange</b> <small>' + (tradable ? 'PREP/REPORT · whole shares · 2% fee (min $1) · 25% exposure' : 'trading closed during OPEN') + '</small></div></div>';
    MK.X.board().forEach(function (q) {
      var open = MK.open[q.sym] || q.cents;
      var pct = (q.cents - open) / open * 100;
      var n = hold[q.sym] || 0;
      h += '<div class="icard tick" data-sym="' + q.sym + '"><div><b>' + q.sym + ' · ' + $(q.cents) + '</b> <span>' + (pct >= 0 ? '↑ +' : '↓ ') + pct.toFixed(1) + '% today</span>' +
        '<div>Owned: <b>' + n + '</b> · Value: <b>' + $(n * q.cents) + '</b></div></div><span class="trade-buttons">' +
        [1,5].map(function (qty) {
          var fee = Math.max(100, Math.round(q.cents * qty * 0.02));
          return '<button data-ex-buy="' + q.sym + '" data-qty="' + qty + '"' + (!tradable || !q.listed || c < q.cents * qty + fee ? ' disabled' : '') + '>Buy ' + qty + '</button>';
        }).join('') +
        '<button data-ex-sell="' + q.sym + '" data-qty="1"' + (!tradable || !n ? ' disabled' : '') + '>Sell</button>' +
        '<button data-ex-sell="' + q.sym + '" data-qty="' + n + '"' + (!tradable || !n ? ' disabled' : '') + '>Sell all</button></span></div>';
    });
    return h;
  };
  MK.bind = function (list) {
    list.querySelectorAll('[data-ex-buy]').forEach(function (b) { b.addEventListener('click', function () { MK.trade(b.getAttribute('data-ex-buy'), true, Number(b.getAttribute('data-qty')) || 1); }); });
    list.querySelectorAll('[data-ex-sell]').forEach(function (b) { b.addEventListener('click', function () { MK.trade(b.getAttribute('data-ex-sell'), false, Number(b.getAttribute('data-qty')) || 1); }); });
  };

  MK.summary = function () {
    if (!MK.X) return [];
    var hold = MK.X.portfolio();
    return MK.X.board().map(function (q) {
      var s = MK.weekStart[q.sym] || q.cents;
      return { sym: q.sym, shares: hold[q.sym] || 0, cents: q.cents, pct: Math.round((q.cents - s) / s * 1000) / 10 };
    });
  };
  MK.scorecard = function () { return MK.X ? MK.X.scorecard().week : null; };
  MK.signal = function (s) { if (s && typeof s === 'object') Object.assign(MK.signals, s); };
  MK.headlines = function (day) {
    if (!MK.X) return [];
    var lc = MK.X.getState().lastClose;
    return (lc && lc.day === day && lc.headlines) || [];
  };

  TF.Mkt = MK;
  if (TF.Exchange && TF.Week && TF.Week.active() && TF.Econ && TF.Econ.K) MK.create();
})(window.TF);
