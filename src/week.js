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
    grill: 2, ali: 2, matt: 2, cooler2: 2, runner: 2,
    banner: 3, antonio: 3, phillip: 3,
    serving: 4, cannon: 4, aiali: 4, stand2: 4,
    canopy: 5, aaron: 5
  };
  var MAJOR = { grill: 1, banner: 1, serving: 1, canopy: 1, stand2: 1 };
  // Old Main class bells (item 7): seconds into OPEN. Each rings after a 5 s countdown and sends
  // a wave of students out; a Banner makes the wave bigger, Antonio's hype timed into it bigger still.
  var BELLS = [[90], [60, 135], [55, 130], [70, 140], [45, 120]];
  var BELL_WARN = 5, BELL_WAVE = 12, BELL_T = 20;

  var W = {
    mode: /[?&]mode=free/.test(location.search) ? 'free' : 'week',
    day: 1, phase: 'prep', t: 0, overtime: 0, majorUsed: false, eventsToday: 0,
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
  W.shopBlock = function (id) {
    if (!W.active()) return null;
    if (W.phase !== 'prep') return 'Shop opens in PREP';
    if (W.day < W.unlockDay(id)) return 'Day ' + W.unlockDay(id);
    if (W.isMajor(id) && W.majorUsed) return '1 big buy per day';
    return null;
  };
  W.bought = function (id) { if (W.active() && W.isMajor(id)) W.majorUsed = true; };

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
      gaveUp: Sim.stats.gaveUp, noline: Sim.stats.noline || 0, closed: Sim.stats.closedTurnaway || 0, bets: TF.Bets ? TF.Bets.bets.net : 0 };
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
      lost: { 'line too long': b.longline - a.longline, 'too pricey': b.pricey - a.pricey, 'gave up waiting': b.gaveUp - a.gaveUp, 'no line yet': b.noline - a.noline, 'closing time': b.closed - a.closed },
      neck: neck ? { name: neck, secs: Math.round(W.necks[neck]) } : null, betNet: betNet, hadBet: TF.Bets && W.day >= 3
    };
    r.hit = r.sold >= r.goal;
    W.results[W.day - 1] = r;
    showReport(r);
  }

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
      (r.hadBet ? '<div class="row"><span>Jared’s bets</span><b>' + (r.betNet === 0 ? 'no change' : (r.betNet > 0 ? '+$' : '-$') + Math.abs(r.betNet)) + '</b></div>' : '') +
      '<button id="btnNextDay">' + (r.day < 5 ? 'Next day →' : 'See how the week went →') + '</button>';
    card.hidden = false;
    $('btnNextDay').addEventListener('click', function () { TF.Audio.unlock(); r.day < 5 ? nextDay() : showEnding(); });
    W.refresh();
  }

  function nextDay() {
    card.hidden = true;
    W.day++; W.phase = 'prep'; W.majorUsed = false; W.t = 0;
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
  var hud = $('dayHud');
  W.refresh = function () {
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
    var txt = 'Day ' + W.day + '/5 · ' + clock + ' · 🌮 ' + sold + '/' + W.goal() + (cd ? ' · \uD83D\uDD14 ' + cd : W.bell ? ' · \uD83D\uDD14 RUSH' : '');
    hud.classList.toggle('bell', !!(W.bell && W.phase === 'open'));
    if (hud.textContent !== txt) hud.textContent = txt;
  };
  W.soldToday = function () { return W.today && W.phase !== 'prep' ? Sim.stats.served - W.today.served : 0; };

  TF.Week = W;
})(window.TF);
