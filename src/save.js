// Saves (Pass 6A C6, PLAN §2): one versioned localStorage key, loli.v6 =
// {version, seed, day, ledger, portfolio, buildings, crew, flags, rngStates, ...}. Auto-saved at every
// PREP (boot and each new day) and after every REPORT (that one resumes into the next day's PREP).
// Resume restarts the saved day at PREP: same cash, ledger, stands + lines, objects, crew, kits, rent
// record, Exchange, RNG streams and story flags, so playing the same day again gives the same ledger and
// verdict (tests/verify c6). A migration hook upgrades older versions; anything unreadable is ignored.
(function (TF) {
  var Sim = TF.Sim, World = TF.World, KEY = 'loli.v6', VERSION = 1;
  var SV = TF.Save = { KEY: KEY, VERSION: VERSION, writes: 0, lastWrite: null, resumed: null, disabled: false };
  // JSON has no Infinity / NaN (a timer at Infinity came back as null, so Mrs. West visited at once after a
  // Resume, C6 review): non-finite numbers travel as {"$num": "Infinity"} and are revived on read.
  function enc(k, v) { return typeof v === 'number' && !isFinite(v) ? { $num: String(v) } : v; }
  function dec(k, v) { return v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.$num === 'string' ? Number(v.$num) : v; }
  function copy(o) { return JSON.parse(JSON.stringify(o, enc)); }
  SV.decode = function (raw) { return JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw), dec); };
  function store() { try { return window.localStorage; } catch (e) { return null; } }

  // The JSON-safe own fields of a module object (functions, DOM nodes and anything holding a reference
  // cycle, like a stand with its queue of guests, are skipped).
  function plain(obj, skip) {
    var out = {};
    if (!obj) return out;
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (typeof v === 'function' || (skip && skip.indexOf(k) >= 0) || (v && v.nodeType)) return;
      try { var s = JSON.stringify(v, enc); if (s !== undefined) out[k] = JSON.parse(s); } catch (e) { /* cyclic: skipped */ }
    });
    return out;
  }
  function apply(obj, snap) { if (obj && snap) Object.keys(snap).forEach(function (k) { obj[k] = snap[k]; }); }

  var SIM_KEYS = ['t', 'nextId', 'spawnT', 'thoughts', 'cookRate', 'serviceSlow', 'priceBoostT', 'crowd', 'rushT', 'nextRush', 'capExtra', 'waits', 'lost', 'demandMul', 'closing'];
  var STAND_KEYS = ['placed', 'sx', 'sy', 'rot', 'tier', 'restocks', 'rev', 'sold', 'served', 'ekits', 'wasteAcc', 'litterMul', 'needRestock'];

  // Keep recent receipts; archive older rows by day/phase/category and customer kind.
  // Cash, seed, daily totals and Gala splits stay exact, including inside Monday checkpoints.
  function ledgerSnapshot(l) {
    var rows = l.rows || [], cut = Math.max(0, rows.length - 512), groups = new Map(), old = [];
    for (var i = 0; i < cut; i++) {
      var r = rows[i];
      if (r.cat === 'rent' || r.cat === 'seed') { old.push(copy(r)); continue; }
      var cast = /^cast:([^ ]+)/.exec(r.ref || '');
      var ref = cast ? 'cast:' + cast[1] + ' archive' : 'archive';
      var key = JSON.stringify([r.day, r.phase, r.cat, ref]), a = groups.get(key);
      if (a) a.cents += r.cents;
      else groups.set(key, { day: r.day, phase: r.phase, cat: r.cat, cents: r.cents, ref: ref });
    }
    groups.forEach(function (r) { if (r.cents) old.push(r); });
    return { rows: old.concat(copy(rows.slice(cut))), cash: l.cash, seedCents: l.seedCents, unrouted: l.unrouted || 0 };
  }
  // Checkpoints carry their own ledger. Compact before copying, avoiding three huge JSON copies.
  function durable(value, key) {
    if (!value || typeof value !== 'object') return value;
    if (key === 'ledger' && Array.isArray(value.rows)) return ledgerSnapshot(value);
    if (Array.isArray(value)) return value.map(function (v) { return durable(v); });
    var out = {}; Object.keys(value).forEach(function (k) { out[k] = durable(value[k], k); }); return out;
  }
  SV.compact = function (d) {
    var out = durable(d);
    if (out.flags && out.flags.invest && out.flags.invest.history) out.flags.invest.history = out.flags.invest.history.slice(-64);
    if (out.flags && out.flags.arcs && out.flags.arcs.beats) out.flags.arcs.beats = out.flags.arcs.beats.slice(-64);
    return out;
  };
  SV.MAX_CHARS = 1500000; // <= 3 MB UTF-16, below common file:// localStorage quotas
  SV.snapshot = function (resume) {
    var W = TF.Week, E = TF.Econ, O = TF.Objects, I = TF.Invest, lv = World.level || {};
    var sim = {}; SIM_KEYS.forEach(function (k) { if (Sim[k] !== undefined) sim[k] = copy(Sim[k]); });
    var stats = {}; Object.keys(Sim.stats).forEach(function (k) { if (k !== 'money') stats[k] = Sim.stats[k]; });
    return {
      version: VERSION, seed: TF.Rng.seed, savedAt: Date.now(), resume: resume,
      day: W.day, level: { id: lv.id || 'L1', data: lv.id && lv.id !== 'L1' ? lv : null },
      ledger: ledgerSnapshot(TF.Ledger),
      rngStates: TF.Rng.getState(),
      week: { results: copy(W.results), earnTotal: W.earnTotal || 0, bellSpawned: W.bellSpawned || 0 },
      econ: E && E.K ? { stock: E.K.getState(), west: E.M.getState(), levelNo: E.levelNo, rent: E.rent, wasted: E.wasted || 0, spoil: copy(E.spoil || []), last: E.last || null, autoOrders: copy(E.autoOrders || []), want: E.want } : null,
      portfolio: TF.Market ? { x: TF.Market.getState(), open: TF.Mkt.open, weekStart: TF.Mkt.weekStart, log: TF.Mkt.log } : null,
      buildings: {
        stands: Sim.stands.map(function (st) { var s = {}; STAND_KEYS.forEach(function (k) { if (st[k] !== undefined) s[k] = st[k]; }); s.line = copy(st.line); return s; }),
        objects: O ? O.list.map(function (o) { return { kind: o.kind, x: o.x, y: o.y, st: o.st ? o.st.idx : 0, ready: o.ready, day: o.day, binned: o.binned || 0 }; }) : [],
        build: TF.Build ? { started: TF.Build.started, finished: TF.Build.finished } : null
      },
      crew: { hired: TF.Crew.hired(), extras: copy(TF.Crew.extras) },
      sim: sim, stats: stats,
      flags: {
        objects: O ? { day: O.day, totals: O.totals, litterStats: O.litterStats, shadeStats: O.shadeStats, litter: O.litter } : null,   // overnight litter stays (it cuts demand)
        invest: I ? plain(I, ['owned', 'sig', 'rng']) : null,
        owned: I ? I.owned.map(function (o) { return { id: o.id, cost: o.cost, st: o.st ? o.st.idx : null, rev0: o.rev0, obj: o.obj && O ? O.list.indexOf(o.obj) : -1, day: o.day, name: o.name }; }) : [],
        story: plain(TF.Story, ['walker', 'verdict', 'verdictTimer']),
        arcs: plain(TF.Arcs, ['rng', 'rant']), bets: plain(TF.Bets, ['card']), hacks: plain(TF.Hacks, ['run']),
        events: plain(TF.Events, ['west']), supply: TF.Supply ? { trips: TF.Supply.trips, tripsByStand: TF.Supply.tripsByStand, soldOutSeconds: TF.Supply.soldOutSeconds } : null,
        handyman: TF.Handyman && TF.Handyman.M ? { m: TF.Handyman.M.getState(), day: TF.Handyman.day, fixes: TF.Handyman.fixes, faultsSeen: TF.Handyman.faultsSeen } : null,
        checkpoint: TF.Checkpoint ? durable(TF.Checkpoint.monday) : null, retried: TF.Checkpoint ? TF.Checkpoint.retried : 0,
        campaign: TF.Campaign ? { monday: durable(TF.Campaign.monday), pending: durable(TF.Campaign.pending) } : null,   // the month's Monday checkpoint (6B B2)
        castExtra: TF.CastExtra && TF.CastExtra.getState ? TF.CastExtra.getState() : null,   // regulars remember: Brendan's tab, Lukas, inspections (chunk 3)
        aaron: TF.Aaron && TF.Aaron.live ? TF.Aaron.live.getState() : null
      }
    };
  };

  // Older saves are upgraded here, one version at a time; a save from the future is not read.
  SV.migrate = function (d) {
    if (!d || typeof d.version !== 'number') return null;
    // (v1 is the first; e.g. if (d.version === 1) { ...; d.version = 2; })
    if (d.version > VERSION) SV.future = true;   // written by a newer build: leave it alone (no auto-saves over it)
    return d.version === VERSION ? d : null;
  };
  // ---- validation: a save is used only if it is complete and consistent (C6 hard review) -----------------
  // shape(live, saved): every key the live module state has (recursively, for plain objects) must be
  // there in the save with the same kind of value, so restored modules never dereference a missing field.
  function kind(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }
  function shape(live, saved, path, depth) {
    if (kind(live) !== kind(saved)) {
      // null is fine only where the field is null by design (West's report before Friday, the Exchange's last close)
      if (live === null || (saved === null && /\.(report|lastClose)$/.test(path))) return null;
      return path + ': ' + kind(saved) + ' (want ' + kind(live) + ')';
    }
    if (kind(live) !== 'object' || depth > 4) return null;
    var keys = Object.keys(live);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'scheduledCatalysts' && saved[k] === undefined) continue; // pre-inspection saves
      if (!(k in saved)) return path + '.' + k + ' missing';
      // keyed-by-day / -by-symbol maps hold whatever days or tickers there are: check only fixed-shape objects
      if (/^(holdings|prices|preRolls|publicCatalysts|fineDays|weeks|weeklyCounts|active|permits|ctx|openPrices)$/.test(k)) continue;
      var e = shape(live[k], saved[k], path + '.' + k, depth + 1);
      if (e) return e;
    }
    return null;
  }
  function rngComplete(st) {
    if (!st || typeof st !== 'object') return 'rngStates missing';
    var need = Object.keys(TF.Rng.streams);
    for (var i = 0; i < need.length; i++) {
      var v = st[need[i]];
      if (typeof v !== 'number') return 'rng stream ' + need[i] + ' missing';
      if (!Number.isInteger(v) || v < -2147483648 || v > 4294967295) return 'rng stream ' + need[i] + ' not a 32-bit state';
    }
    return null;
  }
  function int(v) { return Number.isSafeInteger(v); }
  // the ledger adds up: integer cents everywhere, cash = seed + every other row, seed = the seed rows (B1 review)
  function ledgerOk(L) {
    if (!L || !Array.isArray(L.rows) || !int(L.cash) || !int(L.seedCents)) return 'ledger';
    var seed = 0, rest = 0;
    for (var i = 0; i < L.rows.length; i++) {
      var r = L.rows[i];
      if (!r || typeof r.cat !== 'string' || !int(r.cents) || !int(r.day)) return 'ledger row ' + i;
      if (r.cat === 'seed') seed += r.cents; else rest += r.cents;
    }
    if (seed !== L.seedCents) return 'ledger seed ' + L.seedCents + ' vs rows ' + seed;
    if (L.cash !== seed + rest) return 'ledger cash ' + L.cash + ' vs seed + rows ' + (seed + rest);
    return null;
  }
  function tileIn(x, y, W, H) { return int(x) && int(y) && x >= 0 && y >= 0 && x < W && y < H; }
  // the rest of the payload: every part a resumed day reads, with the right types and on the map
  function parts(d) {
    var lv = TF.LEVELS[d.level && d.level.id] || (d.level && d.level.data);
    if (!d.level || typeof d.level.id !== 'string' || !lv || !int(lv.w) || !int(lv.h)) return 'level';
    var W = lv.w, H = lv.h;
    if (d.flags && d.flags.objects && (!Array.isArray(d.flags.objects.litter) || !d.flags.objects.litter.every(function (l) { return l && ['x','y','t','rot'].every(function (k) { return Number.isFinite(l[k]); }) && typeof l.col === 'string'; }))) return 'litter';
    if (!d.sim || typeof d.sim !== 'object' || typeof d.sim.t !== 'number' || !d.stats || typeof d.stats !== 'object') return 'sim / stats';
    if (!d.flags || typeof d.flags !== 'object' || !d.flags.objects || !Array.isArray(d.flags.objects.litter) || !d.flags.story || !d.flags.events || !d.flags.arcs) return 'flags';
    if (!d.week || !Array.isArray(d.week.results) || !d.week.results.every(function (r) { return r && int(r.day) && typeof r.sold === 'number'; })) return 'week results';
    if (!d.crew || !Array.isArray(d.crew.hired) || !d.crew.hired.every(function (h) { return typeof h === 'string'; }) || typeof d.crew.extras !== 'object' || !d.crew.extras) return 'crew';
    if (d.flags.aaron && TF.Aaron && TF.Aaron.create) {
      try {
        var probe = TF.Aaron.create({rng: {next: function () { return 0; }, getState: function () { return 0; }, setState: function () {}}, getCash: function () { return 0; }, postTransaction: function () { throw new Error('validation must not spend'); }});
        probe.setState(d.flags.aaron);
        if (d.flags.aaron.hired !== (d.crew.hired.indexOf('aaron') >= 0)) return 'Aaron roster mismatch';
      } catch (aaronError) { return 'Aaron: ' + aaronError.message; }
    }
    var cast = d.flags.castExtra;
    if (cast && (!cast.brendan || !int(cast.brendan.owed) || cast.brendan.owed < 0 || !int(cast.brendan.repaid) || cast.brendan.repaid < 0 ||
        !int(cast.brendan.lost) || cast.brendan.lost < 0 || !Array.isArray(cast.brendan.visits) || !cast.brendan.visits.every(function (n) { return int(n) && n >= 1 && n <= 20; }) ||
        !cast.met || typeof cast.met !== 'object' || !Array.isArray(cast.inspections) || !cast.inspections.every(function (i) { return i && int(i.day) && typeof i.pass === 'boolean'; }))) return 'cast memory';
    var I = d.flags.invest;
    if (TF.Invest) {
      if (!I || !I.metals || !I.price || !I.lastPrice || !['gold', 'silver'].every(function (m) {
        var h = I.metals[m];
        return h && int(h.units) && h.units >= 0 && Number.isFinite(h.paid) && h.paid >= 0 && Number.isFinite(I.price[m]) && I.price[m] > 0 && Number.isFinite(I.lastPrice[m]) && I.lastPrice[m] > 0;
      })) return 'invest metals';
    }
    var b = d.buildings;
    if (!b || !Array.isArray(b.stands) || !b.stands.length || b.stands.length > 2 || !Array.isArray(b.objects)) return 'buildings';
    for (var i = 0; i < b.stands.length; i++) {
      var st = b.stands[i];
      if (st && !st.placed && st.line && st.line.length) return 'unplaced stand line';
      if (!st || typeof st.placed !== 'boolean' || !int(st.tier) || st.tier < 0 || st.tier > 7 || !Array.isArray(st.line)) return 'stand ' + i;
      if (st.placed && (!tileIn(st.sx, st.sy, W - 1, H - 1) || !int(st.rot) || st.rot < 0 || st.rot > 3)) return 'stand ' + i + ' position';
      for (var j = 0; j < st.line.length; j++) if (!st.line[j] || !tileIn(st.line[j].x, st.line[j].y, W, H)) return 'stand ' + i + ' line';
    }
    for (i = 0; i < b.objects.length; i++) { var o = b.objects[i]; if (!o || typeof o.kind !== 'string' || !TF.Objects.KINDS[o.kind] || !tileIn(o.x, o.y, W - TF.Objects.KINDS[o.kind].w + 1, H - TF.Objects.KINDS[o.kind].h + 1) || !int(o.st) || !b.stands[o.st] || !b.stands[o.st].placed || typeof o.ready !== 'boolean') return 'object ' + i; }
    if (!Array.isArray(d.flags.owned) || !d.flags.owned.every(function (o) {
      return o && typeof o.id === 'string' && Number.isFinite(o.cost) && Number.isFinite(o.rev0) && int(o.day) && typeof o.name === 'string' &&
        (o.st === null || (int(o.st) && !!b.stands[o.st])) && int(o.obj) && o.obj >= -1 && o.obj < b.objects.length;
    })) return 'owned references';
    return null;
  }
  // level / week / day / phase of every module agree with the save's day and resume point
  function identity(d) {
    var lvl = d.econ ? d.econ.levelNo || 1 : 1, abs = (lvl - 1) * 5 + d.day, report = d.resume === 'report';
    if (!(int(d.day) && d.day >= 1 && d.day <= 5)) return 'day ' + d.day;
    var mapLvl = +((/\d+/.exec(d.level.id) || [])[0]);
    var lvData = TF.LEVELS[d.level.id] || d.level.data;
    if ((lvData && lvData.economyLevel ? lvData.economyLevel : mapLvl) !== lvl) return 'map ' + d.level.id + ' vs economy level ' + lvl;
    if (d.econ) {
      var k = d.econ.stock, w = d.econ.west;
      if (k.level !== lvl || k.day !== abs || k.phase !== (report ? 'report' : 'prep')) return 'stock ' + k.level + '/' + k.day + '/' + k.phase + ' vs level ' + lvl + ' day ' + abs;
      if (w.level !== lvl || w.week !== lvl) return 'west level ' + w.level + ' week ' + w.week + ' vs ' + lvl;
    }
    if (d.portfolio) {
      var x = d.portfolio.x;
      if (x.day !== abs || x.phase !== (report ? 'close' : 'prep')) return 'exchange ' + x.day + '/' + x.phase + ' vs day ' + abs;
    }
    return null;
  }
  SV.validate = function (d) {
    var E = TF.Econ, e;
    try { d = SV.decode(d); } catch (err) { return 'unreadable'; }
    if (!d || typeof d !== 'object') return 'unreadable';
    if (!int(d.seed) || d.seed < 0 || d.seed > 4294967295) return 'seed';
    if (d.portfolio && (!d.portfolio.x || !d.portfolio.x.holdings || Array.isArray(d.portfolio.x.holdings))) return 'holdings';
    if (d.portfolio && d.portfolio.x.seed !== (d.seed ^ 0xE8C4) && d.portfolio.x.seed !== d.seed) return 'exchange seed';
    if (d.resume !== 'prep' && d.resume !== 'report') return 'resume kind';
    if ((e = ledgerOk(d.ledger))) return e;
    if ((e = rngComplete(d.rngStates))) return e;
    if ((e = parts(d))) return e;
    if (E && E.K && !d.econ) return 'econ missing';
    if (d.econ && ((e = shape(E.K.getState(), d.econ.stock, 'stock', 0)) || (e = shape(E.M.getState(), d.econ.west, 'west', 0)))) return e;
    if (TF.Market && !d.portfolio) return 'exchange missing';
    if (d.portfolio && (e = shape(TF.Market.getState(), d.portfolio.x, 'exchange', 0))) return e;
    if (d.portfolio && TF.LevelFlow && d.econ) {
      try { TF.LevelFlow.validate({ level: d.econ.levelNo, mapId: d.level.id, seed: d.seed, day: d.day, absoluteDay: (d.econ.levelNo - 1) * 5 + d.day, phase: d.resume, ledger: d.ledger, rng: d.rngStates, stock: d.econ.stock, west: d.econ.west, exchange: d.portfolio.x, crew: { hired: d.crew.hired, levels: {}, extras: d.crew.extras }, standTier: d.buildings.stands[0].tier, flags: {} }); }
      catch (err) { return 'campaign state: ' + err.message; }
    }
    if ((e = identity(d))) return e;
    var cm = d.flags && d.flags.campaign && d.flags.campaign.monday;   // the month controller's Monday checkpoint
    if (cm) {
      var cl = d.econ ? d.econ.levelNo || 1 : 1;
      if (cm.version !== 1 || cm.level !== cl || !cm.state || cm.state.level !== cl || cm.state.seed !== d.seed) return 'campaign checkpoint level';
      if (TF.LevelFlow) { try { TF.LevelFlow.captureMonday(cm.state); } catch (err) { return 'campaign checkpoint: ' + err.message; } }
    }
    var pending = d.flags.campaign && d.flags.campaign.pending;
    if (pending) {
      try {
        TF.LevelFlow.captureMonday(pending.state); TF.LevelFlow.captureMonday(pending.monday.state);
        if (pending.state.seed !== d.seed || pending.monday.state.seed !== d.seed || pending.monday.level !== (d.econ.levelNo || 1) || pending.state.level !== pending.monday.level + (pending.state.retrying ? 0 : 1)) return 'pending identity';
      } catch (err) { return 'pending: ' + err.message; }
    }
    var cp = d.flags && d.flags.checkpoint;   // the embedded Monday checkpoint has to be usable too
    if (cp) {
      var lvl = d.econ ? d.econ.levelNo || 1 : 1, monday = (lvl - 1) * 5 + 1;
      if (cp.levelId !== d.level.id || cp.level !== lvl) return 'checkpoint level ' + cp.levelId + '/' + cp.level + ' vs ' + d.level.id + '/' + lvl;
      if ((e = ledgerOk(cp.ledger))) return 'checkpoint ' + e;
      if ((e = rngComplete(cp.rng))) return 'checkpoint ' + e;
      if (E && E.K && (!cp.stock || (e = shape(E.K.getState(), cp.stock, 'checkpoint.stock', 0)))) return e || 'checkpoint stock missing';
      if (TF.Market && (!cp.market || (e = shape(TF.Market.getState(), cp.market, 'checkpoint.exchange', 0)))) return e || 'checkpoint exchange missing';
      if (cp.stock.level !== lvl || cp.stock.day !== monday || cp.stock.phase !== 'prep') return 'checkpoint stock ' + cp.stock.level + '/' + cp.stock.day + '/' + cp.stock.phase + ' vs Monday ' + monday;
      if (cp.market && (cp.market.day !== monday || cp.market.phase !== 'prep')) return 'checkpoint exchange ' + cp.market.day + '/' + cp.market.phase + ' vs Monday ' + monday;
      if (!Array.isArray(cp.roster)) return 'checkpoint roster';
    }
    return null;
  };
  SV.read = function () {
    var ls = store(), raw = null;
    try { raw = ls && ls.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) return null;
    var d;
    try { d = SV.migrate(SV.decode(raw)); } catch (e) { return null; }
    if (!d) return null;
    var why = SV.validate(d);
    if (why) { SV.rejected = why; return null; }   // incomplete or inconsistent: never restored
    return d;
  };
  SV.write = function (resume) {
    if (SV.disabled || (TF.Campaign && TF.Campaign.locked && !TF.Campaign.persisting) || !TF.Week || !TF.Week.active() || !TF.Econ || !TF.Econ.on()) return false;
    var ls = store();
    if (!ls) return false;
    try { var d = SV.compact(SV.snapshot(resume)), raw = JSON.stringify(d);
      if (raw.length > SV.MAX_CHARS) throw new Error('save exceeds size budget');
      ls.setItem(KEY, raw); SV.writes++; SV.lastWrite = { day: d.day, resume: resume }; return true; }
    catch (e) { SV.writeError = e.message; return false; }   // quota / blocked storage: play on without saves
  };
  SV.clear = function () { var ls = store(); try { if (ls) ls.removeItem(KEY); } catch (e) { /* ignore */ } };

  // ---- Resume: restart the saved day at PREP ------------------------------------------------------------
  SV.restore = function (d, importing) {
    var W = TF.Week, E = TF.Econ, O = TF.Objects, I = TF.Invest, L = TF.Ledger;
    SV.disabled = true; SV.restoring = true;   // no auto-saves or Aaron phase sync while rebuilding
    try {
      var invalid = SV.validate(d); if (invalid) throw new Error(invalid);
      d = SV.compact(d);
      // always from a clean copy of the saved level: nothing placed today survives (B1 review: an import kept
      // the current stand on top of the saved state)
      TF.LEVELS[d.level.id] = TF.LEVELS[d.level.id] || d.level.data;
      TF.Rng.seed = d.seed;
      World.loadLevel(TF.LEVELS[d.level.id]);
      Sim.sel = 0;
      // stands, lines and tiers on the map
      Sim.guests = []; Sim.floaters = []; Sim.flyers = [];
      d.buildings.stands.forEach(function (s, i) {
        var st = Sim.stands[i] || Sim.addStand();
        if (!st || !s.placed) return;
        var placed = Sim.placeStand(s.sx, s.sy, s.rot, st);
        if (!placed.ok) throw new Error('stand ' + i + ' cannot be placed (' + (placed.reason || 'blocked') + ')');
        (s.line || []).forEach(function (t) { if (!Sim.addLineTile(t.x, t.y, st).ok) throw new Error('Rejected line placement'); });
        STAND_KEYS.forEach(function (k) { if (s[k] !== undefined && k !== 'placed' && k !== 'sx' && k !== 'sy' && k !== 'rot') st[k] = s[k]; });
      });
      if (O && O.restore) O.restore(d.buildings.objects);
      if (TF.Build && d.buildings.build) { TF.Build.jobs = []; TF.Build.started = d.buildings.build.started; TF.Build.finished = d.buildings.build.finished; }
      TF.Crew.hiredSet = { jared: true }; d.crew.hired.forEach(function (id) { TF.Crew.hiredSet[id] = true; });
      TF.Crew.extras = d.crew.extras || {};
      // money, randomness, the economy and the market
      L.rows = d.ledger.rows; L.cash = d.ledger.cash; L.seedCents = d.ledger.seedCents; L.unrouted = d.ledger.unrouted || 0;
      TF.Rng.setState(d.rngStates);
      if (E && d.econ) {
        E.levelNo = d.econ.levelNo || 1; E.K.setState(d.econ.stock); E.M.setState(d.econ.west);
        E.rent = d.econ.rent; E.wasted = d.econ.wasted; E.spoil = d.econ.spoil; E.last = d.econ.last; E.autoOrders = d.econ.autoOrders; if (d.econ.want) E.want = d.econ.want;
      }
      if (TF.Market && d.portfolio) { TF.Market.setState(d.portfolio.x); TF.Mkt.open = d.portfolio.open || {}; TF.Mkt.weekStart = d.portfolio.weekStart || {}; TF.Mkt.log = d.portfolio.log || []; }
      // the sim's clock and counters, the week, and the modules' own flags
      apply(Sim, d.sim); apply(Sim.stats, d.stats);
      W.results = d.week.results; W.earnTotal = d.week.earnTotal; W.bellSpawned = d.week.bellSpawned;
      var f = d.flags || {};
      if (O && f.objects) apply(O, f.objects);
      if (I && f.invest) { apply(I, f.invest); I.owned = (f.owned || []).map(function (o) { return { id: o.id, cost: o.cost, st: o.st === null ? null : Sim.stands[o.st], rev0: o.rev0, obj: O && o.obj >= 0 ? O.list[o.obj] : null, day: o.day, name: o.name }; }); }
      apply(TF.Story, f.story); apply(TF.Arcs, f.arcs); apply(TF.Bets, f.bets); apply(TF.Hacks, f.hacks); apply(TF.Events, f.events);
      if (TF.Supply && f.supply) apply(TF.Supply, f.supply);
      if (TF.Handyman && f.handyman) { TF.Handyman.M = null; TF.Handyman.step && TF.Handyman.on() && TF.Handyman.step(0); if (TF.Handyman.M) { TF.Handyman.M.setState(f.handyman.m); TF.Handyman.day = f.handyman.day; TF.Handyman.S = TF.Handyman.M.getState(); } TF.Handyman.fixes = f.handyman.fixes; TF.Handyman.faultsSeen = f.handyman.faultsSeen; }
      if (TF.Checkpoint && f.checkpoint) { TF.Checkpoint.monday = f.checkpoint; TF.Checkpoint.retried = f.retried || 0; }
      if (TF.Campaign && f.campaign) { TF.Campaign.monday = f.campaign.monday || null; TF.Campaign.pending = f.campaign.pending || null; }
      if (TF.CastExtra && TF.CastExtra.setState) TF.CastExtra.setState(f.castExtra);
      // Restore Aaron before Week.refresh can start a day or charge a wage.
      if (TF.Aaron && TF.Aaron.restore) TF.Aaron.restore(f.aaron, !!TF.Crew.hiredSet.aaron);
      else if (TF.Aaron) TF.Aaron.pendingRestore = { state: f.aaron, hired: !!TF.Crew.hiredSet.aaron };
      // the day itself: PREP of the saved day (an after-REPORT save moves on to the next day's PREP; Friday's
      // REPORT comes back as that week's verdict, with its retry)
      W.setDayForResume(d.day, d.resume === 'report');
      TF.Crew.applyMods(); TF.Crew.spotKey = '';
      if (E) E.sync();
      SV.resumed = { day: W.day, from: d.resume };
    } catch (err) {
      // a save that validated but still fails to apply: put it aside and start clean rather than play on half-restored
      SV.disabled = false; SV.rejected = 'restore failed: ' + err.message;
      if (importing) return false;
      // Remove the bad slot first: copying a quota-sized save to .bad used to throw
      // before removal, so each automatic reload offered the same broken save again.
      var ls = store();
      try { if (ls) ls.removeItem(KEY); } catch (e2) { /* blocked storage */ }
      try { if (ls) ls.setItem(KEY + '.bad', JSON.stringify({reason: SV.rejected, savedAt: d && d.savedAt})); } catch (e3) { /* diagnostics are optional */ }
      if (!SV.noReload) location.reload();
      return false;
    } finally { SV.disabled = false; SV.restoring = false; }
    if (TF.Campaign && TF.Campaign.pending && !importing) { TF.Campaign.resumePending(); return true; }
    if (!importing) SV.write(d.resume === 'report' && d.day >= 5 ? 'report' : 'prep');
    return true;
  };

  // ---- the Resume card at boot -------------------------------------------------------------------------
  var card = document.getElementById('resumeCard');
  SV.offer = function () {
    var d = SV.read();
    if (!d || !card || !(TF.Week && TF.Week.active())) return false;
    if (TF.Checkpoint && TF.Checkpoint.justRestored) return false;   // a Monday retry just reloaded: that is the game
    if (window.__autotest && !/[?&]offer=1/.test(location.search)) return false;   // test runs start fresh unless they ask
    var day = d.resume === 'report' ? d.day + 1 : d.day;
    card.querySelector('.txt').textContent = day > 5 ? 'Resume Friday\u2019s verdict ($' + (d.ledger.cash / 100).toFixed(2) + ')?'
      : 'Resume Day ' + day + ' (PREP) with $' + (d.ledger.cash / 100).toFixed(2) + '?';
    card.hidden = false;
    return true;
  };
  if (card) {
    card.querySelector('#btnResume').addEventListener('click', function () { var d = SV.read(); card.hidden = true; if (d) SV.restore(d); });
    card.querySelector('#btnNewGame').addEventListener('click', function () { card.hidden = true; SV.clear(); SV.write('prep'); });
  }
  // ---- export / import (PLAN §2): the same JSON as loli.v6, through the same migration + validation -------
  // The export is the durable save: refreshed in PREP (nothing has happened since it), as-is otherwise. During
  // OPEN that's this morning's PREP save, never the live day (B1 review: exporting mid-day overwrote it with an
  // OPEN state no Resume can use).
  SV.exportJSON = function () {
    if (TF.Week && TF.Week.phase === 'prep') SV.write('prep');
    var ls = store(), raw = null; try { raw = ls ? ls.getItem(KEY) : null; } catch (e) { raw = null; }
    return raw && SV.read() ? raw : null;
  };
  // Imports can fail after destructive level resets. Keep the live object graph, including
  // cyclic guest/stand/job references and accessors, rather than resuming a day-start save.
  function importRollback() {
    var seen = new Set(), records = [], states = [];
    function visit(obj) {
      if (!obj || typeof obj !== 'object' || obj.nodeType || seen.has(obj)) return;
      seen.add(obj);
      if (ArrayBuffer.isView(obj)) { records.push({ obj: obj, bytes: obj.slice() }); return; }
      var props = Object.getOwnPropertyDescriptors(obj);
      records.push({ obj: obj, props: props });
      Object.keys(props).forEach(function (k) { if ('value' in props[k]) visit(props[k].value); });
    }
    visit(TF);
    [TF.Econ && TF.Econ.K, TF.Econ && TF.Econ.M, TF.Market, TF.Handyman && TF.Handyman.M, TF.Aaron && TF.Aaron.live].forEach(function (m) {
      if (m && m.getState && m.setState) states.push({ module: m, state: m.getState() });
    });
    var level = World.level;
    return function () {
      // Rebuild private map/search buffers at the original dimensions before restoring live fields.
      SV.disabled = true;
      World.loadLevel(level);
      records.forEach(function (r) {
        if (r.bytes) { r.obj.set(r.bytes); return; }
        Object.keys(r.obj).forEach(function (k) { if (!(k in r.props)) delete r.obj[k]; });
        Object.defineProperties(r.obj, r.props);
      });
      states.forEach(function (r) { r.module.setState(r.state); });
      if (TF.ui && TF.ui.restoreCamera) TF.ui.restoreCamera();
    };
  }
  SV.importJSON = function (text) {
    var d;
    try { d = SV.migrate(SV.decode(text)); } catch (e) { return { ok: false, why: 'not a save file' }; }
    if (!d) return { ok: false, why: SV.future ? 'made by a newer version' : 'not a save file' };
    var why = SV.validate(d);
    if (why) return { ok: false, why: why };
    var rollback = importRollback();
    if (!SV.restore(d, true)) { var rejected = SV.rejected; rollback(); return { ok: false, why: rejected }; }
    try { var raw = JSON.stringify(SV.compact(d), enc);
      if (raw.length > SV.MAX_CHARS) throw new Error('save exceeds size budget');
      store().setItem(KEY, raw); }
    catch (e) { rollback(); return { ok: false, why: 'storage blocked' }; }
    return { ok: true };
  };
  var ex = document.getElementById('btnSaveExport'), im = document.getElementById('saveImportFile');
  if (ex) ex.addEventListener('click', function () {
    var json = SV.exportJSON(); if (!json) return;
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'lolis-connection-day' + TF.Week.day + '.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
  if (im) im.addEventListener('change', function () {
    var f = im.files && im.files[0]; if (!f) return;
    f.text().then(function (t) { var r = SV.importJSON(t); Sim.events.push({ type: 'toast', text: r.ok ? '\uD83D\uDCBE Save imported: Day ' + TF.Week.day + ' PREP.' : 'Can\u2019t import that save: ' + r.why }); im.value = ''; });
  });
  // a level load is a new Monday: save it (after the level's resets and its Monday checkpoint; not while restoring)
  World.onLoad.push(function () { if (!SV.disabled) SV.write('prep'); });
  if (TF.Campaign && !TF.Campaign.monday && TF.Week.day === 1 && TF.Week.phase === 'prep') TF.Campaign.captureMonday();
  if (TF.Week && !TF.Week.active()) { // explicit Free play boot retires campaign and retry slots
    if (TF.Campaign && TF.Campaign.clearForNewRun) TF.Campaign.clearForNewRun(); else SV.clear();
  }
  if (!SV.offer()) { if (SV.future) SV.disabled = true; else SV.write('prep'); }   // boot: Day 1 PREP is the first save (unless there's one to resume)
})(window.TF);
