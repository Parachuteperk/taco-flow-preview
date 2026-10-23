// Antonio's hacker ladder (Pass 5 item 6). In Taco Week you hire Antonio from the Hire menu (Pass 7:
// he no longer joins for free on Monday); once hired, each weekday brings a different hack. One hack a day, always player-triggered,
// and before you commit the card shows expected customers, timing and overload risk. He makes
// demand, not service: the stand has to handle what he brings. Free Play keeps the old buttons.
//   Mon L1 Agenda Swap: a room's agenda flips to TACO BREAK, +8 students over 25 s
//   Tue L2 TACO-NET:    fake campus Wi-Fi splash page, +15% buyers for 40 s, then 10 s of no Wi-Fi
//   Wed L3 Early Bell:  the next bell wave comes 20 s early (same crowd, sooner)
//   Thu L4 Stream Raid: +12 in 2 groups; if the wait is over 30 s, half the 2nd group bails
//   Fri L5 Operation GOLDEN TACO: 3 waves of +8 every 20 s, +$1 on every taco until 8 walk away
(function (TF) {
  var Sim = TF.Sim, World = TF.World, R = TF.Render;
  var $ = function (id) { return document.getElementById(id); };
  var H = { used: {}, log: [], run: null, buyMul: 1, outT: 0, premium: null, billboardT: 0 };
  H.LEVELS = [
    { id: 'agenda', name: 'Agenda Swap', what: 'A room’s agenda flips to “TACO BREAK”.', expect: 8, secs: 25, gapS: 3 },
    { id: 'tacnet', name: 'TACO-NET Wi-Fi', what: 'A fake campus Wi-Fi splash page: +15% buyers near the stand, then 10 s of no Wi-Fi.', expect: 0, secs: 40, buyPct: 15, outS: 10 },
    { id: 'earlybell', name: 'Early Bell', what: 'The next bell rings 20 s early. Same crowd, sooner: clear the line first!', expect: 0, secs: 0, shiftS: 20 },
    { id: 'raid', name: 'Stream Raid', what: '“CHAT. WE ARE ACTUALLY SELLING TACOS.” +12 viewers in 2 groups; over 30 s of wait and half the 2nd group bails.', expect: 12, secs: 12, bailWaitS: 30 },
    { id: 'golden', name: 'Operation GOLDEN TACO', what: 'Hijacks the campus events screen: 3 waves of +8, and +$1 on every taco until 8 people walk away.', expect: 24, secs: 45, waves: 3, waveSize: 8, gapS: 20, premium: 1, walkAway: 8 }
  ];
  var LV = {}; H.LEVELS.forEach(function (L) { LV[L.id] = L; });   // the numbers below (and on Antonio's card) come from here
  H.hired = function () { return !!(TF.Crew && TF.Crew.hiredSet.antonio); };
  H.week = function () { return !!(TF.Week && TF.Week.active()); };
  H.level = function () { return H.week() ? Math.max(1, Math.min(5, TF.Week.day)) : 1; };
  H.today = function () { return H.LEVELS[H.level() - 1]; };
  H.can = function () {
    if (!H.week() || !H.hired() || TF.Week.phase !== 'open' || H.used[TF.Week.day] || H.run) return false;
    if (H.today().id === 'earlybell') return nextBellIn() !== null && nextBellIn() > LV.earlybell.shiftS + 2;
    return true;
  };
  function nextBellIn() { var W = TF.Week; return W.bells && W.bells.length ? W.bells[0] - W.t : null; }

  // ---- Preview -------------------------------------------------------------------------------
  function forecast() {
    var L = H.today(), st = Sim.stand, rate = 1 / Math.max(0.5, st.mods.orderT), free = Math.max(0, st.cap - st.queue.length);
    var expect = L.expect, timing = 'over ' + L.secs + ' s';
    if (L.id === 'tacnet') { expect = Math.round(Sim.guests.length * 0.3 * 0.15 + 3); timing = '40 s, then 10 s of no Wi-Fi'; }
    if (L.id === 'earlybell') { var b = nextBellIn(); expect = 0; timing = b === null ? 'no bell left today' : 'next bell in ' + Math.round(b) + ' s → ' + Math.max(0, Math.round(b - 20)) + ' s'; }
    if (L.id === 'golden') timing = '3 waves, 20 s apart';
    var capacity = free + rate * Math.max(5, L.secs);
    var load = L.id === 'earlybell' ? (st.queue.length > st.cap * 0.5 ? 2 : st.queue.length > 2 ? 1 : 0) : expect > capacity ? 2 : expect > free ? 1 : 0;
    return { expect: expect, timing: timing, risk: ['Low', 'Medium', 'High'][load], free: free };
  }
  var card = $('hackCard');
  H.preview = function () {
    if (!H.can()) return false;
    var L = H.today(), f = forecast();
    H.shown = { level: H.level(), id: L.id, f: f };
    card.innerHTML = '<h2>💻 Antonio, level ' + H.level() + ' hacker</h2>' +
      '<p><b>' + L.name + '</b>: ' + L.what + '</p>' +
      '<div class="row"><span>Expected customers</span><b>' + (L.id === 'earlybell' ? 'same bell, earlier' : '+' + f.expect) + '</b></div>' +
      '<div class="row"><span>Timing</span><b>' + f.timing + '</b></div>' +
      '<div class="row"><span>Overload risk</span><b class="risk' + f.risk + '">' + f.risk + (f.risk !== 'Low' ? ' (' + f.free + ' free spots in line)' : '') + '</b></div>' +
      '<div class="btns"><button id="btnHackGo">Run hack</button><button id="btnHackCancel">Not now</button></div>';
    card.hidden = false;
    $('btnHackGo').addEventListener('click', function () { card.hidden = true; H.start(); });
    $('btnHackCancel').addEventListener('click', function () { card.hidden = true; });
    return true;
  };

  // ---- Running hacks ------------------------------------------------------------------------------
  H.start = function () {
    if (!H.can()) return false;
    var L = H.today(), day = TF.Week.day;
    H.used[day] = true;
    H.run = { id: L.id, t: 0, spawned: 0, waves: 0, bailed: 0 };
    H.log.push({ day: day, level: H.level(), id: L.id, t: Math.round(TF.Week.t) });
    H.typingT = 1.5;   // Antonio types furiously (crew drawing)
    var pop = { agenda: ['CAMPUS AGENDA', 'Room 210: TACO BREAK', 'Agenda Swap!'], tacnet: ['TXST-GUEST Wi-Fi', 'Free Wi-Fi! Accept: “I love tacos”', 'TACO-NET is live!'],
      earlybell: ['OLD MAIN BELL', 'Schedule override: bell -20 s', 'Early Bell! “I KNOW the dean, young man!”'], raid: ['LIVE: 12 viewers', 'CHAT. WE ARE ACTUALLY SELLING TACOS.', 'Stream Raid!'],
      golden: ['CAMPUS EVENTS', 'OPERATION GOLDEN TACO', 'Operation GOLDEN TACO!'] }[L.id];
    // Antonio's line from assets/dialogue/grok-dialogue.json (TF.Dialogue.antonio.lvlN_...)
    var DA = TF.Dialogue && TF.Dialogue.antonio, key = DA && Object.keys(DA).filter(function (k) { return k.indexOf('lvl' + H.level()) === 0; })[0];
    var said = key && DA[key].length ? DA[key][Math.floor(TF.Rng.ambient() * DA[key].length)] : null;
    Sim.events.push({ type: 'hackpop', title: pop[0], body: pop[1], text: pop[2] + (said ? ' Antonio: \u201C' + said + '\u201D' : '') });
    if (L.id === 'earlybell') {
      var W = TF.Week;
      W.bells[0] = Math.max(W.t + 6, W.bells[0] - LV.earlybell.shiftS);
      H.run.done = true; H.run.shifted = LV.earlybell.shiftS;
    }
    if (L.id === 'golden') { H.premium = { on: true, lost0: Sim.lostTotal(), earned: 0 }; H.billboardT = 50; }
    return true;
  };
  function spawnFrom(edges) {
    var door = Sim.oldMainDoor(), ex = edges ? World.exits.filter(function (e) { return e !== door; }) : [door];
    var g = Sim.spawnGuest(ex[Math.floor(Sim.rand() * ex.length)]);
    g.x += (Sim.rand() - 0.5) * 0.6; g.px = g.x; g.fromHack = true;
    H.run.spawned++;
  }
  H.step = function (dt) {
    if (H.outT > 0) H.outT -= dt;
    if (H.billboardT > 0) H.billboardT -= dt;
    var r = H.run;
    if (r && !r.done) {
      r.t += dt;
      if (r.id === 'agenda') {
        while (r.spawned < LV.agenda.expect && r.t >= r.spawned * LV.agenda.gapS) spawnFrom(false);
        if (r.spawned >= LV.agenda.expect) r.done = true;
      } else if (r.id === 'tacnet') {
        H.buyMul = r.t < LV.tacnet.secs ? 1 + LV.tacnet.buyPct / 100 : 1;
        if (r.t >= LV.tacnet.secs) { r.done = true; H.outT = LV.tacnet.outS; Sim.events.push({ type: 'toast', text: '📵 Wi-Fi outage: “They clicked ACCEPT. That’s marketing.”' }); }
      } else if (r.id === 'raid') {
        var half = LV.raid.expect / 2;
        while (r.spawned < half && r.t >= r.spawned * 0.4) spawnFrom(true);
        if (r.t >= 10 && !r.second) {   // the second group checks the wait first
          r.second = true;
          var wait = Sim.predictedWait(Sim.stand);
          r.wait = Math.round(wait);
          if (wait > LV.raid.bailWaitS) { r.bailed = Math.floor(half / 2); Sim.lost['line full'] += 3; Sim.events.push({ type: 'toast', text: 'Raid group 2 saw a ' + Math.round(wait) + ' s wait: 3 bailed.' }); }
          r.second2 = half - r.bailed;
        }
        if (r.second) { while (r.spawned < half + r.second2 && r.t >= 10 + (r.spawned - half) * 0.4) spawnFrom(true); if (r.spawned >= half + r.second2) r.done = true; }
      } else if (r.id === 'golden') {
        var G = LV.golden, wave = Math.floor(r.t / G.gapS);
        if (wave < G.waves && r.waves <= wave) { r.waves = wave + 1; r.waveLeft = (r.waveLeft || 0) + G.waveSize; }
        while (r.waveLeft > 0 && (r.nextSp || 0) <= r.t) { spawnFrom(false); r.waveLeft--; r.nextSp = r.t + 0.5; }
        if (r.waves >= G.waves && !r.waveLeft && r.t > G.secs) r.done = true;
      }
    }
    if (r && r.done) { H.last = r; H.run = null; }
    if (H.typingT > 0) H.typingT -= dt;
    var p = H.premium;   // GOLDEN TACO's +$1 lasts the day, unless 8 people walk away
    if (p && p.on && Sim.lostTotal() - p.lost0 >= LV.golden.walkAway) {
      p.on = false; p.mocked = true;
      Sim.events.push({ type: 'toast', text: 'Mrs. West: \u201CAn event premium? Darling, they\u2019re LEAVING.\u201D (+$1 premium over)' });
    }
  };
  // Every taco paid during GOLDEN TACO carries a +$1 event premium (until 8 walk away).
  H.onPay = function () {
    var p = H.premium;
    if (!p || !p.on) return 0;
    p.earned++;
    return LV.golden.premium;
  };
  // new level's Monday: today's hack is available again and nothing from the old map keeps spawning (C3c)
  H.resetLevel = function () { H.endDay(); H.used = {}; H.typingT = 0; H.outT = 0; H.billboardT = 0; };
  H.endDay = function () { H.buyMul = 1; if (H.run) H.last = H.run; H.run = null; if (H.premium) H.premium.on = false; card.hidden = true; };

  // ---- The button --------------------------------------------------------------------------
  H.refreshButton = function (btn) {
    if (!H.week()) return false;
    if (!H.hired()) { btn.hidden = true; return true; }   // not on the crew yet: no hack button
    var L = H.today(), used = H.used[TF.Week.day];
    btn.hidden = !(TF.Week.phase === 'open' || TF.Week.phase === 'close');
    var t = used ? '💻 L' + H.level() + ' done ✔' : '💻 L' + H.level() + ': ' + L.name;
    if (btn.textContent !== t) btn.textContent = t;
    btn.disabled = !H.can();
    return true;
  };

  // ---- Visuals: the laptop levels up; GOLDEN TACO takes over the events screen ------------------
  H.drawLaptop = function (ctx, p, z, mir) {
    var lvl = H.week() ? H.level() : 1, s = mir ? -1 : 1, lx = p.x + s * 11 * z, ly = p.y - 12 * z;
    z *= 1.45;   // drawn a size up so the upgrades read at default zoom
    if (lvl >= 4) {   // glowing multi-screen terminal
      var glow = 0.55 + 0.35 * Math.sin(performance.now() / 200);
      ctx.fillStyle = 'rgba(80,255,120,' + (glow * 0.35).toFixed(2) + ')'; ctx.fillRect(lx - 16 * z, ly - 26 * z, 32 * z, 20 * z);
      [-10, 0, 10].forEach(function (dx, i) {
        ctx.fillStyle = '#111'; ctx.fillRect(lx + dx * z - 5 * z, ly - (i === 1 ? 26 : 22) * z, 10 * z, 8 * z);
        ctx.fillStyle = lvl >= 5 && i === 1 ? '#ffd23a' : '#50ff78'; ctx.fillRect(lx + dx * z - 4 * z, ly - (i === 1 ? 25 : 21) * z, 8 * z, 6 * z);
      });
    }
    ctx.fillStyle = '#333'; ctx.fillRect(lx - 5 * z, ly - 1 * z, 10 * z, 2 * z);   // the laptop
    ctx.fillStyle = lvl >= 2 ? '#202830' : '#8a8f96'; ctx.fillRect(lx - 4 * z, ly - 7 * z, 8 * z, 6 * z);
    ctx.fillStyle = '#50ff78'; ctx.fillRect(lx - 3 * z, ly - 6 * z, 6 * z, 4 * z);
    if (lvl >= 2) {   // stickers + an antenna
      ['#ff4a8a', '#ffd23a', '#4ad2ff'].forEach(function (c, i) { ctx.fillStyle = c; ctx.fillRect(lx - 4 * z + i * 3 * z, ly - 7.5 * z, 1.6 * z, 1.6 * z); });
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1 * z; ctx.beginPath(); ctx.moveTo(lx + 4 * z, ly - 7 * z); ctx.lineTo(lx + 7 * z, ly - 15 * z); ctx.stroke();
      ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.arc(lx + 7 * z, ly - 15 * z, 1.4 * z, 0, Math.PI * 2); ctx.fill();
    }
    if (H.outT > 0) R.text('NO WI-FI', lx, ly - 18 * z, 6 * z, '#fff', 'rgba(150,20,20,0.9)');
    R.text('L' + lvl, lx - s * 10 * z, ly - 4 * z, 6 * z, '#50ff78', 'rgba(0,0,0,0.75)');
  };
  H.items = function (items) {
    // the hijacked campus events screen stands just behind the stand, where the player is looking
    if (H.billboardT > 0 && Sim.stand.placed) items.push({ kind: 'hackfx', plugin: H, x: Sim.stand.geom.cx - 2.2, y: Sim.stand.geom.cy - 2.2, k: 9999 });
    if (H.run && H.run.id === 'tacnet' && !H.run.done && Sim.stand.placed) items.push({ kind: 'hackfx', plugin: H, wifi: true, x: Sim.stand.geom.cx, y: Sim.stand.geom.cy, k: 9998 });
  };
  H.draw = function (ctx, it, z) {
    var p = R.toScreen(it.x, it.y, it.wifi ? 70 : 60);
    if (it.wifi) {   // pulsing Wi-Fi arcs over the stand
      var a = (performance.now() / 500) % 1;
      ctx.strokeStyle = 'rgba(80,200,255,' + (1 - a).toFixed(2) + ')'; ctx.lineWidth = 2.5 * z;
      for (var k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(p.x, p.y, (6 + k * 6 + a * 6) * z, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      R.text('TACO-NET', p.x, p.y + 6 * z, 8 * z, '#fff', 'rgba(20,80,140,0.9)');
      return;
    }
    // the campus events screen, hijacked: a giant spinning golden taco
    var w = 120 * z, h = 70 * z, x0 = p.x - w / 2, y0 = p.y - h - 30 * z;
    ctx.fillStyle = '#111'; ctx.fillRect(x0 - 4 * z, y0 - 4 * z, w + 8 * z, h + 8 * z);
    ctx.fillStyle = '#2a1a00'; ctx.fillRect(x0, y0, w, h);
    var sc = 1 + 0.12 * Math.sin(performance.now() / 160);
    R.text('🌮', p.x, y0 + h * 0.45, 34 * z * sc, '#ffd23a');
    R.text('OPERATION GOLDEN TACO', p.x, y0 + h - 9 * z, 8 * z, '#ffd23a', 'rgba(0,0,0,0.7)');
    ctx.fillStyle = '#555'; ctx.fillRect(p.x - 3 * z, y0 + h + 4 * z, 6 * z, 26 * z);
  };

  // Pass 7 (Aaron's playtest): Antonio used to be put on the crew here for free whenever Taco Week
  // booted. A new game starts with Jared only; Antonio is hired from the Hire menu like everyone else.

  TF.plugins.push(H);
  TF.Hacks = H;
})(window.TF);
