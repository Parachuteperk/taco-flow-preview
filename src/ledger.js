// The ledger (Pass 6, PLAN §2): every cash change is one row {day, phase, cat, cents, ref} in integer
// cents, posted through postTransaction(). Sim.stats.money is a read-only view of the balance; a
// direct write still works but is posted as cat 'unrouted' and counted, so tests can insist on 0.
// Also here: seeded RNG streams with getState/setState (customers / market / events), so a saved
// game replays identically and reading a panel never consumes market randomness.
(function (TF) {
  var Sim = TF.Sim;

  // ---- RNG streams (mulberry32 with exposed state) ----------------------------------------------
  function Stream(seed) { this.s = seed | 0; }
  Stream.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) | 0;
    var t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Stream.prototype.getState = function () { return this.s; };
  Stream.prototype.setState = function (s) { this.s = s | 0; };
  var seed = +((/[?&]seed=(\d+)/.exec(location.search) || [])[1] || 7);
  var R = TF.Rng = {
    seed: seed,
    streams: { customers: new Stream(seed), market: new Stream(seed * 31 + 7), events: new Stream(seed * 131 + 3), objects: new Stream(seed * 17 + 31),
      // C3b: wagers / coin flips, story beats and ambient extras + chatter each own a stream, so none shifts prices or customers
      wager: new Stream(seed * 7 + 11), story: new Stream(seed * 53 + 5), ambient: new Stream(seed * 97 + 13),
      matt: new Stream(seed * 211 + 17) },   // C4: Matt's breakdown schedule (TF.Matt draws from it)
    getState: function () { var o = {}; Object.keys(R.streams).forEach(function (k) { o[k] = R.streams[k].getState(); }); return o; },
    setState: function (o) { Object.keys(o || {}).forEach(function (k) { if (R.streams[k]) R.streams[k].setState(o[k]); }); }
  };
  R.customers = function () { return R.streams.customers.next(); };
  R.market = function () { return R.streams.market.next(); };
  R.events = function () { return R.streams.events.next(); };
  R.objects = function () { return R.streams.objects.next(); };   // drinks / litter / picnic seats
  R.wager = function () { return R.streams.wager.next(); };       // Jared's stash bets + coin flips
  R.story = function () { return R.streams.story.next(); };       // arc beats (rants, crew lines)
  R.ambient = function () { return R.streams.ambient.next(); };   // extras, sitters, hack chatter
  Sim.rand = R.customers;   // the crowd's stream (was World.rng(seed))

  // ---- Ledger ---------------------------------------------------------------------------------
  var L = TF.Ledger = { rows: [], cash: 0, unrouted: 0, seedCents: 0 };
  function where() {
    var W = TF.Week;
    return { day: W ? (TF.Econ ? TF.Econ.abs(W.day) : W.day) : 0, phase: W ? W.phase : 'free' };
  }
  // postTransaction({day?, phase?, cat, cents, ref}); day/phase default to the current ones.
  L.post = TF.postTransaction = function (t) {
    var w = where(), cents = Math.round(t.cents);
    if (!cents) return null;
    var row = { day: t.day !== undefined ? t.day : w.day, phase: t.phase || w.phase, cat: t.cat, cents: cents, ref: t.ref || '' };
    L.rows.push(row);
    L.cash += cents;
    if (t.cat === 'seed') L.seedCents += cents;
    return row;
  };
  // Dollars convenience: L.add('sales', 5.5, 'taco').
  L.add = function (cat, dollars, ref) { return L.post({ cat: cat, cents: Math.round(dollars * 100), ref: ref }); };
  L.sum = function (filter) {
    var s = 0;
    for (var i = 0; i < L.rows.length; i++) if (!filter || filter(L.rows[i])) s += L.rows[i].cents;
    return s;
  };
  L.byCat = function (day) {
    var o = {};
    L.rows.forEach(function (r) { if (day === undefined || r.day === day) o[r.cat] = (o[r.cat] || 0) + r.cents; });
    return o;
  };
  // Reconciliation: cash == seed + Σ(non-seed rows), recomputed from the rows.
  L.reconcile = function () {
    var rest = L.sum(function (r) { return r.cat !== 'seed'; });
    return { cash: L.cash, expected: L.seedCents + rest, ok: L.cash === L.seedCents + rest, unrouted: L.unrouted, rows: L.rows.length };
  };
  // The three numbers kept separate (PLAN §2).
  var OPERATING = { sales: 1, drinks: 1, tips: 1, premium: 1, supplies: 1, spoilage: 1, upkeep: 1, wages: 1, favor: 1, insurance: 1 };
  var TRADING = { trade: 1, fee: 1, dividend: 1, wager: 1, metal: 1, fine: 1 };
  var CAPITAL = { build: 1, upgrade: 1, hire: 1, crew: 1 };
  L.split = function (filter) {
    var o = { operating: 0, trading: 0, capital: 0, rent: 0, other: 0 };
    L.rows.forEach(function (r) {
      if (filter && !filter(r)) return;
      if (r.cat === 'seed' || r.cat === 'test') return;
      if (OPERATING[r.cat]) o.operating += r.cents;
      else if (TRADING[r.cat]) o.trading += r.cents;
      else if (CAPITAL[r.cat]) o.capital += r.cents;
      else if (r.cat === 'rent') o.rent += r.cents;
      else o.other += r.cents;
    });
    // trading gains, not cash flow: what you still hold counts at today's price (realized + unrealized)
    if (!filter) o.trading += Math.round(L.holdingsValue() * 100);
    return o;
  };
  // dollars held: Jared's metals + the Exchange portfolio at today's close (TF.Market, integer cents)
  L.holdingsValue = function () {
    return (TF.Invest && TF.Invest.metalValue ? TF.Invest.metalValue() : 0) + (TF.Market ? TF.Market.portfolioValueCents() / 100 : 0);
  };
  L.reset = function () { L.rows = []; L.cash = 0; L.unrouted = 0; L.seedCents = 0; };

  // Sim.stats.money: dollars, read from the ledger. Writes are caught and logged as 'unrouted'.
  var start = Sim.stats.money || 0;
  Object.defineProperty(Sim.stats, 'money', {
    get: function () { return L.cash / 100; },
    set: function (v) { L.unrouted++; L.post({ cat: 'unrouted', cents: Math.round(v * 100) - L.cash, ref: 'direct write' }); },
    enumerable: true, configurable: true
  });
  if (start) L.add('seed', start, 'start');
})(window.TF);
