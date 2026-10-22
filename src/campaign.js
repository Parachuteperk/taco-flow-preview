// The month (Pass 6B B2): Level 1 -> 4 on TF.LevelFlow (src/levelflow.js holds the rules: Friday's
// rent decides advance / retry / complete / game over; what carries over (cash + ledger, crew roster,
// the Exchange portfolio, RNG, West's campaign record) and what resets (map, placements, upgrades,
// kits, jobs, daily flags); Monday checkpoints). This controller connects it to the live game: a
// canonical snapshot of the live modules, the level-start card (TF.LevelStartUI), and the load hooks
// (load the map -> apply the state over the level's resets -> pre-roll Monday's market -> capture the
// Monday checkpoint -> save). No auto-saves fire mid-transition; the final save is the last step.
(function (TF) {
  var Sim = TF.Sim, World = TF.World;
  var CA = TF.Campaign = { monday: null, busy: false, log: [], last: null, pending: null, locked: false };
  function on() { return !!(TF.LevelFlow && TF.Week && TF.Week.active() && TF.Econ && TF.Econ.on() && TF.Market); }
  CA.on = on;

  // the live game as LevelFlow's canonical JSON state (day local, module days campaign-absolute)
  CA.live = function (phaseOverride) {
    var s = TF.LevelFlow.fromLive({ Econ: TF.Econ, Week: { day: TF.Week.day, phase: phaseOverride || TF.Week.phase }, Ledger: TF.Ledger,
      Crew: TF.Crew, Rng: TF.Rng, World: World, Market: TF.Market, standTier: Sim.stand.tier, flags: {} });
    if (TF.Invest) s.flags.invest = JSON.parse(JSON.stringify({ metals: TF.Invest.metals, price: TF.Invest.price, lastPrice: TF.Invest.lastPrice }));
    if (TF.Save) { var snap = TF.Save.snapshot('prep'), b = snap.buildings; s.placements = b.stands; s.buildings = b.objects; s.flags.owned = snap.flags.owned; }
    return s;
  };
  CA.captureMonday = function () { if (!on()) return null; try { CA.monday = TF.LevelFlow.captureMonday(CA.live('prep')); } catch (e) { CA.monday = null; } return CA.monday; };

  // the state applied over a freshly loaded level (after its resets)
  function apply(s) {
    var L = TF.Ledger, E = TF.Econ;
    L.rows = s.ledger.rows; L.cash = s.ledger.cash; L.seedCents = s.ledger.seedCents; L.unrouted = s.ledger.unrouted;
    TF.Rng.setState(s.rng);
    E.levelNo = s.level; E.K.setState(s.stock); E.M.setState(s.west); E.rent = null;
    TF.Market.setState(s.exchange);
    TF.Crew.hiredSet = { jared: true }; s.crew.hired.forEach(function (id) { TF.Crew.hiredSet[id] = true; });
    TF.Crew.extras = s.crew.extras || {};
    if (s.crew.levels) TF.Crew.levels = s.crew.levels;
    if (TF.Invest && s.flags.invest) Object.keys(s.flags.invest).forEach(function (k) { TF.Invest[k] = JSON.parse(JSON.stringify(s.flags.invest[k])); });
    (s.placements || []).forEach(function (p, i) {
      if (!p.placed) return;
      var st = Sim.stands[i] || Sim.addStand();
      if (!Sim.placeStand(p.sx, p.sy, p.rot, st).ok) throw new Error('Retry stand rejected');
      (p.line || []).forEach(function (t) { if (!Sim.addLineTile(t.x, t.y, st).ok) throw new Error('Retry line rejected'); });
      st.tier = p.tier;
    });
    if (TF.Objects) TF.Objects.restore(s.buildings || []);
    // advance: placements reset per level, so physical investment records (a stand / an object) go too; retry remaps Monday's
    if (TF.Invest) TF.Invest.owned = (s.flags.owned || []).filter(function (o) { return s.retrying || (o.st === null && !(o.obj >= 0)); }).map(function (o) {
      return Object.assign({}, o, { st: o.st === null ? null : Sim.stands[o.st], obj: TF.Objects && o.obj >= 0 ? TF.Objects.list[o.obj] : null });
    });
    Sim.stand.tier = s.standTier;
    TF.Crew.applyMods(); TF.Crew.spotKey = '';
    TF.Mkt.openDay(); TF.Mkt.syncPrices();   // Monday's market rolls happen here, so they enter the checkpoint
    E.sync(); TF.Week.refresh(); if (TF.Crew.refresh) TF.Crew.refresh();
    if (TF.Onboard && TF.Onboard.resetForLevel) TF.Onboard.resetForLevel();   // pins for this map, after its restores
    return CA.live('prep');
  }
  var hooks = {
    loadLevel: function (map) { if (TF.Save) TF.Save.disabled = true; World.loadLevel(map); },
    applyState: function (s) { var r = apply(s); if (TF.Save) TF.Save.disabled = false; return r; },
    captureMonday: function (cp) { CA.monday = cp; if (TF.Checkpoint) TF.Checkpoint.monday = TF.Checkpoint.capture(); },
    autoSave: function (phase) {
      var pending = CA.pending; CA.pending = null;
      CA.persisting = true;
      var saved = TF.Save ? TF.Save.write(phase) : true; CA.persisting = false;
      if (saved) CA.pendingDurable = false;
      if (!saved) CA.pending = pending;
      return saved;
    }
  };
  function load(state) {
    var n = state.level, map = TF.LEVELS['L' + n];
    if (!map) throw new Error('Level L' + n + ' is not loaded');
    CA.locked = true;
    if (!CA.pending) CA.pending = { state: state, monday: CA.monday };
    if (!CA.pendingDurable) {
      CA.persisting = true;
      var saved = !TF.Save || TF.Save.write('report'); CA.persisting = false;
      if (!saved) return Promise.reject(new Error('Pending transition save failed'));
      CA.pendingDurable = true;
    }
    CA.busy = true;
    return TF.LevelFlow.load(state, map, hooks).then(function (r) {
      CA.busy = false;
      if (!r.saved) { CA.monday = CA.pending.monday; throw new Error('Transition save failed'); }
      if (TF.Checkpoint) TF.Checkpoint.monday = TF.Checkpoint.capture();
      ['endCard', 'reportCard'].forEach(function (id) { var e = document.getElementById(id); if (e) e.hidden = true; });
      CA.locked = false; CA.last = { level: n, saved: r.saved }; CA.log.push('L' + n + (state.retrying ? ' retry' : ''));
      if (TF.ui && TF.ui.api) TF.ui.api.pause();
      Sim.events.push({ type: 'toast', text: (state.retrying ? '🔁 Monday again: ' : '📍 ') + (map.name || 'Level ' + n) + '. Rent is $' + (TF.Econ.M.rentDue() / 100) + ' by Friday.' });
      return r;
    }, function (e) { CA.busy = false; if (TF.Save) TF.Save.disabled = false; if (CA.pending) CA.monday = CA.pending.monday; throw e; });
  }

  // Friday REPORT -> what next (the verdict card asks; this is the answer it acts on)
  CA.endWeek = function () {
    var r = TF.LevelFlow.endWeek(CA.live('report')), s = r.state, L = TF.Ledger;
    L.rows = s.ledger.rows; L.cash = s.ledger.cash; L.seedCents = s.ledger.seedCents; L.unrouted = s.ledger.unrouted;
    TF.Econ.M.setState(s.west);
    return r;
  };
  // rent paid: on to the next level, through its start card
  CA.advance = function (opts) {
    var next = CA.pending ? CA.pending.state : TF.LevelFlow.advance(CA.live('report'));
    CA.locked = true;
    var card = TF.LevelFlow.card(next.level, { hard: !!next.west.hard });
    if (opts && opts.skipCard) return load(next);
    return new Promise(function (resolve) {
      CA.cardUI = TF.LevelStartUI.mount(document.body, card, function () { return load(next).then(resolve); });
      CA.cardUI.element.id = 'levelStart';
    });
  };
  // rent short: back to this level's Monday checkpoint, in place
  CA.retry = function () {
    if (!CA.monday) throw new Error('No Monday checkpoint');
    var s = CA.pending ? CA.pending.state : TF.LevelFlow.retry(CA.live('report'), CA.monday);
    if (TF.Checkpoint && !CA.pending) TF.Checkpoint.retried = (TF.Checkpoint.retried || 0) + 1;
    return load(s);
  };
  CA.resumePending = function () {
    if (!CA.pending) return;
    CA.monday = CA.pending.monday; CA.pendingDurable = true;
    return CA.advance();
  };
  // a level loaded outside the month controller (tests, debug): its Monday becomes the checkpoint, after the resets
  World.onLoad.push(function () { if (!CA.busy) { CA.monday = null; CA.captureMonday(); } });
  // boot: Level 1's Monday is the first checkpoint (a Resume restores its own)
  setTimeout(function () { if (on() && !CA.monday && TF.Week.day === 1 && TF.Week.phase === 'prep') CA.captureMonday(); }, 0);
})(window.TF);
