// Taco Week: 5 days of PREP (paused: build, buy) -> OPEN (3 sim-minutes) -> CLOSE (no new joiners,
// <= 20 s overtime) -> REPORT card. Hit 4 of 5 daily goals to win. Free Play (?mode=free, or from
// the ending) is the old endless mode with everything unlocked by tier only.
(function (TF) {
  var Sim = TF.Sim;
  var $ = function (id) { return document.getElementById(id); };

  var DAYS = [
    { name: 'First Day on the Quad', goal: 12 },
    { name: 'Lunch Rush', goal: 20 },
    { name: 'Old Main Goes Viral', goal: 24 },   // measured decent-player runs: see REPORT.md
    { name: 'Double Trouble', goal: 40 },
    { name: 'Bobcat Taco Fest', goal: 50 }
  ];
  var OPEN_T = 180, OVERTIME = 20;
  // What unlocks on which day (PLAN section C). Anything not listed is available from Day 1.
  var UNLOCK = {
    grill: 2, ali: 2, matt: 2, cooler2: 2, runner: 2, drinks: 2, picnic: 2,
    banner: 3, antonio: 3, phillip: 3, trash: 3,
    serving: 4, cannon: 4, aiali: 4, stand2: 4,
    canopy: 5, aaron: 5
  };
  var MAJOR = { grill: 1, banner: 1, serving: 1, canopy: 1, stand2: 1, picnic: 1 };
  // Old Main class bells (item 7): seconds into OPEN. Each rings after a 5 s countdown and sends
  // a wave of students out; a Banner makes the wave bigger, Antonio's hype timed into it bigger still.
  var BELLS = [[90], [60, 135], [55, 130], [70, 140], [45, 120]];
  var BELL_WARN = 5, BELL_WAVE = 12, BELL_T = 20;

  var W = {
    mode: /[?&]mode=free/.test(location.search) ? 'free' : 'week',
    day: 1, phase: 'prep', t: 0, overtime: 0, majorUsed: false, openMinorUsed: false, eventsToday: 0,
    results: [], today: null, ended: false
  };

  W.active = function () { return W.mode === 'week'; };
  W.goal = function () { return DAYS[W.day - 1].goal; };
  W.dayName = function () { return DAYS[W.day - 1].name; };
  W.GOALS = DAYS.map(function (d) { return d.goal; });

  // ---- Shop rules ------------------------------------------------------------------
  W.unlockDay = function (id) { return UNLOCK[id] || 1; };
  W.isMajor = function (id) { return !!MAJOR[id]; };
  // null if allowed, otherwise a short reason for the button.
  // Build permits (Pass 5 item 2): one major build a day, in PREP or during OPEN (unused permits
  // expire); during OPEN one minor buy too (PREP minors are unlimited); no construction in the
  // last 20 s of a day. Spending under the $20 reserve asks for a confirm (Crew).
  W.RESERVE = 20; W.LATE = 20;
  W.shopBlock = function (id) {
    if (!W.active()) return null;
    if (W.phase !== 'prep' && W.phase !== 'open') return 'Shop closed';
    if (W.day < W.unlockDay(id)) return 'Day ' + W.unlockDay(id);
    if (W.phase === 'open' && W.isMajor(id) && W.t > OPEN_T - W.LATE) return 'Too late to build';
    if (W.isMajor(id) && W.majorUsed) return 'Permit used';
    if (W.phase === 'open' && !W.isMajor(id) && W.openMinorUsed) return 'OPEN buy used';
    return null;
  };
  W.bought = function (id) {
    if (!W.active()) return;
    if (W.isMajor(id)) W.majorUsed = true;
    else if (W.phase === 'open') W.openMinorUsed = true;
  };
  W.permitLine = function () {
    if (!W.active()) return '';
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
    W.bells = BELLS[W.day - 1].slice(); W.bell = null; W.bellsRung = 0;
    W.today = snap();
    if (TF.Bets) TF.Bets.dayStart = Sim.t;
    Sim.closing = false;
    TF.ui.api.play();
    Sim.events.push({ type: 'toast', text: 'Day ' + W.day + ': ' + W.dayName() + ' — sell ' + W.goal() + ' tacos!' });
    W.refresh();
    return true;
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
    var objDay = TF.Objects ? TF.Objects.endDay() : null;   // upkeep + drink costs
    Sim.flushQueue();   // overtime is up: anyone still waiting leaves politely
    TF.ui.api.pause();
    W.phase = 'report';
    if (TF.Crew) TF.Crew.cheer();
    var a = W.today, b = snap();
    var betNet = 0;
    if (TF.Bets && W.day >= 3) { var before = TF.Bets.bets.net; TF.Bets.endDay(); betNet = TF.Bets.bets.net - before; }
    var neck = Object.keys(W.necks).sort(function (x, y) { return W.necks[y] - W.necks[x]; })[0];
    var r = {
      day: W.day, name: W.dayName(), goal: W.goal(), sold: b.served - a.served, cash: b.earn - a.earn,
      lost: diffLost(a.lost, b.lost),
      neck: neck ? { name: neck, secs: Math.round(W.necks[neck]) } : null, betNet: betNet, hadBet: TF.Bets && W.day >= 3, obj: objDay
    };
    r.hit = r.sold >= r.goal;
    if (Sim.stands.length > 1) r.standSold = Sim.stands.map(function (st, i) { return (st.served || 0) - (a.stSold[i] || 0); });
    r.top = Object.keys(r.lost).sort(function (x, y) { return r.lost[y] - r.lost[x]; }).filter(function (k) { return r.lost[k] > 0; })[0] || null;
    r.suggest = W.suggestBuy(r);
    W.results[W.day - 1] = r;
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
    var WHY = { 'line full': 'the line was full', 'gave up waiting': 'people gave up waiting', 'too pricey': 'tacos felt too pricey', 'closing time': 'closing time turned people away' };
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
      '<div class="brief" id="briefing"><b>Briefing:</b> ' + r.suggest.text + '</div>' +
      (r.obj && (r.obj.drinks || r.obj.upkeep) ? '<div class="row"><span>Drinks / upkeep</span><b>' + r.obj.drinks + ' drinks +$' + r.obj.drinkRev + ' \u00B7 costs -$' + (r.obj.upkeep + r.obj.drinkCost) + '</b></div>' : '') +
      (r.obj && r.obj.litter ? '<div class="row"><span>Litter on the quad</span><b>' + r.obj.litter + ' wrappers' + (r.obj.litterPct ? ' (\u2212' + r.obj.litterPct + '% draw)' : '') + '</b></div>' : '') +
      (r.hadBet ? '<div class="row"><span>Jared’s bets</span><b>' + (r.betNet === 0 ? 'no change' : (r.betNet > 0 ? '+$' : '-$') + Math.abs(r.betNet)) + '</b></div>' : '') +
      '<button id="btnNextDay">' + (r.day < 5 ? 'Next day →' : 'See how the week went →') + '</button>';
    card.hidden = false;
    $('btnNextDay').addEventListener('click', function () { TF.Audio.unlock(); r.day < 5 ? nextDay() : showEnding(); });
    W.refresh();
  }

  function nextDay() {
    card.hidden = true;
    W.day++; W.phase = 'prep'; W.majorUsed = false; W.openMinorUsed = false; W.t = 0;
    Sim.closing = false;
    Sim.reopenStand();
    Sim.events.push({ type: 'toast', text: 'Day ' + W.day + ' PREP: ' + W.dayName() + '. Goal ' + W.goal() + ' tacos. Buy upgrades, then OPEN.' });
    if (TF.Crew) TF.Crew.refresh();
    W.refresh();
  }

  function showEnding() {
    card.hidden = true;
    W.phase = 'ended'; W.ended = true;
    var hits = W.results.filter(function (r) { return r && r.hit; }).length;
    var total = W.results.reduce(function (s, r) { return s + (r ? r.sold : 0); }, 0);
    var cash = W.results.reduce(function (s, r) { return s + (r ? r.cash : 0); }, 0);
    var win = hits >= 4;
    W.won = win;
    var end = $('endCard');
    end.innerHTML = win
      ? '<h2>🌮 Taco Week Champions! 🌮</h2><p>The Quad will be talking about this for semesters. Old Main rang its bell just for you.</p>'
      : '<h2>Well… it was a week.</h2><p>The grackles ate well, Mrs. West says Ali “has potential”, and Jared is already planning a comeback. There’s always next semester.</p>';
    end.innerHTML += '<div class="row"><span>Goals hit</span><b>' + hits + ' / 5</b></div>' +
      '<div class="row"><span>Tacos sold</span><b>' + total + '</b></div>' +
      '<div class="row"><span>Cash earned</span><b>$' + cash + '</b></div>' +
      '<div class="row"><span>Score</span><b>' + (total * 10 + cash + hits * 100) + '</b></div>' +
      '<div class="btns"><button id="btnPlayAgain">Play again</button><button id="btnFreePlay">Free play</button></div>';
    end.hidden = false;
    $('btnPlayAgain').addEventListener('click', function () { location.href = location.pathname; });
    $('btnFreePlay').addEventListener('click', function () {
      end.hidden = true; W.mode = 'free'; Sim.closing = false; Sim.reopenStand(); TF.ui.api.play(); W.refresh(); if (TF.Crew) TF.Crew.refresh();
    });
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
