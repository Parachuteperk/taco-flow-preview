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
    if (TF.Econ.assets) s.flags.businessAssets = TF.Econ.assets();
    if (TF.Objects && TF.Objects.stock) s.flags.drinkStock = JSON.parse(JSON.stringify(TF.Objects.stock));
    if (TF.CastExtra) s.flags.cast = TF.CastExtra.getState();
    if (TF.Invest) s.flags.invest = JSON.parse(JSON.stringify({ metals: TF.Invest.metals, price: TF.Invest.price, lastPrice: TF.Invest.lastPrice }));
    if (TF.Aaron && TF.Aaron.live) {
      try { s.flags.aaron = TF.Aaron.live.getState(); } catch (e) { /* best-effort */ }
    }
    if (TF.Save) { var snap = TF.Save.snapshot('prep'), b = snap.buildings; s.placements = b.stands; s.buildings = b.objects; s.flags.owned = snap.flags.owned; if (snap.flags.aaron) s.flags.aaron = snap.flags.aaron; }
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
    if (TF.CastExtra) TF.CastExtra.setState(s.flags.cast);
    TF.Crew.hiredSet = { jared: true }; s.crew.hired.forEach(function (id) { TF.Crew.hiredSet[id] = true; });
    TF.Crew.extras = s.crew.extras || {};
    if (s.crew.levels) TF.Crew.levels = s.crew.levels;
    if (TF.Invest && s.flags.invest) Object.keys(s.flags.invest).forEach(function (k) { TF.Invest[k] = JSON.parse(JSON.stringify(s.flags.invest[k])); });
    if (E.restoreAssets && s.flags.businessAssets) E.restoreAssets(s.flags.businessAssets);
    (s.placements || []).forEach(function (p, i) {
      if (!p.placed) return;
      var st = Sim.stands[i] || Sim.addStand();
      if (!Sim.placeStand(p.sx, p.sy, p.rot, st).ok) throw new Error('Retry stand rejected');
      (p.line || []).forEach(function (t) { if (!Sim.addLineTile(t.x, t.y, st).ok) throw new Error('Retry line rejected'); });
      ['tier','reputation','crew','ekits','rev','sold','served','wasteAcc','needRestock','funnel'].forEach(function (k) { if (p[k] !== undefined) st[k] = JSON.parse(JSON.stringify(p[k])); });
    });
    if (TF.Objects) { TF.Objects.restore(s.buildings || []); if (TF.Objects.stock) TF.Objects.stock = JSON.parse(JSON.stringify(s.flags.drinkStock || { drinks: 0, pending: [] })); }
    // advance: placements reset per level, so physical investment records (a stand / an object) go too; retry remaps Monday's
    if (TF.Invest) TF.Invest.owned = (s.flags.owned || []).filter(function (o) { return s.retrying || (o.st === null && !(o.obj >= 0)); }).map(function (o) {
      return Object.assign({}, o, { st: o.st === null ? null : Sim.stands[o.st], obj: TF.Objects && o.obj >= 0 ? TF.Objects.list[o.obj] : null });
    });
    if (!s.flags.businessAssets) Sim.stand.tier = s.standTier;
    TF.Crew.applyMods(); TF.Crew.spotKey = '';
    TF.Mkt.openDay(); TF.Mkt.syncPrices();   // Monday's market rolls happen here, so they enter the checkpoint
    if (TF.Aaron && TF.Aaron.restore) TF.Aaron.restore(s.flags.aaron, !!TF.Crew.hiredSet.aaron);
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
      ['endCard', 'reportCard'].forEach(function (id) {
        var e = document.getElementById(id);
        if (!e) return;
        e.hidden = true;
        if (id === 'endCard' && e.dataset) {
          delete e.dataset.levelText; delete e.dataset.galaWired; delete e.dataset.galaShown;
          if (TF.LevelTextUI && TF.LevelTextUI.clearEndFlags) TF.LevelTextUI.clearEndFlags();
        }
      });
      if (TF.StoryBeats && TF.StoryBeats.clearLevelDays) TF.StoryBeats.clearLevelDays(n);
      if (TF.HintsUI && TF.HintsUI.clearLevelDays) TF.HintsUI.clearLevelDays(n);
      if (TF.CastLines && TF.CastLines.resetLevel) TF.CastLines.resetLevel();
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
    var lvl = s.level || (TF.Econ && TF.Econ.levelNo) || 1;
    if (TF.StoryBeats && TF.StoryBeats.clearLevelDays) TF.StoryBeats.clearLevelDays(lvl);
    if (TF.HintsUI && TF.HintsUI.clearLevelDays) TF.HintsUI.clearLevelDays(lvl);
    if (TF.CastLines && TF.CastLines.resetLevel) TF.CastLines.resetLevel();
    return load(s);
  };
  // Wipe campaign save so the next load is a fresh L1. Keeps loli.v6.board (local leaderboard).
  CA.clearForNewRun = function () {
    if (TF.Save && TF.Save.clear) TF.Save.clear();
    try {
      var ls = window.localStorage;
      if (ls) {
        ls.removeItem('loli.v6.bad');
        // never touch loli.v6.board
      }
    } catch (e) { /* storage blocked */ }
    try { sessionStorage.removeItem('loli.v6.retry'); } catch (e2) { /* ignore */ }
    CA.monday = null; CA.pending = null; CA.pendingDurable = false; CA.locked = false; CA._finaleBusy = false;
    if (TF.Checkpoint) { TF.Checkpoint.monday = null; TF.Checkpoint.retried = 0; }
  };
  // Retire campaign persistence before switching modes; keep the player's live stand and cash.
  CA.freePlay = function () {
    CA.clearForNewRun();
    if (TF.Save) TF.Save.disabled = true;
    TF.Week.mode = 'free'; Sim.closing = false; Sim.reopenStand();
    if (TF.ui && TF.ui.api) TF.ui.api.play();
    TF.Week.refresh(); if (TF.Crew) TF.Crew.refresh();
  };
  // L4 month complete: Gala, Results + local board, then restart or continue in place.
  CA.runFinale = function (choice, finalScore) {
    if (CA._finaleBusy) return;
    var score = finalScore === undefined ? TF.Gala.scoreFromLive(TF) : finalScore;
    TF.Gala.verdict(score);
    CA._finaleBusy = true;
    var end = document.getElementById('endCard');
    if (end) end.hidden = true;
    function goNext() {
      CA._finaleBusy = false;
      // Keep file:// (and http) base; bare pathname drops the scheme and can crash Chromium.
      var base = String(location.href || '').split('#')[0].split('?')[0] || location.pathname;
      if (choice === 'free') { CA.freePlay(); return; }
      CA.clearForNewRun();
      // Defer so Results teardown finishes before unload (avoids Chromium file:// crashes after L4).
      setTimeout(function () { location.href = base; }, 0);
    }
    function showResults(play) {
      if (!(TF.Results && TF.Results.buildPayload && TF.Results.mount)) { goNext(); return; }
      var split = TF.Ledger.split();
      var west = TF.Econ.M.getState();
      var crewStats = {};
      if (TF.Crew && TF.Crew.hired) {
        TF.Crew.hired().forEach(function (id) { crewStats[id] = { fixes: 0, sales: 0, hacks: 0 }; });
      }
      if (crewStats.matt) crewStats.matt.fixes = TF.Handyman ? TF.Handyman.fixes || 0 : 0;
      if (crewStats.antonio) crewStats.antonio.hacks = TF.Hacks && TF.Hacks.log ? TF.Hacks.log.length : 0;
      var stocks = TF.Mkt && TF.Mkt.summary ? TF.Mkt.summary().slice().sort(function (a, b) { return b.pct - a.pct; }) : [];
      var payload;
      try {
        payload = TF.Results.buildPayload({
          name: 'PLAYER',
          operatingProfitCents: split.operating,
          tradingNetCents: split.trading,
          seed: TF.Rng.seed,
          date: (function () { var d = new Date(); return d.toISOString().slice(0, 10); })(),
          bestStock: stocks.length ? stocks[0].sym : '',
          crewStats: crewStats,
          west: west
        });
      } catch (e) {
        console.warn('[campaign] Results.buildPayload', e);
        goNext();
        return;
      }
      TF.Results.mount(document.body, payload, { onClose: goNext });
    }
    if (TF.Gala && TF.Gala.mount) {
      TF.Gala.mount(document.body, score, { onDone: showResults });
    } else showResults({ won: TF.Gala.verdict(score) === 'win' });
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
