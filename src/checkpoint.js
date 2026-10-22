// Monday PREP checkpoint (Pass 6 C3b/C3c, PLAN §1b "fail = retry"): the state you had at the start of
// this level's week, captured at boot and again every time a level loads (World.onLoad, after the
// level's own reset). If Friday's rent comes up short, "Retry the week" stores that checkpoint (plus
// West's record, which now counts the retry) in sessionStorage and reloads, so every module starts
// clean; boot loads the checkpoint's level, then restores cash + ledger, RNG streams, kits, the
// Exchange, Jared's metals and the roster. Placements and upgrades start empty, as on any Monday.
(function (TF) {
  var Sim = TF.Sim, World = TF.World, KEY = 'loli.v6.retry';
  var CP = TF.Checkpoint = { monday: null, retried: 0 };
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  CP.capture = function () {
    var L = TF.Ledger, EC = TF.Econ, I = TF.Invest, lv = World.level || {};
    return copy({
      v: 2, level: Sim.levelNo(), levelId: lv.id || 'L1', retried: CP.retried,
      // a level the page doesn't load by itself (L2-L4 until the month controller) travels with the save
      levelData: lv.id && lv.id !== 'L1' ? lv : null,
      ledger: { rows: L.rows, cash: L.cash, seedCents: L.seedCents },
      rng: TF.Rng.getState(),
      aaron: TF.Aaron && TF.Aaron.live ? TF.Aaron.live.getState() : null,
      cast: TF.CastExtra ? TF.CastExtra.getState() : null,
      drinkStock: TF.Objects ? TF.Objects.stock : null,
      stock: EC && EC.K ? EC.K.getState() : null,
      market: TF.Market ? TF.Market.getState() : null,
      invest: I ? { metals: I.metals, price: I.price, lastPrice: I.lastPrice } : null,
      roster: TF.Crew ? TF.Crew.hired() : []
    });
  };
  CP.restore = function (d) {
    var L = TF.Ledger, EC = TF.Econ, I = TF.Invest, W = TF.Week;
    var cur = World.level && World.level.id;
    if (d.levelId && d.levelId !== cur) {   // back to that level's map first (its reset runs now, then we restore over it)
      TF.LEVELS[d.levelId] = TF.LEVELS[d.levelId] || d.levelData;
      if (TF.LEVELS[d.levelId]) World.loadLevel(TF.LEVELS[d.levelId]);
    }
    L.rows = d.ledger.rows; L.cash = d.ledger.cash; L.seedCents = d.ledger.seedCents; L.unrouted = 0;
    TF.Rng.setState(d.rng);
    if (TF.Objects && TF.Objects.stock) TF.Objects.stock = copy(d.drinkStock || { drinks: 0, pending: [] });
    if (TF.CastExtra) TF.CastExtra.setState(d.cast);
    if (EC && EC.K && d.stock) { EC.K.setState(d.stock); EC.K.setPhase('prep', EC.abs(W.day)); }
    if (EC && EC.M && d.west) { EC.M.setState(d.west); EC.M.startLevel(d.level, { retry: true }); }
    if (TF.Market && d.market) { TF.Market.setState(d.market); if (TF.Mkt) TF.Mkt.syncPrices(); }
    if (I && d.invest) { I.metals = d.invest.metals; I.price = d.invest.price; I.lastPrice = d.invest.lastPrice; }
    if (TF.Crew) {
      TF.Crew.hiredSet = { jared: true };
      d.roster.forEach(function (id) { TF.Crew.hiredSet[id] = true; });
      TF.Crew.applyMods(); TF.Crew.spotKey = ''; TF.Crew.refresh();
    }
    if (TF.Aaron && TF.Aaron.restore) TF.Aaron.restore(d.aaron, !!TF.Crew.hiredSet.aaron);
    else if (TF.Aaron) TF.Aaron.pendingRestore = {state: d.aaron, hired: !!TF.Crew.hiredSet.aaron};
    if (EC && EC.sync) EC.sync();
    CP.retried = (d.retried || 0) + 1;
  };
  // Friday short: back to Monday PREP of this level's week.
  CP.retry = function () {
    var d = CP.monday || CP.capture();
    d.west = TF.Econ && TF.Econ.M ? TF.Econ.M.getState() : null;   // keeps the attempt count (retry = 50 rent points)
    try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage blocked: a plain restart */ }
    location.reload();
  };
  // every level's Monday PREP is a checkpoint (registered last, so it runs after the level's resets)
  World.onLoad.push(function () { if (!(TF.Campaign && TF.Campaign.busy) && TF.Week && TF.Week.active()) CP.monday = CP.capture(); });
  var saved = null;
  try { saved = sessionStorage.getItem(KEY); if (saved) sessionStorage.removeItem(KEY); } catch (e) { saved = null; }
  if (saved && TF.Week && TF.Week.active()) {
    try {
      CP.restore(JSON.parse(saved)); CP.justRestored = true;
      Sim.events.push({ type: 'toast', text: '🔁 Retry: Monday again with $' + Sim.stats.money.toFixed(2) + '. Rent is still $' + (TF.Econ.M.rentDue() / 100) + ' on Friday.' });
    } catch (e) { console.warn('checkpoint restore failed', e); }
  }
  CP.monday = CP.capture();
})(window.TF);
