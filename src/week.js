// Taco Week: 5 days of PREP (paused: build, buy) -> OPEN (3 sim-minutes) -> CLOSE (no new joiners,
// <= 20 s overtime) -> REPORT card. Hit 4 of 5 daily goals to win. Free Play (?mode=free, or from
// the ending) is the old endless mode with everything unlocked by tier only.
(function (TF) {
  var Sim = TF.Sim;
  var $ = function (id) { return document.getElementById(id); };

  var DAYS = [
    { name: 'First Day on the Quad', goal: 16 },
    { name: 'Lunch Rush', goal: 22 },
    { name: 'Old Main Goes Viral', goal: 26 },   // ~80% of decent scripted runs (desktop + phone) once the grill can be bought on Day 1 (Pass 5)
    { name: 'Double Trouble', goal: 40 },
    { name: 'Bobcat Taco Fest', goal: 34 }
  ];
  var OPEN_T = 180, OVERTIME = 20;
  // What unlocks on which day (PLAN section C). Anything not listed is available from Day 1.
  var UNLOCK = {
    // grill, banner and serving station are open from Day 1 (cash + the build permit are the limits)
    ali: 2, matt: 2, cooler2: 2, runner: 2, drinks: 2, picnic: 2,
    antonio: 3, phillip: 3, trash: 3,
    cannon: 4, aiali: 4, stand2: 4,
    canopy: 5, aaron: 3
  };
  var MAJOR = { grill: 1, banner: 1, serving: 1, canopy: 1, stand2: 1, picnic: 1 };
  // Old Main class bells (item 7): seconds into OPEN. Each rings after a 5 s countdown and sends
  // a wave of students out; a Banner makes the wave bigger, Antonio's hype timed into it bigger still.
  var BELLS = (TF.World && TF.World.level && TF.World.level.spawn.bells) || [[90], [60, 135], [55, 130], [70, 140], [45, 120]];   // from the level file
  var BELL_WARN = 5, BELL_WAVE = 12, BELL_T = 20;

  var W = {
    mode: /[?&]mode=free/.test(location.search) ? 'free' : 'week',
    day: 1, phase: 'prep', t: 0, overtime: 0, majorUsed: false, openMinorUsed: false, eventsToday: 0,
    results: [], today: null, ended: false, gen: 0
  };

  // Day 1 starts with SIFE seed money from the club treasury, so the first upgrade can happen in
  // the very first PREP. Mrs. West's profit meter counts from it (seed money isn't profit).
  W.SEED = 60;
  if (/[?&]mode=free/.test(location.search) === false) {
    TF.Ledger.add('seed', W.SEED, 'SIFE seed money');
    setTimeout(function () { Sim.events.push({ type: 'toast', text: '\uD83C\uDF93 SIFE seed money: $' + W.SEED + ' from the club treasury. Tap Upgrade (phone: Manage) to improve the stand!' }); }, 600);
  }
  W.active = function () { return W.mode === 'week'; };
  // Level 1's days are the Pass 5 week; Levels 2-4 ramp the bonus goal per PLAN §1a (34->46, 50->64, 68->86)
  // and take their day titles from the 20-day calendar (6B B2).
  var GOALS = { 2: [34, 37, 40, 43, 46], 3: [50, 54, 57, 61, 64], 4: [68, 72, 77, 81, 86] };
  function lvl() { return TF.Econ && TF.Econ.levelNo ? TF.Econ.levelNo : 1; }
  W.goal = function (day) { var g = GOALS[lvl()], d = day || W.day; return g ? g[d - 1] : DAYS[d - 1].goal; };
  W.dayName = function () {
    var n = lvl(), c = n > 1 && TF.CALENDAR && TF.CALENDAR[(n - 1) * 5 + W.day - 1];
    return c ? c.title : DAYS[W.day - 1].name;
  };
  W.GOALS = DAYS.map(function (d) { return d.goal; });

  // ---- Shop rules ------------------------------------------------------------------
  W.dayOne = function () { return W.active() && lvl() === 1 && W.day === 1; };
  W.unlockDay = function (id) { if (lvl() === 1 && /^(ali|cooler2|runner|drinks)$/.test(id)) return 1; return id === 'aaron' && lvl() > 1 ? 1 : UNLOCK[id] || 1; };
  W.isMajor = function (id) { return !!MAJOR[id]; };
  // null if allowed, otherwise a short reason for the button.
  // Build permits (Pass 5 item 2): one major build a day, in PREP or during OPEN (unused permits
  // expire); L1 Monday permits repeat builds and minor buys; other days allow one OPEN minor. No construction in the
  // last 20 s of a day. Spending under the $20 reserve asks for a confirm (Crew).
  W.RESERVE = 20; W.LATE = 20;
  W.shopBlock = function (id) {
    if (!W.active()) return null;
    if (W.phase !== 'prep' && W.phase !== 'open') return 'Shop closed';
    if (W.day < W.unlockDay(id)) return 'Day ' + W.unlockDay(id);
    if (W.phase === 'open' && W.isMajor(id) && W.t > OPEN_T - W.LATE) return 'Too late to build';
    if (W.isMajor(id) && W.majorUsed && !W.dayOne()) return 'Permit used';
    if (W.phase === 'open' && !W.isMajor(id) && W.openMinorUsed && !W.dayOne()) return 'OPEN buy used';
    return null;
  };
  W.bought = function (id) {
    if (!W.active()) return;
    if (W.isMajor(id)) W.majorUsed = true;
    else if (W.phase === 'open') W.openMinorUsed = true;
  };
  W.permitLine = function () {
    if (!W.active()) return '';
    if (W.dayOne()) return 'Monday: repeat builds + small buys allowed · builds until 0:20 left · Restock kits · Menu & Prices';
    return (W.majorUsed ? '\uD83C\uDFAB Permit used today' : '\uD83C\uDFAB 1 build permit today (big builds)') +
      (W.phase === 'open' ? (W.openMinorUsed ? ' \u00B7 OPEN buy used' : ' \u00B7 1 small buy during OPEN') : ' \u00B7 small buys: unlimited in PREP');
  };

  // ---- Events: gated by day, max 2 specials a day (3 on Day 5) ----------------------
  var EVENT_DAY = { west: 2, grackles: 2, hack: 3, raid: 3, bets: 3 };
  W.eventAllowed = function (kind, auto) {
    if (!W.active()) return true;
    if (W.phase !== 'open') return false;
    if (W.day < (EVENT_DAY[kind] || 1)) return false;
    if (auto && kind !== 'bets' && W.eventsToday >= (W.day === 5 ? 3 : 2)) return false;
    return true;
  };
  W.eventUsed = function () { W.eventsToday++; };

  // ---- Day bookkeeping -------------------------------------------------------------------
  function snap() {
    return { served: Sim.stats.served, money: Sim.stats.money, earn: W.earnTotal || 0, longline: Sim.thoughts.longline, pricey: Sim.thoughts.pricey,
      gaveUp: Sim.stats.gaveUp, noline: Sim.stats.noline || 0, closed: Sim.stats.closedTurnaway || 0, bets: TF.Bets ? TF.Bets.bets.net : 0,
      lost: JSON.parse(JSON.stringify(Sim.lost)), stLost: Sim.stands.map(function (st) { return JSON.parse(JSON.stringify(st.lost || {})); }),
      stSold: Sim.stands.map(function (st) { return st.served || 0; }) };
  }
  W.earnTotal = 0;
  W.earn = function (amt) { W.earnTotal += amt; };

  // Seconds spent in each bottleneck today (TF.Bottleneck names them; see clarity labels).
  W.necks = {};
  function tickNecks(dt) {
    Sim.stands.forEach(function (st) {
      var b = TF.bottleneckOf ? TF.bottleneckOf(st) : null;
      if (b) { var k = Sim.stands.length > 1 ? 'Stand ' + (st.idx + 1) + ': ' + b : b; W.necks[k] = (W.necks[k] || 0) + dt; }
    });
  }

  W.openDay = function () {
    if (!W.active() || W.phase !== 'prep' || !(TF.Onboard ? TF.Onboard.allConnected() : Sim.stand.connected)) return false;
    W.phase = 'open'; W.t = 0; W.eventsToday = 0; W.necks = {};
    var lvBells = TF.World.level && TF.World.level.spawn && TF.World.level.spawn.bells;   // read now: a level load can change them
    W.bells = ((lvBells || BELLS)[W.day - 1] || []).slice(); W.bell = null; W.bellsRung = 0;
    W.today = snap();
    if (TF.Bets) TF.Bets.dayStart = Sim.t;
    Sim.closing = false;
    if (TF.Econ) TF.Econ.openDay(W.day);   // kits / prices / rent (Pass 6 C3)
    TF.ui.api.play();
    Sim.events.push({ type: 'toast', text: 'Day ' + W.day + ': ' + W.dayName() + ' — sell ' + W.goal() + ' tacos!' });
    W.refresh();
    return true;
  };

  // A level load (Pass 6 C3b): back to that level's Monday PREP, whatever phase the old level was in, so Week,
  // Stock and the HUD agree (was: Week open/day 2 while Stock was prep/day 1, and sales failed).
  W.resetForLevel = function () {
    if (!W.active()) return;
    W.day = 1; W.phase = 'prep'; W.t = 0; W.overtime = 0; W.majorUsed = false; W.openMinorUsed = false; W.eventsToday = 0;
    W.results = []; W.today = null; W.ended = false; W.bell = null; W.bells = []; W.necks = {};
    card.hidden = true; $('endCard').hidden = true;
    var end = $('endCard');
    if (end && end.dataset) { delete end.dataset.levelText; delete end.dataset.galaWired; delete end.dataset.galaShown; }
    if ($('betCard')) $('betCard').hidden = true;   // Jared's / Ali's card from the old week (6B B2)
    if ($('toast')) $('toast').hidden = true;
    Sim.closing = false; Sim.demandMul = 1;
    W.gen++;   // async work from the old level (the Friday verdict) checks this and stands down
    [TF.Hacks, TF.Story, TF.Arcs, TF.Events, TF.Ambient, TF.SpeechGate].forEach(function (m) { if (m && m.resetLevel) m.resetLevel(); });
    var lvl = TF.Econ && TF.Econ.levelNo ? TF.Econ.levelNo : 1;
    if (TF.StoryBeats && TF.StoryBeats.clearLevelDays) TF.StoryBeats.clearLevelDays(lvl);
    if (TF.HintsUI && TF.HintsUI.clearLevelDays) TF.HintsUI.clearLevelDays(lvl);
    if (TF.CastLines && TF.CastLines.resetLevel) TF.CastLines.resetLevel();
    if (TF.Aaron && TF.Aaron.onLevelReset) TF.Aaron.onLevelReset();
    if (TF.ui && TF.ui.api) TF.ui.api.pause();
    W.refresh();
  };

  W.step = function (dt) {
    if (!W.active()) return;
    if (W.phase === 'open') {
      W.t += dt;
      tickNecks(dt);
      stepBell(dt);
      if (W.t >= OPEN_T) startClose();
    } else if (W.phase === 'close') {
      W.overtime += dt;
      tickNecks(dt);
      var busy = Sim.stands.some(function (st) { return st.queue.length || st.window || st.pickup.some(Boolean); }) || Sim.guests.some(function (g) { return g.state === 'TO_QUEUE' || g.state === 'PAID_WAIT'; });
      if (!busy || W.overtime >= OVERTIME) endDay();
    }
  };

  // The next bell: { warn: seconds to ring } during the countdown, { ring: seconds left } after.
  W.bellCountdown = function () { return W.bell && W.bell.warn > 0 ? Math.ceil(W.bell.warn) : 0; };
  W.bellHot = function () { return !!W.bell; };   // countdown or wave: Antonio's timing window
  function stepBell(dt) {
    var b = W.bell;
    if (!b && W.bells.length && W.t >= W.bells[0] - BELL_WARN) {
      W.bells.shift();
      b = W.bell = { warn: BELL_WARN, ring: BELL_T, left: 0, spawnT: 0 };
      Sim.events.push({ type: 'toast', text: '\uD83D\uDD14 Old Main bell in 5\u2026 class lets out!' });
    }
    if (!b) return;
    if (b.warn > 0) {
      b.warn -= dt;
      if (b.warn <= 0) {
        var banner = Sim.stands.some(function (st) { return st.placed && st.tier >= 2; });
        b.left = Math.round(BELL_WAVE * (banner ? 1.5 : 1));
        W.bellsRung++; Sim.demandMul = 1.6;
        Sim.events.push({ type: 'toast', text: '\uD83D\uDD14 RING! ' + b.left + ' students pour out of Old Main' + (banner ? ' (your banner pulls extra)' : '') });
        Sim.events.push({ type: 'hack' });   // reuse the hack-wave sound
      }
      return;
    }
    b.ring -= dt; b.spawnT -= dt;
    var door = Sim.oldMainDoor();
    while (b.left > 0 && b.spawnT <= 0) {
      b.spawnT += 0.25; b.left--;
      var g = Sim.spawnGuest(door);
      g.x += (Sim.rand() - 0.5) * 0.6; g.px = g.x; g.fromBell = true;
      W.bellSpawned = (W.bellSpawned || 0) + 1;
    }
    if (b.ring <= 0) { W.bell = null; Sim.demandMul = 1; }
  }

  function startClose() {
    W.phase = 'close'; W.overtime = 0;
    Sim.closing = true;
    if (W.bell) { W.bell = null; Sim.demandMul = 1; }
    Sim.closeStand();   // no new joiners; people walking over turn back
    Sim.events.push({ type: 'toast', text: 'Closing time! Last orders…' });
  }

  function endDay() {
    Sim.closing = true;
    if (TF.Build) TF.Build.finishAll();
    if (TF.Hacks) TF.Hacks.endDay();
    var objDay = TF.Objects ? TF.Objects.endDay() : null;   // upkeep + drink costs
    Sim.flushQueue();   // overtime is up: anyone still waiting leaves politely
    var econDay = TF.Econ ? TF.Econ.endDay(W.day) : null;   // spoilage + Friday rent
    TF.ui.api.pause();
    W.phase = 'report';
    if (TF.Crew) TF.Crew.cheer();
    var a = W.today, b = snap();
    var betNet = 0;
    if (TF.Invest) TF.Invest.nightly();   // gold + silver move overnight
    var neck = Object.keys(W.necks).sort(function (x, y) { return W.necks[y] - W.necks[x]; })[0];
    var r = {
      day: W.day, name: W.dayName(), goal: W.goal(), sold: b.served - a.served, cash: b.earn - a.earn,
      lost: diffLost(a.lost, b.lost),
      neck: neck ? { name: neck, secs: Math.round(W.necks[neck]) } : null, betNet: betNet, hadBet: false, obj: objDay, econ: econDay, invest: TF.Invest ? TF.Invest.report() : []
    };
    r.hit = r.sold >= r.goal;
    if (Sim.stands.length > 1) r.standSold = Sim.stands.map(function (st, i) { return (st.served || 0) - (a.stSold[i] || 0); });
    r.top = Object.keys(r.lost).sort(function (x, y) { return r.lost[y] - r.lost[x]; }).filter(function (k) { return r.lost[k] > 0; })[0] || null;
    r.suggest = W.suggestBuy(r);
    W.results[W.day - 1] = r;
    if (TF.Arcs) TF.Arcs.endDay(r);   // Jared's wager settles
    showReport(r);
  }

  function diffLost(a, b) {
    var o = {};
    Sim.LOST_REASONS.forEach(function (k) { o[k] = (b[k] || 0) - ((a && a[k]) || 0); });
    return o;
  }

  // Tomorrow's briefing: one suggested buy that fixes today's biggest problem and is actually
  // available tomorrow (unlocked by then, not owned, prerequisites met). Cause -> fixes, in order.
  var FIXES = {
    'line full': ['serving', 'stand2', 'matt', 'cannon', 'ali', 'grill', 'phillip'],
    'LINE FULL': ['serving', 'stand2', 'matt', 'cannon', 'ali', 'grill', 'phillip'],
    'PICKUP FULL': ['matt', 'serving', 'cannon'],
    'NO STOCK': ['runner', 'cooler2', 'grill'],
    'gave up waiting': ['runner', 'cooler2', 'grill', 'ali', 'phillip'],
    'sold out': ['runner', 'cooler2', 'grill'],
    'GRILL STALLED': ['aiali', 'phillip', 'aaron'],
    'SLOW KITCHEN': ['ali', 'phillip', 'aaron', 'grill'],
    'too pricey': ['banner', 'antonio', 'canopy'],
    'closing time': ['matt', 'serving', 'ali'],
    quiet: ['banner', 'antonio', 'canopy', 'stand2']
  };
  W.suggestBuy = function (r) {
    if (r.top === 'no line') return { text: 'Build a line to a footpath before you OPEN.' };
    var C = TF.Crew, st = Sim.stand, day = Math.min(5, W.day + 1);
    var neck = r.neck ? r.neck.name.replace(/^Stand \d: /, '') : null;
    var fixes = (FIXES[r.top] || []).concat(FIXES[neck] || []), order = fixes.concat(FIXES.quiet);
    function info(id) {
      if (W.unlockDay(id) > day) return null;
      var t = C.TIERS.filter(function (u) { return u.id === id; })[0];
      if (t) return t.tier === st.tier + 1 ? { name: t.name, price: t.price } : null;
      var h = C.ROSTER.filter(function (x) { return x.id === id; })[0];
      if (h) return !C.hiredSet[id] && h.tier <= st.tier ? { name: h.name, price: h.price } : null;
      var x = C.EXTRAS.filter(function (e) { return e.id === id; })[0];
      if (x) return !C.extras[id] && x.needs() ? { name: x.name, price: x.price } : null;
      if (id === 'stand2') return Sim.stands.length < 2 ? { name: 'Second stand', price: C.STAND2_PRICE } : null;
      return null;
    }
    var WHY = { 'line full': 'the line was full', 'gave up waiting': 'people gave up waiting', 'too pricey': 'tacos felt too pricey', 'sold out': 'you ran out of taco kits (order more in STOCK)', 'closing time': 'closing time turned people away' };
    var when = W.day >= 5 ? 'In Free Play' : 'Tomorrow';
    for (var i = 0; i < order.length; i++) {
      var o = info(order[i]);
      if (!o) continue;
      var direct = i < fixes.length;
      var why = direct ? (r.top ? ': most lost sales were because ' + WHY[r.top] + '.' : neck ? ': it eases ' + neck + '.' : '.') : ': more students to sell to.';
      if (!direct && r.top) {   // nothing that fixes today's cause is open yet: say when it is
        var later = fixes.filter(function (id) { return W.unlockDay(id) > day; })[0];
        var nm = later && (C.TIERS.concat(C.ROSTER, C.EXTRAS).filter(function (u) { return u.id === later; })[0] || { name: 'Second stand' }).name;
        why += ' (' + WHY[r.top].replace(/^./, function (c) { return c.toUpperCase(); }) + (later ? ': ' + nm + ' unlocks Day ' + W.unlockDay(later) + '.)' : '.)');
      }
      return { id: order[i], name: o.name, price: o.price, direct: direct, text: when + ', try ' + o.name + ' ($' + o.price + ')' + why };
    }
    return { text: 'You own everything that helps. Keep the line short and ride the bells!' };
  };

  // ---- Report + ending cards ---------------------------------------------------------------
  var card = $('reportCard');
  function showReport(r) {
    var lost = Object.keys(r.lost).filter(function (k) { return r.lost[k] > 0; }).map(function (k) { return r.lost[k] + ' ' + k; });
    var lostN = Object.keys(r.lost).reduce(function (s, k) { return s + Math.max(0, r.lost[k]); }, 0);
    card.innerHTML =
      '<h2>Day ' + r.day + ': ' + r.name + '</h2>' +
      '<div class="big ' + (r.hit ? 'hit' : 'miss') + '">' + r.sold + ' / ' + r.goal + ' tacos ' + (r.hit ? '✔ Goal hit!' : '✘ Missed') + '</div>' +
      '<div class="row"><span>Cash earned</span><b>$' + r.cash + '</b></div>' +
      '<div class="row"><span>Customers lost</span><b>' + lostN + '</b></div>' + (lost.length ? '<div class="why">' + lost.join(' · ') + '</div>' : '') +
      '<div class="row"><span>Biggest bottleneck</span><b>' + (r.neck ? r.neck.name + ' (' + r.neck.secs + 's)' : 'none — smooth day!') + '</b></div>' +
      (r.standSold ? '<div class="row"><span>Best stand</span><b>Stand ' + (r.standSold[1] > r.standSold[0] ? 2 : 1) + ' (' + r.standSold.join(' vs ') + ' sold)</b></div>' : '') +
      (r.econ ? '<div class="row"><span>\uD83D\uDDD1 Spoiled at close</span><b>' + r.econ.spoiledKits + ' kits (\u2212$' + (r.econ.spoiledCents / 100).toFixed(2) + ')</b></div>' : '') +
      (r.econ && r.econ.rent ? '<div class="row"><span>Rent to Mrs. West</span><b>' + (r.econ.rent.paid ? '\u2714 paid' : '\u2718 short') + '</b></div>' : '') +
      investRows(r.invest) +
      '<div class="brief" id="briefing"><b>Briefing:</b> ' + r.suggest.text + '</div>' +
      (r.obj && (r.obj.drinks || r.obj.upkeep) ? '<div class="row"><span>Drinks / upkeep</span><b>' + r.obj.drinks + ' drinks +$' + r.obj.drinkRev + ' \u00B7 costs -$' + (r.obj.upkeep + r.obj.drinkCost) + '</b></div>' : '') +
      (r.obj && r.obj.litter ? '<div class="row"><span>Litter on the quad</span><b>' + r.obj.litter + ' wrappers' + (r.obj.litterPct ? ' (\u2212' + r.obj.litterPct + '% draw)' : '') + '</b></div>' : '') +
      (r.hadBet ? '<div class="row"><span>Jared’s bets</span><b>' + (r.betNet === 0 ? 'no change' : (r.betNet > 0 ? '+$' : '-$') + Math.abs(r.betNet)) + '</b></div>' : '') +
      '<button id="btnNextDay">' + (r.day < 5 ? 'Next day →' : 'See how the week went →') + '</button>';
    card.hidden = false;
    if (TF.Save) TF.Save.write('report');   // auto-save after REPORT: resumes into the next day's PREP, or Friday's verdict (C6)
    $('btnNextDay').addEventListener('click', function () {
      TF.Audio.unlock();
      if (r.day < 5) { nextDay(); return; }
      // Friday: Mrs. West's limo pulls up for the verdict, then the ending
      card.hidden = true;
      var gen = W.gen;
      if (TF.Story && TF.Story.started) TF.Story.playVerdict(function () { if (gen === W.gen) showEnding(); }); else showEnding();
    });
    W.refresh();
  }

  // The day report's Investments section: ROI per item, best first; metals at today's price.
  function investRows(rows) {
    if (!rows || !rows.length) return '';
    var h = '<div class="inv"><div class="row"><span><b>Investments</b></span><b>earned / cost \u00B7 ROI</b></div>';
    rows.forEach(function (x, i) {
      var tag = rows.length > 1 && i === 0 ? ' \u2B50 best' : rows.length > 1 && i === rows.length - 1 ? ' \u2B07 worst' : '';
      h += '<div class="row small"><span>' + x.name + (x.est ? ' <small>(est.)</small>' : '') + tag + '</span><b>' + (x.earned < 0 ? '-$' : '+$') + Math.abs(x.earned) + ' / $' + x.cost + ' \u00B7 ' + x.roi + '%' + (x.metal ? ' (now $' + x.value + ')' : '') + '</b></div>';
    });
    return h + '</div>';
  }

  function nextDay() {
    card.hidden = true;
    W.day++; W.phase = 'prep'; W.majorUsed = false; W.openMinorUsed = false; W.t = 0;
    if (TF.Econ) TF.Econ.nextDay(W.day);
    Sim.closing = false;
    Sim.reopenStand();
    Sim.newDay();   // a clean quad each morning (C6: what a resumed day starts from too)
    Sim.events.push({ type: 'toast', text: 'Day ' + W.day + ' PREP: ' + W.dayName() + '. Goal ' + W.goal() + ' tacos. Buy upgrades, then OPEN.' });
    if (TF.Crew) TF.Crew.refresh();
    W.refresh();
    if (TF.Save) TF.Save.write('prep');   // auto-save at PREP (C6)
  }
  // Resume (C6): the saved day's PREP. An after-REPORT save moves on through the normal next-day step.
  W.setDayForResume = function (d, afterReport) {
    card.hidden = true; $('endCard').hidden = true; W.ended = false; W.gen++;
    W.day = d;
    if (afterReport && d >= 5) { W.phase = 'report'; showEnding(); }   // Friday: the week's verdict (and its retry)
    else if (afterReport) { W.phase = 'report'; nextDay(); }
    else {
      W.phase = 'prep'; W.t = 0; W.overtime = 0; W.majorUsed = false; W.openMinorUsed = false; W.eventsToday = 0; W.bell = null; W.today = null;
      Sim.closing = false; Sim.reopenStand(); Sim.newDay();
      if (TF.Econ && TF.Econ.on()) TF.Econ.K.setPhase('prep', TF.Econ.abs(d));
      if (TF.Crew) TF.Crew.refresh();
      W.refresh();
    }
    if (TF.ui && TF.ui.api) TF.ui.api.pause();
  };

  // The weekend verdict (Pass 6A C5): the rent scene (Grok's lines, data/story.js), where the money came
  // from (operating profit / trading gains / capital spent, the ledger's split), the stock summary and
  // how the Star's tips did this week.
  function verdictRows(paid) {
    var L = TF.Ledger.split(), d = function (c) { return (c < 0 ? '\u2212$' : '$') + (Math.abs(c) / 100).toFixed(2); }, h = '';
    var scene = TF.STORY && TF.STORY.rent && TF.STORY.rent['L' + (TF.Econ.levelNo || 1)] && TF.STORY.rent['L' + (TF.Econ.levelNo || 1)][paid ? 'paid' : 'short'];
    if (scene) h += '<div class="scene">' + scene.slice(0, 4).map(function (l) { return '<div><b>' + l.who.toUpperCase() + ':</b> ' + l.text + '</div>'; }).join('') + '</div>';
    h += '<div class="row"><span>Operating profit</span><b>' + d(L.operating) + '</b></div>' +
      '<div class="row"><span>Trading gains</span><b>' + d(L.trading) + '</b></div>' +
      '<div class="row"><span>Capital spent</span><b>' + d(L.capital) + '</b></div>';
    var sm = TF.Mkt ? TF.Mkt.summary() : [];
    if (sm.length) h += '<div class="row small"><span>Stocks</span><b>' + sm.map(function (x) { return x.sym + ' ' + x.shares + ' sh @ $' + (x.cents / 100).toFixed(2) + ' (' + (x.pct >= 0 ? '+' : '') + x.pct + '%)'; }).join(' \u00B7 ') + '</b></div>';
    var sc = TF.Mkt ? TF.Mkt.scorecard() : null;
    if (sc && sc.star && sc.star.total) h += '<div class="row small"><span>The Star\u2019s tips</span><b>' + sc.star.hits + ' / ' + sc.star.total + ' right</b></div>';
    W.verdict = { operating: L.operating, trading: L.trading, capital: L.capital, stocks: sm, star: sc && sc.star };
    return h;
  }

  function showEnding() {
    card.hidden = true;
    W.phase = 'ended'; W.ended = true;
    var hits = W.results.filter(function (r) { return r && r.hit; }).length;
    var total = W.results.reduce(function (s, r) { return s + (r ? r.sold : 0); }, 0);
    var cash = W.results.reduce(function (s, r) { return s + (r ? r.cash : 0); }, 0);
    var win = hits >= 4;
    // Taco Week with the economy: the week is decided by Friday's rent to Mrs. West (PLAN §1b), not goals.
    var econ = TF.Econ && TF.Econ.on(), rentPaid = econ ? TF.Econ.rentPaid() : null;
    if (econ) win = rentPaid;
    W.won = win; W.rentPaid = rentPaid;
    var camp = !!(TF.Campaign && TF.Campaign.on()), lvlNo = TF.Econ && TF.Econ.levelNo ? TF.Econ.levelNo : 1;
    var end = $('endCard'), Sy = TF.Story, profit = Sy ? Sy.profit() : 0, bet = Sy && Sy.started && !econ ? profit >= Sy.target : null;
    var decision = camp ? TF.Campaign.endWeek() : null;
    var finale = decision && decision.action === 'complete' ? decision : null;
    if (finale) { var sums = TF.Ledger.split(); finale.score = TF.Econ.M.galaScore({ operatingProfitCents: sums.operating, tradingNetCents: sums.trading }); }
    W.betWon = bet;   // the Pass 5 profit term sheet; with the economy on, rent decides the week instead (C3b)
    if (bet === true) end.innerHTML = '<h2>\uD83D\uDCBC The Angel Round! \uD83C\uDF2E</h2><p>Mrs. West signs her term sheet: \u201C$' + profit + ' in five days. Gentlemen, I\u2019m investing.\u201D</p>' +
      '<div class="comic"><div><b>\uD83D\uDE97</b>The limo pulls up.</div><div><b>\uD83D\uDC5C</b>SNAP. A gold check.</div><div><b>\u2728</b>ANGEL-BACKED tacos.</div></div>' +
      '<div class="row"><span>Angel Round</span><b>+$100 for 10% of the stand</b></div>';
    else if (bet === false) end.innerHTML = '<h2>\uD83C\uDFEC WEST & CO. opens next door</h2><p>\u201C$' + profit + '? Adorable.\u201D Her Designer Pop-Up sells $29 artisanal tacos. To nobody.</p>' +
      '<div class="comic"><div><b>\uD83D\uDE97</b>The limo pulls up.</div><div><b>\uD83D\uDC5C</b>SNAP. \u201CAdorable.\u201D</div><div><b>\uD83C\uDFEC</b>$29 tacos. Zero customers. Jared smirks.</div></div>';
    else if (econ) {
      var due = TF.Econ.M.rentDue() / 100, have = Sim.stats.money;
      end.innerHTML = rentPaid
        ? '<h2>\uD83C\uDFE0 Rent paid. The stand stays!</h2><p>Mrs. West counts $' + due + ' twice. \u201CHmph. On time. See you next week, gentlemen.\u201D</p>'
        : '<h2>\uD83D\uDCB8 Rent short</h2><p>$' + have.toFixed(2) + ' of $' + due + '. Mrs. West snaps her purse: \u201CMonday, darlings. Again.\u201D</p>';
      end.innerHTML += '<div class="row"><span>Rent to Mrs. West</span><b>' + (rentPaid ? '\u2714 $' + due + ' paid on Friday' : '\u2718 short $' + Math.max(0, due - have).toFixed(2) + ': retry the week') + '</b></div>';
      end.innerHTML += verdictRows(rentPaid);
      if (finale) end.innerHTML += '<h2>Day 20 Gala · ' + (finale.score.win ? 'Angel Round' : 'WEST & CO. Pop-Up') + '</h2><p>Gala score: ' + finale.score.total + ' / 1000</p>';
    } else end.innerHTML = '';
    end.innerHTML += econ ? '' : win
      ? '<p><b>\uD83C\uDF2E Taco Week Champions!</b> The Quad will be talking about this for semesters.</p>'
      : '<p><b>Well\u2026 it was a week.</b> The grackles ate well and Jared is already planning a comeback.</p>';
    end.innerHTML += (bet !== null ? '<div class="row"><span>Mrs. West\u2019s term sheet</span><b>$' + profit + ' / $' + Sy.target + (bet ? ' \u2714 won' : ' \u2718 lost') + '</b></div>' : '') +
      '<div class="row"><span>' + (econ ? 'Goals hit (bonus)' : 'Goals hit') + '</span><b>' + hits + ' / 5</b></div>' +
      '<div class="row"><span>Tacos sold</span><b>' + total + '</b></div>' +
      '<div class="row"><span>Cash earned</span><b>$' + cash + '</b></div>' +
      '<div class="row"><span>Score</span><b>' + (total * 10 + cash + hits * 100) + '</b></div>' +
      (decision && decision.action === 'gameOver' ? '<p>Campaign over. No retry is available.</p><div class="btns"><button id="btnPlayAgain">Start over</button></div>'
        : econ && !rentPaid ? '<div class="btns"><button id="btnRetryWeek">\uD83D\uDD01 Retry the week (Monday)</button><button id="btnPlayAgain">Start over</button></div>'
        : econ && rentPaid && camp && lvlNo < 4 ? '<div class="btns"><button id="btnNextLevel">\u25B6 Level ' + (lvlNo + 1) + ': ' + ((TF.LEVELS['L' + (lvlNo + 1)] || {}).name || '') + '</button><button id="btnFreePlay">Free play</button></div>'
        : econ && rentPaid && camp ? '<div class="btns"><button id="btnPlayAgain">\uD83C\uDF89 Month complete! Play again</button><button id="btnFreePlay">Free play</button></div>'
        : '<div class="btns"><button id="btnPlayAgain">Play again</button><button id="btnFreePlay">Free play</button></div>');
    end.hidden = false;
    // the month (6B B2): next level through its start card / an in-place Monday retry; the old reload retry if the
    // campaign controller can't take it
    if ($('btnNextLevel')) $('btnNextLevel').addEventListener('click', function () { end.hidden = true; TF.Campaign.advance().catch(function () { end.hidden = false; }); });
    if ($('btnRetryWeek')) $('btnRetryWeek').addEventListener('click', function () {
      if (camp && TF.Campaign.monday) { end.hidden = true; TF.Campaign.retry().catch(function () { end.hidden = false; }); }
      else TF.Checkpoint.retry();
    });
    if (finale && camp && TF.Campaign.runFinale) {
      if ($('btnPlayAgain')) $('btnPlayAgain').addEventListener('click', function () { TF.Campaign.runFinale('again', finale.score); });
      if ($('btnFreePlay')) $('btnFreePlay').addEventListener('click', function () { TF.Campaign.runFinale('free', finale.score); });
    } else {
      // Start over / Play again (gameOver or rent-short): fresh L1, keep local leaderboard.
      if ($('btnPlayAgain')) $('btnPlayAgain').addEventListener('click', function () {
        if (TF.Campaign && TF.Campaign.clearForNewRun) TF.Campaign.clearForNewRun();
        else if (TF.Save && TF.Save.clear) TF.Save.clear();
        var base = String(location.href || '').split('#')[0].split('?')[0] || location.pathname;
        location.href = base;
      });
      if ($('btnFreePlay')) $('btnFreePlay').addEventListener('click', function () {
        end.hidden = true; if (TF.Story && bet !== null) TF.Story.applyEnding(bet); TF.Campaign.freePlay();
      });
    }
    W.refresh();
  }

  // ---- HUD -----------------------------------------------------------------------------------
  var hud = $('dayHud'), lostHud = $('lostHud');
  // Live lost-sales chip: today's count; for 2 s after a new loss it names the reason.
  function refreshLost() {
    var live = !W.active() || W.phase === 'open' || W.phase === 'close';
    lostHud.hidden = !live;
    if (!live) return;
    var base = W.active() && W.today ? W.today.lost : null, n = 0;
    Sim.LOST_REASONS.forEach(function (k) { n += Sim.lost[k] - (base ? base[k] || 0 : 0); });
    var f = Sim.lostFlash, recent = f && Sim.t - f.t < 2;
    var txt = '\uD83D\uDE1E ' + n + ' lost' + (recent ? ' \u00B7 ' + f.why : '');
    if (lostHud.textContent !== txt) lostHud.textContent = txt;
    lostHud.classList.toggle('bump', !!recent);
    W.lostToday = n;
  }
  W.refresh = function () {
    refreshLost();
    if (TF.Arcs) TF.Arcs.refresh();
    if (TF.Econ) TF.Econ.refresh();   // banter + Wednesday's wager (before Jared's metals pitch)
    if (TF.Invest) TF.Invest.refresh();
    if (TF.Story) TF.Story.refresh();
    if (!W.active()) {   // Free Play: the chip just counts tacos
      hud.hidden = false;
      var ft = '\uD83C\uDF2E ' + Sim.stats.served + ' served';
      if (hud.textContent !== ft) hud.textContent = ft;
      return;
    }
    hud.hidden = false;
    var sold = W.phase === 'prep' || !W.today ? 0 : Sim.stats.served - W.today.served;
    var left = Math.max(0, OPEN_T - W.t), mm = Math.floor(left / 60), ss = Math.floor(left % 60);
    var clock = W.phase === 'open' ? mm + ':' + (ss < 10 ? '0' : '') + ss : W.phase === 'close' ? 'CLOSING' : W.phase.toUpperCase();
    var cd = W.phase === 'open' ? W.bellCountdown() : 0;
    var txt = 'Day ' + W.day + '/5 · ' + clock + ' · 🌮 ' + sold + '/' + W.goal() + (cd ? ' · \uD83D\uDD14 ' + cd : W.bell ? ' · \uD83D\uDD14 RUSH' : '') +
      ((W.phase === 'prep' || W.phase === 'open') && !W.majorUsed && W.day >= 2 ? ' · \uD83C\uDFAB' : '');
    hud.classList.toggle('bell', !!(W.bell && W.phase === 'open'));
    if (hud.textContent !== txt) hud.textContent = txt;
  };
  W.soldToday = function () { return W.today && W.phase !== 'prep' ? Sim.stats.served - W.today.served : 0; };

  TF.Week = W;
})(window.TF);
