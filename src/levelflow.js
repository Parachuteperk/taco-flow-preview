// Pure JSON rules; no globals, storage, DOM, clock or campaign RNG draws. See the integration report
// for the explicit state boundary. PLAN §1a: stand placement, buildings and tiers reset.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    require('../data/economy'), require('../data/calendar'), require('./west'), require('./stock'), require('./exchange'));
  else { root.TF = root.TF || {}; root.TF.LevelFlow = factory(
    root.TF.Economy, root.TF.CALENDAR, root.TF.West, root.TF.Stock, root.TF.Exchange); }
}(typeof window !== 'undefined' ? window : this, function (Economy, Calendar, West, Stock, Exchange) {
  'use strict';
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function level(n) {
    if (!Number.isSafeInteger(n) || n < 1 || n > 4) throw new RangeError('Level must be 1..4');
    return Economy.levels[n - 1];
  }
  function cents(n) {
    if (!Number.isSafeInteger(n)) throw new TypeError('Money must be safe integer cents');
    return n;
  }
  function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  // Reject values JSON would silently erase or change before checkpointing.
  function json(v) {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if (Array.isArray(v) && Object.keys(v).length !== v.length) throw new TypeError('State must be lossless JSON');
    if (Array.isArray(v) || (object(v) && Object.prototype.toString.call(v) === '[object Object]')) { Object.keys(v).forEach(function (k) { json(v[k]); }); return; }
    throw new TypeError('State must be lossless JSON');
  }
  function shape(template, value, path) {
    if (template === null) return;
    if (Array.isArray(template)) {
      if (!Array.isArray(value)) throw new TypeError('Missing array: ' + path);
    } else if (object(template)) {
      if (!object(value)) throw new TypeError('Missing object: ' + path);
      Object.keys(template).forEach(function (k) {
        if (!Object.prototype.hasOwnProperty.call(value, k)) throw new TypeError('Missing state: ' + path + '.' + k);
        shape(template[k], value[k], path + '.' + k);
      });
    } else if (typeof template !== typeof value) throw new TypeError('Invalid state: ' + path);
  }
  function whole(n) { return Number.isSafeInteger(n) && n >= 0; }
  function validateModules(s) {
    var hooks = { getCash: function () { return 0; }, postTransaction: function () {} };
    shape(West.create(hooks).getState(), s.west, 'west');
    shape(Stock.create(hooks).getState(), s.stock, 'stock');
    var exchangeShape = Exchange.create({ seed: s.seed }).getState();
    // Keep legacy full-board campaigns and pass6's three-ticker market intact.
    // Never recreate a live Exchange: that would lose its portfolio and pre-rolls.
    var liveMarket = s.exchange && Array.isArray(s.exchange.tickers) && s.exchange.tickers.length === 3;
    if (liveMarket) {
      var liveTickers = exchangeShape.tickers.filter(function (t) {
        return ['GOLD', 'TACO', 'NAPZ'].indexOf(t.sym) >= 0;
      }).map(function (t) { t.opensDay = 1; return t; });
      exchangeShape = Exchange.create({ seed: s.seed ^ 0xE8C4, tickers: liveTickers }).getState();
    }
    shape(exchangeShape, s.exchange, 'exchange');
    var w = s.west, k = s.stock, x = s.exchange;
    if (w.mood < 0 || w.mood > 10 || !whole(w.mood) || w.attempts.length !== 4 ||
        !w.attempts.every(whole) || !w.attempts[s.level - 1] || w.rentRecords.length !== 4 ||
        !w.rentRecords.every(function (r) { return ['unpaid', 'firstTry', 'retry'].indexOf(r) >= 0; })) throw new Error('Invalid West campaign');
    if (w.report !== null) {
      shape({ paid: false, early: false, firstTry: false, retry: false }, w.report, 'west.report');
      if (w.report.paid !== w.paid || w.report.early !== w.early ||
          w.report.retry !== (!w.paid && !(w.hard && s.level === Economy.hard.noRetryLevel))) throw new Error('Inconsistent rent report');
    }
    var rent = s.ledger.rows.filter(function (r) { return r.cat === 'rent' && r.day > (s.level - 1) * 5 && r.day <= s.level * 5; });
    var due = Math.round(level(s.level).rentCents * (w.hard ? Economy.hard.rentMult : 1));
    if (rent.length !== (w.paid ? 1 : 0) || (w.paid && rent[0].cents !== -due) ||
        (w.early && !w.paid)) throw new Error('Rent ledger/West mismatch');
    ['standKits', 'vanKits', 'stockMax', 'orderedToday'].forEach(function (key) {
      if (!whole(k[key])) throw new Error('Invalid stock: ' + key);
    });
    if (!whole(k.day) || k.day < (s.level - 1) * 5 + 1 || k.day > s.level * 5 ||
        ['prep', 'open', 'report'].indexOf(k.phase) < 0 ||
        !Object.prototype.hasOwnProperty.call(level(s.level).prices, k.tier) || !whole(k.priceAdd)) throw new Error('Invalid stock day/price');
    k.pending.forEach(function (d) { if (!object(d) || !whole(d.kits) || !Number.isFinite(d.etaS) || d.etaS < 0) throw new Error('Invalid delivery'); });
    var exchangeSeed = liveMarket ? (s.seed ^ 0xE8C4) : s.seed;
    if ((liveMarket && !Number.isSafeInteger(s.seed)) || x.seed !== exchangeSeed || !whole(x.rngState) || x.rngState > 4294967295 || !whole(x.day) || x.day > 20 ||
        ['idle', 'prep', 'close'].indexOf(x.phase) < 0) throw new Error('Invalid Exchange identity/RNG');
    if (x.tickers.length !== exchangeShape.tickers.length) throw new Error('Missing Exchange tickers');
    x.tickers.forEach(function (t, i) {
      shape(exchangeShape.tickers[i], t, 'exchange.tickers');
      if (t.sym !== exchangeShape.tickers[i].sym || t.opensDay !== exchangeShape.tickers[i].opensDay) throw new Error('Invalid Exchange ticker');
      if (!t || typeof t.sym !== 'string' || !whole(x.prices[t.sym]) || x.prices[t.sym] < 100 || x.prices[t.sym] > 50000 ||
          !whole(x.holdings[t.sym]) || x.holdings[t.sym] > 20) throw new Error('Invalid Exchange portfolio');
    });
    if (x.day > 0) {
      if (!object(x.openPrices)) throw new Error('Missing Exchange opening prices');
      x.tickers.forEach(function (t) {
        if (t.opensDay > x.day) return;
        var r = x.preRolls[t.sym];
        shape({ p: 50, dir: 'up', v: 0, fromCents: 100, failedHack: false }, r, 'exchange.preRolls');
        if (!whole(r.fromCents) || !['up', 'down'].includes(r.dir) || r.p < 15 || r.p > 85 || r.v < 0 ||
            (r.finalCents !== undefined && (!whole(r.finalCents) || r.finalCents < 100 || r.finalCents > 50000)) ||
            !whole(x.openPrices[t.sym])) throw new Error('Invalid Exchange roll');
      });
    }
    Object.keys(x.scores.weeks).forEach(function (week) { shape(exchangeShape.scores.month, x.scores.weeks[week], 'exchange.scores.weeks'); });
    ['soldOut', 'tooPricey'].forEach(function (key) { if (!whole(k.lost[key])) throw new Error('Invalid stock losses'); });
    if (!whole(k.yesterday.kits) || !Object.prototype.hasOwnProperty.call(level(s.level).prices, k.yesterday.tier)) throw new Error('Invalid stock history');
    ['customers', 'market', 'events', 'objects', 'wager', 'story', 'ambient', 'matt'].forEach(function (key) {
      if (!Number.isInteger(s.rng[key]) || s.rng[key] < -2147483648 || s.rng[key] > 4294967295) throw new Error('Invalid RNG stream: ' + key);
    });
  }
  function validate(s) {
    if (!object(s)) throw new TypeError('State required');
    json(s);
    level(s.level);
    if (!((typeof s.seed === 'string' && s.seed.length > 0) || Number.isSafeInteger(s.seed))) throw new TypeError('Campaign seed required');
    if (!Number.isSafeInteger(s.day) || s.day < 1 || s.day > 5 ||
        ['prep', 'open', 'close', 'report'].indexOf(s.phase) < 0) throw new RangeError('Invalid local day/phase');
    if (s.absoluteDay !== undefined && s.absoluteDay !== (s.level - 1) * 5 + s.day) throw new RangeError('Invalid absolute day');
    if (!Number.isSafeInteger(s.standTier) || s.standTier < 0 || s.standTier > 7) throw new RangeError('Invalid stand tier');
    var total = 0, seed = 0;
    if (!object(s.ledger) || !Array.isArray(s.ledger.rows) || !whole(s.ledger.unrouted)) throw new TypeError('Invalid ledger');
    s.ledger.rows.forEach(function (row) {
      if (!object(row) || !whole(row.day) || typeof row.phase !== 'string' || typeof row.cat !== 'string' || typeof row.ref !== 'string') throw new TypeError('Invalid ledger row');
      total = cents(total + cents(row.cents));
      if (row.cat === 'seed') seed = cents(seed + row.cents);
    });
    if (cents(s.ledger.cash) !== total || cents(s.ledger.seedCents) !== seed) throw new Error('Ledger does not reconcile');
    if (!s.west || s.west.level !== s.level || s.west.week !== s.level) throw new Error('West level mismatch');
    ['crew', 'exchange', 'flags', 'rng'].forEach(function (k) {
      if (!object(s[k])) throw new TypeError('Missing state: ' + k);
    });
    if (!Array.isArray(s.crew.hired) || !s.crew.levels || typeof s.crew.levels !== 'object') throw new TypeError('Crew roster and levels required');
    if (!s.stock || s.stock.level !== s.level || s.mapId !== 'L' + s.level) throw new Error('Map/stock level mismatch');
    if (!s.crew.hired.every(function (id) { return typeof id === 'string'; }) || new Set(s.crew.hired).size !== s.crew.hired.length ||
        !object(s.crew.levels) || !Object.values(s.crew.levels).every(whole)) throw new Error('Invalid crew');
    validateModules(s);
    return s;
  }
  // Pure projection of pass6 live modules, not Save.snapshot(). day stays local;
  // absoluteDay and module/ledger days use campaign time. No setters or RNG draws.
  // Optional flags must already be selected JSON campaign data (e.g. legacy metals).
  // The controller adds physical placements/buildings when capturing retry state.
  function fromLive(live) {
    var E = live.Econ, W = live.Week, L = live.Ledger, C = live.Crew;
    var s = { seed: live.Rng.seed, level: E.levelNo, day: W.day,
      absoluteDay: (E.levelNo - 1) * 5 + W.day, phase: W.phase,
      mapId: live.World.level.id, standTier: live.standTier,
      ledger: { cash: L.cash, seedCents: L.seedCents, unrouted: L.unrouted,
        rows: L.rows.map(function (r) {
          return { day: r.day, phase: r.phase, cat: r.cat, cents: r.cents, ref: r.ref };
        }) },
      west: E.M.getState(), stock: E.K.getState(), exchange: live.Market.getState(),
      rng: live.Rng.getState(), crew: { hired: C.hired(), levels: C.levels === undefined ? {} : C.levels },
      flags: live.flags === undefined ? {} : live.flags };
    validate(s); // reject non-JSON values before copying can silently change them
    return copy(s);
  }
  function west(s) {
    var w = West.create({ hard: s.west.hard, getCash: function () { return s.ledger.cash; },
      postTransaction: function (row) {
        s.ledger.cash = cents(s.ledger.cash + cents(row.cents));
        s.ledger.rows.push(copy(row));
      } });
    w.setState(s.west);
    return w;
  }
  // Friday REPORT is the only decision point. Existing Econ.M reports are already settled;
  // West.fridayReport is idempotent, so they never cause a second debit or retry penalty.
  function endWeek(input) {
    validate(input);
    if (input.day !== 5 || input.phase !== 'report') throw new Error('Friday REPORT required');
    var s = copy(input), w = west(s), report = w.fridayReport(s.level * 5);
    s.west = w.getState();
    var action = report.paid ? (s.level === 4 ? 'complete' : 'advance') : (report.retry ? 'retry' : 'gameOver');
    return { action: action, nextLevel: action === 'advance' ? s.level + 1 : null, state: s };
  }
  function captureMonday(input) {
    validate(input);
    if (input.day !== 1 || input.phase !== 'prep' || input.west.report || input.west.paid) throw new Error('Monday PREP required');
    if (input.stock.day !== (input.level - 1) * 5 + 1 || input.stock.phase !== 'prep') throw new Error('Monday stock required');
    var x = input.exchange, day = (input.level - 1) * 5 + 1;
    if (!((x.day === 0 && x.phase === 'idle') || (x.day === day && x.phase === 'prep') ||
        (x.day === day - 1 && x.phase === 'close'))) throw new Error('Monday Exchange required');
    return { version: 1, level: input.level, state: copy(input) };
  }
  function resetWest(s, retry) {
    var w = west(s); w.startLevel(s.level, { retry: !!retry }); s.west = w.getState();
  }
  // Campaign memory is open-ended; only strip known transient fields at their
  // defined paths, so an unlock called "objects" or "events" still survives.
  function campaignFlags(flags) {
    var out = copy(flags);
    var paths = {
      root: ['objects', 'owned', 'supply', 'handyman', 'events', 'checkpoint', 'retried',
        'placements', 'buildings', 'litter', 'jobs', 'timers', 'dailyFlags', 'results'],
      story: ['walker', 'challenge', 'verdictTimer', 'verdict', 'done', 'started', 'envelope', 'bubble', 'popupAt'],
      arcs: ['rant', 'rantAt', 'said', 'banterDay', 'phillipDay', 'kingStole', 'nextFree', 'wager', 'kingOn', 'kingDown', 'bubbles'],
      bets: ['day', 'dayStart', 'dayEarn', 'card', 'cardT', 'holding', 'offeredToday', 'betAt'],
      hacks: ['run', 'used', 'buyMul', 'outT', 'premium', 'billboardT', 'typingT'],
      invest: ['timers', 'flipDay', 'pitchDay']
    };
    Object.keys(paths).forEach(function (group) {
      var target = group === 'root' ? out : out[group];
      if (object(target)) paths[group].forEach(function (key) { delete target[key]; });
    });
    return out;
  }
  function advance(input) {
    var result = endWeek(input);
    if (result.action !== 'advance') throw new Error('Cannot advance: ' + result.action);
    var old = result.state, n = result.nextLevel;
    // Whitelist campaign state: map placements, buildings, stock, litter, jobs, daily flags,
    // queues, timers and caches cannot accidentally leak from the old map.
    var s = { seed: old.seed, level: n, day: 1, absoluteDay: (n - 1) * 5 + 1, phase: 'prep', ledger: old.ledger,
      crew: { hired: old.crew.hired, levels: old.crew.levels }, standTier: 0, exchange: old.exchange,
      flags: campaignFlags(old.flags), rng: old.rng, west: old.west,
      mapId: 'L' + n, placements: [], buildings: [], litter: [], jobs: [],
      timers: {}, dailyFlags: {}, results: [] };
    resetWest(s, false);
    var k = Stock.create({ level: n, postTransaction: function () { throw new Error('Reset must not spend'); },
      getCash: function () { return s.ledger.cash; } });
    s.stock = k.getState();
    return s;
  }
  // Restore ALL Monday JSON (including RNG, stock, placements and campaign flags).
  // Only West's campaign record survives the failed attempt: mood, attempts and rent score.
  // Reapplying to the returned Monday is idempotent; it never increments attempts itself.
  function retry(input, checkpoint) {
    validate(input);
    if (!checkpoint || checkpoint.version !== 1 || checkpoint.level !== input.level) throw new Error('Wrong Monday checkpoint');
    captureMonday(checkpoint.state); // validate before JSON copying can erase corruption
    var s = copy(checkpoint.state);
    if (s.level !== input.level || s.seed !== input.seed || !!s.west.hard !== !!input.west.hard) throw new Error('Checkpoint campaign mismatch');
    if (input.west.paid || (input.west.hard && input.level === Economy.hard.noRetryLevel)) throw new Error('Retry unavailable');
    var failedFriday = input.day === 5 && input.phase === 'report' && input.west.report && input.west.report.retry;
    var repeatedMonday = input.retrying && input.day === 1 && input.phase === 'prep' && !input.west.report;
    if (!failedFriday && !repeatedMonday) throw new Error('Failed Friday report required');
    ['mood', 'attempts', 'rentRecords'].forEach(function (k) { s.west[k] = copy(input.west[k]); });
    resetWest(s, true);
    s.retrying = true;
    return s;
  }
  var twists = [
    'Learn the stand and ride the gentle bell-change rushes.',
    'Spirit Parade blocks a walk; game-day crowds double.',
    'Midterm luck lines, rain and Dean audits test the stand.',
    'Late-night crammers have little patience. Gala on Day 20.'
  ];
  var labels = { grill: 'Grill', banner: 'Banner', serving: 'Serving station', drinks: 'Drinks',
    trashCans: 'Trash cans', coinFlip: 'Coin flip', hireAaron: 'Hire Aaron (Day 3)',
    fullBoard: 'All 10 Exchange tickers', picnicShade: 'Picnic shade', merchTable: 'Merch table',
    cornhole: 'Cornhole court', salsaBar: 'Salsa bar', stringLights: 'String lights',
    spikeball: 'Spikeball', stand2: 'Stand 2 (Day 12)', foodTruck: 'Food truck (tier 5)',
    tier6: 'Stand tier 6', tier7: 'Stand tier 7' };
  function card(n, options) {
    var ramp = level(n), opts = options || {}, days = Calendar.slice((n - 1) * 5, n * 5);
    var unlocks = [], cast = [], due = Math.round(ramp.rentCents * (opts.hard ? Economy.hard.rentMult : 1));
    days.forEach(function (d) {
      d.unlocks.forEach(function (id) { var name = labels[id] || id; if (unlocks.indexOf(name) < 0) unlocks.push(name); });
      d.cast.guaranteed.forEach(function (id) {
        var person = Calendar.CAST_ROSTER.filter(function (p) { return p.id === id; })[0];
        if (person && cast.indexOf(person.name) < 0) cast.push(person.name);
      });
    });
    var data = { level: n, title: 'Level ' + n + ': ' + ramp.map,
      thumbnail: 'assets/levels/L' + n + '_intro_v1.webp', thumbnailAlt: ramp.map,
      mapSize: ramp.w + ' × ' + ramp.h + ' tiles', rentCents: due,
      rent: '$' + (due / 100).toFixed(2) + ' rent due Friday',
      landlord: "Mrs. West owns this patch too, darlin'.", twist: twists[n - 1],
      newUnlocks: unlocks, cast: cast,
      goal: 'Pay Friday rent' + (n === 4 ? ' and reach the Day 20 Gala.' : ' to reach Level ' + (n + 1) + '.'),
      carried: ['Cash and ledger', 'Crew roster and levels', 'Exchange holdings', 'Campaign flags'],
      reset: 'Map, stand placement, buildings, stand upgrades, stock, weekly favors and timers reset.',
      startLabel: 'START' };
    return data;
  }
  // Imperative boundary owned by the caller. World.loadLevel synchronously runs onLoad;
  // await also supports an async wrapper. Apply AFTER every reset, checkpoint, THEN save.
  // Required hooks avoid silently skipping the C6 save fix. Failed hooks prevent later steps.
  async function load(input, map, hooks) {
    validate(input);
    if (!map || map.id !== 'L' + input.level || map.w !== level(input.level).w || map.h !== level(input.level).h) throw new Error('Wrong level map');
    if (input.day !== 1 || input.phase !== 'prep') throw new Error('Level loads require Monday PREP');
    ['loadLevel', 'applyState', 'captureMonday', 'autoSave'].forEach(function (k) {
      if (!hooks || typeof hooks[k] !== 'function') throw new TypeError('Missing hook: ' + k);
    });
    var s = copy(input);
    captureMonday(s); // reject invalid Monday before touching the live World
    await hooks.loadLevel(copy(map));
    // Optional return value is the live snapshot AFTER caller-owned Monday setup
    // (e.g. Exchange.openPrep). Capture its RNG/rolls, never a stale pre-load snapshot.
    var applied = await hooks.applyState(copy(s));
    if (applied !== undefined) {
      validate(applied);
      if (applied.level !== s.level || applied.seed !== s.seed || applied.west.hard !== s.west.hard) throw new Error('Applied campaign mismatch');
      s = copy(applied);
    }
    await hooks.captureMonday(captureMonday(s));
    var saved = await hooks.autoSave('prep');
    return { state: s, saved: saved !== false };
  }
  return { endWeek: endWeek, advance: advance, retry: retry, captureMonday: captureMonday,
    card: card, load: load, validate: validate, fromLive: fromLive };
}));
