// Crew arcs + morning banter (Pass 5 item 8). One visual motif and one beat a day per character, no
// text walls; the lines come from assets/dialogue/grok-dialogue.json (TF.Dialogue).
//   Morning: one banter line on each PREP.
//   Ali: every other day (Mon/Wed/Fri, random time in OPEN) he goes off on the Mavericks / Cowboys:
//        spatula waving, a rant bubble, DISTRACTED, the grill at 35% for ~7 s. Thursday he hides from
//        Mrs. West; Friday you choose: he stands his ground, or he takes her tip.
//   Jared: a tiny gold jar fills day by day, a gold chain on Friday; Wednesday's wager: $15 says we
//        hit today's goal, pays $35.
//   Matt: from Wednesday the grackles have a crowned King; Friday is the showdown. Without Matt the
//        King steals a taco.
//   Phillip: sketches -> modded cannon -> prototype; on Friday the prototype speeds up the hand-off.
(function (TF) {
  var Sim = TF.Sim, R = TF.Render, World = TF.World;
  var D = TF.Dialogue || {};
  var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
  var A = { rant: null, rantAt: {}, said: {}, beats: [], banterDay: {}, wager: null, aliChoice: null, kingOn: false, kingDown: false, kingStole: {}, phillipDay: {} };
  A.rng = TF.Rng.story;
  Sim.rantRate = 1;
  function pick(a) { return a && a.length ? a[Math.floor(A.rng() * a.length)] : null; }
  function week() { return !!(TF.Week && TF.Week.active()); }
  function day() { return TF.Week ? TF.Week.day : 1; }
  function hired(id) { return !!(TF.Crew && TF.Crew.hiredSet[id]); }
  function beat(who, what) { A.beats.push({ day: day(), who: who, what: what }); }
  // A short speech bubble over a crew member (drawn over everything, by render's overlay pass).
  A.say = function (id, text, secs) { A.said[id] = { text: text, t: secs || 4 }; };

  // ---- Morning banter (PREP) ------------------------------------------------------------------------
  function banter() {
    var W = TF.Week;
    if (!week() || W.phase !== 'prep' || A.banterDay[W.day]) return;
    A.banterDay[W.day] = true;
    var b = pick(D.banter && D.banter[DAYS[W.day - 1]]);
    if (!b) return;
    A.lastBanter = b;
    Sim.events.push({ type: 'toast', text: '☀ ' + b.who + ': “' + b.line + '”' });
    beat('banter', b.who);
  }

  // ---- Ali's Dallas sports rant ------------------------------------------------------------------
  A.RANT = { secs: 7, rate: 0.35 };
  function rantLines() { return D.ali_sports_rants && D.ali_sports_rants.length ? D.ali_sports_rants : ['The Mavs traded WHO?!']; }
  function startRant() {
    A.rant = { t: A.RANT.secs, line: pick(rantLines()) };
    Sim.rantRate = A.RANT.rate;
    A.rants = (A.rants || 0) + 1;
    beat('ali', 'rant');
  }
  function stepRant(dt) {
    var W = TF.Week, d = day();
    if (A.rant) {
      A.rant.t -= dt;
      if (A.rant.t <= 0) { A.rant = null; Sim.rantRate = 1; }
      return;
    }
    Sim.rantRate = 1;
    if (!hired('ali') || !Sim.stand.placed || (TF.Events && TF.Events.westChat())) return;
    if (week()) {
      if (W.phase !== 'open' || d % 2 === 0) return;   // every other day: Mon, Wed, Fri
      if (A.rantAt[d] === undefined) A.rantAt[d] = 40 + A.rng() * 100;
      if (A.rantAt[d] !== null && W.t >= A.rantAt[d]) { A.rantAt[d] = null; startRant(); }
    } else {   // Free Play: about every 6 minutes
      if (A.nextFree === undefined) A.nextFree = Sim.t + 300 + A.rng() * 120;
      if (Sim.t >= A.nextFree) { A.nextFree = Sim.t + 300 + A.rng() * 120; startRant(); }
    }
  }
  A.ranting = function () { return !!A.rant; };
  A.startRant = startRant;   // test hook

  // ---- Jared: the jar, the chain, Wednesday's wager -----------------------------------------------
  function offerWager() {
    var W = TF.Week, el = document.getElementById('betCard');
    if (!week() || W.phase !== 'prep' || W.day !== 3 || A.wager || !el || Sim.stats.money < 15) return;
    A.wager = { offered: true };
    if (TF.Invest) TF.Invest.pitchDay[3] = true;   // today Jared pitches the wager instead of metals
    el.querySelector('.txt').textContent = 'Jared: “Weekly wager: $15 says we hit today’s goal (' + W.goal() + ' tacos). Pays $35.”';
    var row = el.querySelector('.btns'); row.innerHTML = '';
    [['Bet $15', 'wagerYes', function () { TF.Ledger.add('wager', -15, 'jared weekly wager'); A.wager.on = true; beat('jared', 'wager'); }], ['Pass', 'wagerNo', function () { A.wager.passed = true; }]].forEach(function (b) {
      var btn = document.createElement('button'); btn.textContent = b[0]; btn.id = b[1];
      btn.addEventListener('click', function () { el.hidden = true; b[2](); });
      row.appendChild(btn);
    });
    el.hidden = false;
  }
  // Called by Week at the end of a day (before the report): settle the wager.
  // new level: per-day beat schedules restart; the said-lines memory and beat log carry over (C3c)
  A.resetLevel = function () { A.rant = null; A.rantAt = {}; A.banterDay = {}; A.phillipDay = {}; A.kingOn = false; A.kingDown = false; A.kingStole = {}; A.wager = null; A.nextFree = undefined; };
  A.endDay = function (r) {
    var w = A.wager;
    if (w && w.on && !w.settled && r.day === 3) {
      w.settled = true; w.won = r.hit;
      if (r.hit) TF.Ledger.add('wager', 35, 'jared weekly wager won');
      Sim.events.push({ type: 'toast', text: 'Jared’s wager: ' + (r.hit ? '+$35. “' + (pick(D.jared && D.jared.coin_win) || 'Called it.') + '”' : 'lost the $15. “' + (pick(D.jared && D.jared.coin_lose) || 'Next time.') + '”') });
    }
    A.rant = null; Sim.rantRate = 1;
  };

  // ---- Ali vs. Mrs. West (Thursday hide, Friday choice) -----------------------------------------------
  function aliFriday() {
    var W = TF.Week, el = document.getElementById('betCard');
    if (!week() || W.day !== 5 || W.phase !== 'open' || W.t < 25 || A.aliChoice || !hired('ali') || !el) return;
    A.aliChoice = { offered: true };
    el.querySelector('.txt').textContent = 'Mrs. West is heading for Ali’s grill again…';
    var row = el.querySelector('.btns'); row.innerHTML = '';
    [['Ali stands his ground', 'aliStand', function () {
      A.aliChoice.pick = 'stand';
      A.say('ali', (D.ali && D.ali[3]) || 'Enough, Mrs. West. Step back from my station.', 4);
      beat('ali', 'stands his ground');
    }], ['Take her tip', 'aliTip', function () {
      A.aliChoice.pick = 'tip';
      if (TF.Events) TF.Events.startWestNow(true);
      TF.Ledger.add('tips', 10, 'west tip (ali)'); Sim.floaters.push({ x: Sim.stand.geom.cx, y: Sim.stand.geom.cy, text: '+$10 West tip', t: 0 });
      beat('ali', 'took the tip');
    }]].forEach(function (b) {
      var btn = document.createElement('button'); btn.textContent = b[0]; btn.id = b[1];
      btn.addEventListener('click', function () { el.hidden = true; b[2](); });
      row.appendChild(btn);
    });
    el.hidden = false;
  }
  A.aliHiding = function () {   // Thursday: while Mrs. West shows her sketch, Ali ducks behind the grill
    var w = TF.Story && TF.Story.walker;
    return !!(w && w.kind === 'sketch' && hired('ali'));
  };

  // ---- Matt vs. the Grackle King -----------------------------------------------------------------
  A.grackles = function (phase) {   // called by Events when a grackle mob arrives / gets shooed
    var d = day();
    A.kingOn = week() && d >= 3 && !A.kingDown;
    if (!A.kingOn && !(week() && hired('matt'))) return;
    if (phase === 'shoo' && hired('matt')) {
      var lines = D.matt || [];
      if (d === 5 && A.kingOn) {
        A.kingDown = true;
        Sim.events.push({ type: 'toast', text: '⚔ SHOWDOWN: Matt vs. the Grackle King! The King flees the quad for good.' });
        A.say('matt', lines[3] || 'Today the King falls.', 4);
        if (TF.Events) TF.Events.grackle.next = Infinity;   // no more grackles today
        beat('matt', 'showdown');
      } else {
        A.say('matt', lines[Math.min(lines.length - 1, Math.max(0, d - 2))] || 'SHOO!', 3);
        beat('matt', 'shoo');
      }
    }
    if (phase === 'peck' && !hired('matt') && A.kingOn && !A.kingStole[d] && Sim.stand.stock > 0) {
      A.kingStole[d] = true; Sim.stand.stock--;
      Sim.events.push({ type: 'toast', text: '👑 The Grackle King stole a taco!' });
      beat('king', 'stole a taco');
    }
  };

  // ---- Phillip's prototype -------------------------------------------------------------------------
  function phillip() {
    var W = TF.Week;
    if (!week() || W.phase !== 'open' || W.t < 12 || !hired('phillip') || A.phillipDay[W.day]) return;
    A.phillipDay[W.day] = true;
    var n = Object.keys(A.phillipDay).length, lines = D.phillip || [];
    var line = W.day === 5 ? (lines[3] || 'Final version.') : (lines[Math.min(n - 1, 2)] || 'Prototype time.');
    A.say('phillip', line, 4);
    beat('phillip', W.day === 5 ? 'prototype' : 'sketch ' + n);
    if (W.day === 5) { A.prototype = true; Sim.events.push({ type: 'toast', text: '🔧 Phillip’s prototype: hand-off 20% faster today.' }); }
  }
  // Friday hand-off bonus from Phillip's prototype (Sim reads this).
  A.handMul = function () { return A.prototype && week() && day() === 5 ? 0.8 : 1; };

  A.step = function (dt) {
    Object.keys(A.said).forEach(function (k) { A.said[k].t -= dt; if (A.said[k].t <= 0) delete A.said[k]; });
    stepRant(dt);
    phillip();
    aliFriday();
  };
  A.refresh = function () { banter(); offerWager(); };   // PREP-time beats (the sim is paused in PREP)

  // ---- Drawing: hooks from the crew drawing + the overlay pass ----------------------------------------
  A.drawCrew = function (ctx, id, p, z, mir) {
    if (id === 'ali' && A.rant) {   // spatula waving + DISTRACTED
      var a = Math.sin(performance.now() / 70) * 0.9, s = mir ? -1 : 1;
      ctx.save(); ctx.translate(p.x + s * 6 * z, p.y - 22 * z); ctx.rotate(-1.2 * s + a);
      ctx.fillStyle = '#7a5230'; ctx.fillRect(0, -1 * z, 9 * z, 2 * z);
      ctx.fillStyle = '#c0c4c8'; ctx.fillRect(8 * z, -3 * z, 6 * z, 6 * z);
      ctx.restore();
      A.bubbles.push({ text: '🏀🏈 ' + A.rant.line, x: p.x, y: p.y - 66 * z, bg: 'rgba(0,40,110,0.95)' });
      A.bubbles.push({ text: '😤 DISTRACTED', x: p.x, y: p.y - 48 * z, bg: 'rgba(200,90,20,0.95)', small: true });
    }
    if (id === 'ali' && A.aliHiding()) R.text('😰 (hiding)', p.x, p.y - 40 * z, 8 * z, '#fff', 'rgba(60,30,90,0.9)');
    if (id === 'jared' && week()) {   // the gold jar fills day by day; on Friday it's a gold chain
      if (day() >= 5) {
        ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 1.6 * z;
        ctx.beginPath(); ctx.arc(p.x, p.y - 23 * z, 4 * z, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(p.x, p.y - 18.5 * z, 1.8 * z, 0, Math.PI * 2); ctx.fill();
      } else {
        var jx = p.x + (mir ? 10 : -10) * z, jy = p.y - 8 * z, f = Math.min(1, (day() - 1) / 4 + 0.08);
        ctx.fillStyle = 'rgba(220,240,255,0.6)'; ctx.fillRect(jx - 3 * z, jy - 8 * z, 6 * z, 8 * z);
        ctx.fillStyle = '#ffd23a'; ctx.fillRect(jx - 3 * z, jy - 8 * z * f, 6 * z, 8 * z * f);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 0.8 * z; ctx.strokeRect(jx - 3 * z, jy - 8 * z, 6 * z, 8 * z);
      }
    }
    var s2 = A.said[id];
    if (s2) A.bubbles.push({ text: s2.text, x: p.x, y: p.y - 56 * z, bg: 'rgba(60,30,20,0.92)' });
  };
  A.bubbles = [];
  A.drawOverlay = function (ctx, z) {
    A.bubbles.forEach(function (b) { R.pill(b.text, b.x, b.y, (b.small ? 7 : 8.5) * z, b.bg); });
    A.bubbles = [];
  };
  A.crowned = function () { return A.kingOn && !A.kingDown; };

  TF.plugins.push(A);
  TF.Arcs = A;
})(window.TF);
