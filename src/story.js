// Mrs. West's bet (Pass 5 item 5): she's an investor. Monday she sweeps across the quad and drops a
// gold envelope with a purse snap: a term sheet. "Hit my number in five days and I invest." A HUD meter
// tracks profit (cash on hand) vs. the target. One beat a day, always shown walking in from Old Main first, and never more than ~2 s
// at the stand: Mon envelope, Tue the Ali flirt gag, Wed an inspection clipboard challenge (serve 10
// in 40 s for a tip), Thu a sketch of her pop-up, Fri a limo for the verdict. Win: the Angel Round
// (a Free Play perk). Lose: her Designer Pop-Up opens on the quad (a comic ending, not a game over).
(function (TF) {
  var Sim = TF.Sim, World = TF.World, R = TF.Render;
  var S = { target: 690,   // tuned in Pass 5 item 10: decent scripted weeks (demand 0.3) made $654-726 profit
     started: false, envelope: false, walker: null, done: {}, challenge: null, log: [], verdict: null, angel: false, popup: false };
  S.BEAT_AT = 6;   // seconds into OPEN

  function W() { return TF.Week; }
  S.active = function () { return !!(W() && W().active()); };
  // profit = cash on hand + Jared's metals at today's price
  // profit = cash + metals - the Day 1 seed money (seed money isn't profit)
  S.profit = function () { var seed = TF.Week && TF.Week.active() ? TF.Week.SEED || 0 : 0; return Math.round(Sim.stats.money + (TF.Invest ? TF.Invest.metalValue() : 0) - seed); };

  // ---- The walker: Old Main door -> in front of the stand -> act (<= ~2 s) -> back -------------
  function spotNear(st) {
    var g = st.geom, c = [[1.3, 0.4], [0.4, 1.3], [1.4, -0.6], [-0.6, 1.4], [1.6, 1.6]];
    for (var i = 0; i < c.length; i++) {
      var x = g.cx + c[i][0], y = g.cy + c[i][1];
      if (World.walkable(Math.floor(x), Math.floor(y)) && !World.isLine(Math.floor(x), Math.floor(y))) return { x: x, y: y };
    }
    return { x: g.cx + 1.5, y: g.cy + 1.5 };
  }
  function startWalker(kind) {
    var st = Sim.stand, door = Sim.oldMainDoor(), spot = spotNear(st);
    var w = S.walker = { kind: kind, x: door.x + 0.5 + door.ox, y: door.y + 0.5 + door.oy, offX: 0, offY: 0, path: [], speed: 1.6, hx: 0, hy: 1,
      facing: 0, moving: false, anim: 0, phase: 'in', t: 0, exit: door, spot: spot };
    w.px = w.x; w.py = w.y;
    w.path.push({ x: door.x + 0.5, y: door.y + 0.5 });
    var tiles = World.astar(door.x, door.y, Math.floor(spot.x), Math.floor(spot.y));
    if (tiles) for (var i = 1; i < tiles.length; i++) w.path.push({ x: tiles[i].x + 0.5, y: tiles[i].y + 0.5 });
    w.path.push(spot);
    Sim.events.push({ type: 'toast', text: '👠 Mrs. West is crossing the quad…' });
  }
  // Her lines come from assets/dialogue/grok-dialogue.json (TF.Dialogue.west: mon..thu, fri_win/fri_lose);
  // LINES is only the fallback if a key is missing.
  var DAYKEY = { envelope: 'mon', ali: 'tue', walkby: 'tue', clipboard: 'wed', sketch: 'thu' };
  function westLine(kind) { var D = TF.Dialogue && TF.Dialogue.west; return (D && D[DAYKEY[kind]]) || LINES[kind] || ''; }
  var LINES = {
    envelope: 'A term sheet, gentlemen: hit my number by Friday and I invest.',
    clipboard: 'Inspection! Serve 10 in 40 seconds, darling.',
    sketch: 'My pop-up opens Friday… unless you impress me.',
    walkby: 'Where IS that handsome grill boy?'
  };
  function act(w) {
    w.phase = 'act'; w.t = 2.2; w.moving = false;
    if (w.kind === 'envelope') {
      S.started = true; S.envelope = true;
      w.snap = 0.6; Sim.events.push({ type: 'handoff' });   // the purse snap
      Sim.events.push({ type: 'toast', text: '\uD83D\uDCDC Term sheet: $' + S.target + ' profit by Friday \u2192 Mrs. West invests (the Angel Round).' });
      Sim.events.push({ type: 'toast', text: '\uD83D\uDCDC Term sheet: $' + S.target + ' profit by Friday \u2192 Mrs. West invests (the Angel Round).' });
    } else if (w.kind === 'clipboard') {
      S.challenge = { t: 40, base: Sim.stats.served, need: 10, done: false };
      Sim.events.push({ type: 'toast', text: '\uD83D\uDCCB Inspection! Serve 10 in 40 s for a $15 tip.' });
    }
    S.log.push({ day: W() ? W().day : 0, beat: w.kind, t: Math.round(Sim.t) });
  }

  S.step = function (dt) {
    if (!S.active()) return;
    var wk = W();
    // today's beat, a few seconds into OPEN
    if (wk.phase === 'open' && wk.t >= S.BEAT_AT && !S.done[wk.day] && Sim.stand.placed) {
      S.done[wk.day] = true;
      var kind = ['envelope', 'ali', 'clipboard', 'sketch', null][wk.day - 1];
      if (kind === 'ali') {
        // Tuesday is the Ali gag (her existing visit); without Ali she just walks by
        if (TF.Crew && TF.Crew.hiredSet.ali && TF.Events && TF.Events.startWestNow(true)) { S.log.push({ day: 2, beat: 'ali', t: Math.round(Sim.t) }); Sim.events.push({ type: 'toast', text: '👠 Mrs. West is crossing the quad… straight for Ali.' }); }
        else startWalker('walkby');
      } else if (kind) startWalker(kind);
    }
    var w = S.walker;
    if (w) {
      w.px = w.x; w.py = w.y;
      if (w.snap > 0) w.snap -= dt;
      if (w.phase === 'act') {
        w.t -= dt;
        if (w.t <= 0) {
          w.phase = 'out';
          var tiles = World.exitPath(Math.floor(w.x), Math.floor(w.y), w.exit);
          w.path = (tiles || []).slice(1).map(function (t) { return { x: t.x + 0.5, y: t.y + 0.5 }; });
          w.path.push({ x: w.exit.x + 0.5 + w.exit.ox, y: w.exit.y + 0.5 + w.exit.oy });
        }
      } else if (Sim.walkEntity(w, dt, false)) {
        if (w.phase === 'in') act(w); else S.walker = null;
      }
      if (w.moving) Sim.faceEntity(w, w.hx, w.hy);
    }
    // Wednesday's challenge: 10 served within 40 s earns a $15 tip
    var c = S.challenge;
    if (c && !c.done) {
      c.t -= dt;
      var got = Sim.stats.served - c.base;
      if (got >= c.need || c.t <= 0) {
        c.done = true; c.won = got >= c.need;
        if (c.won) { Sim.stats.money += 15; if (wk.earn) wk.earn(15); Sim.floaters.push({ x: Sim.stand.geom.cx, y: Sim.stand.geom.cy, text: '+$15 West tip', t: 0 }); }
        Sim.events.push({ type: 'toast', text: c.won ? 'Mrs. West: “Impressive. Here’s $15, darling.”' : 'Mrs. West: “Hmph. ' + got + ' in 40 seconds.”' });
      }
    }
  };

  // ---- Friday: the limo + verdict (played between the last report and the ending) -------------
  S.playVerdict = function (done) {
    var won = S.profit() >= S.target;
    S.verdict = { won: won, profit: S.profit(), t0: performance.now(), done: done };
    var st = Sim.stand;
    if (st.placed) R.centerOn(st.geom.cx, st.geom.cy + 0.5);
    setTimeout(function () { S.verdict.over = true; done(won); }, 3200);
  };

  // ---- HUD meter --------------------------------------------------------------------------
  var hud = document.getElementById('betHud');
  S.refresh = function () {
    if (!hud) return;
    var on = S.active() && S.started;
    hud.hidden = !on;
    if (!on) return;
    var p = S.profit(), c = S.challenge, txt = '👜 $' + p + ' / $' + S.target + (c && !c.done ? ' · 📋 ' + (Sim.stats.served - c.base) + '/10 ' + Math.ceil(c.t) + 's' : '');
    if (hud.textContent !== txt) hud.textContent = txt;
    hud.classList.toggle('ok', p >= S.target);
  };

  // ---- Drawing ----------------------------------------------------------------------------
  S.items = function (items, alpha) {
    var w = S.walker;
    if (w) {
      var x = w.px + (w.x - w.px) * alpha, y = w.py + (w.y - w.py) * alpha;
      items.push({ kind: 'story', plugin: S, what: 'west', x: x, y: y, k: x + y });
    }
    var st = Sim.stand;
    if (S.envelope && st.placed && (S.active() || S.angel)) {
      var o = st.geom.order, ex = o[0] + 0.5 - st.geom.n[0] * 0.9, ey = o[1] + 0.5 - st.geom.n[1] * 0.9;
      items.push({ kind: 'story', plugin: S, what: 'envelope', x: ex, y: ey, k: ex + ey + 0.6 });
    }
    if (S.angel && st.placed) items.push({ kind: 'story', plugin: S, what: 'angel', x: st.geom.cx, y: st.geom.cy, k: st.geom.cx + st.geom.cy + 2 });
    if (S.popup && S.popupAt) items.push({ kind: 'story', plugin: S, what: 'popup', x: S.popupAt.x + 1, y: S.popupAt.y + 1, k: S.popupAt.x + S.popupAt.y + 1.5 });
    if (S.verdict && !S.verdict.over) items.push({ kind: 'story', plugin: S, what: 'limo', x: 0, y: 0, k: 999 });
  };
  S.drawOverlay = function (ctx, z) {
    if (S.bubble) { R.pill(S.bubble.text, S.bubble.x, S.bubble.y, 9 * z, 'rgba(90,20,60,0.95)'); S.bubble = null; }
  };
  S.draw = function (ctx, it, z) {
    var p = R.toScreen(it.x, it.y);
    if (it.what === 'west') drawWest(ctx, S.walker, p, z);
    else if (it.what === 'envelope') drawEnvelope(ctx, R.toScreen(it.x, it.y, 22), z);
    else if (it.what === 'popup') drawPopup(ctx, it, z);
    else if (it.what === 'limo') drawLimo(ctx, z);
    else if (it.what === 'angel') { var q = R.toScreen(it.x, it.y, 92); R.pill('\u2726 ANGEL-BACKED \u2726', q.x, q.y, 8 * z, 'rgba(160,120,20,0.95)'); }
  };
  function drawWest(ctx, w, p, z) {
    var P = TF.ArtPeople, mirror = w.facing === 1 || w.facing === 2;
    if (w.phase === 'act') {
      var st = Sim.stand, s = R.toScreen(st.geom.cx, st.geom.cy);
      w.mirror = s.x < p.x;
      if (!(TF.Art.painted() && P && P.drawWest(ctx, w, p.x, p.y, z, 0))) TF.Crew.drawPlaceholder(ctx, 'west', p.x, p.y, z, w.mirror);
      if (w.kind === 'clipboard') {   // an oversized inspection clipboard
        ctx.fillStyle = '#8a5a2a'; ctx.fillRect(p.x + 4 * z, p.y - 32 * z, 14 * z, 18 * z);
        ctx.fillStyle = '#fff'; ctx.fillRect(p.x + 5.5 * z, p.y - 29 * z, 11 * z, 14 * z);
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(p.x + 8 * z, p.y - 34 * z, 6 * z, 3 * z);
        ctx.fillStyle = '#b8283a'; for (var i = 0; i < 4; i++) ctx.fillRect(p.x + 7 * z, p.y - (26 - i * 3) * z, 7 * z, 0.9 * z);
      } else if (w.kind === 'sketch') {   // a sketch of WEST & CO.
        var bx = p.x + 6 * z, by = p.y - 70 * z;
        ctx.fillStyle = '#fffaf0'; ctx.fillRect(bx, by, 46 * z, 32 * z);
        ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 1 * z; ctx.strokeRect(bx, by, 46 * z, 32 * z);
        ctx.beginPath(); ctx.moveTo(bx + 6 * z, by + 28 * z); ctx.lineTo(bx + 6 * z, by + 14 * z); ctx.lineTo(bx + 23 * z, by + 5 * z); ctx.lineTo(bx + 40 * z, by + 14 * z); ctx.lineTo(bx + 40 * z, by + 28 * z); ctx.stroke();
        R.text('WEST & CO.', bx + 23 * z, by + 19 * z, 5.5 * z, '#7a1e2c');
        R.text('$29 tacos', bx + 23 * z, by + 25 * z, 4.5 * z, '#555');
      } else if (w.kind === 'envelope' && w.snap > 0) {
        R.text('SNAP!', p.x - 14 * z, p.y - 28 * z, (10 + 6 * w.snap) * z, '#fff', 'rgba(200,150,20,0.95)');
      }
      S.bubble = { text: westLine(w.kind), x: p.x, y: p.y - 50 * z - (w.kind === 'sketch' ? 32 * z : 0) };   // drawn over everything
    } else {
      if (!(TF.Art.painted() && P && P.drawWest(ctx, w, p.x, p.y, z))) TF.Crew.drawPlaceholder(ctx, 'west', p.x, p.y, z, mirror, w);
      if (w.phase === 'in') R.text('👠', p.x, p.y - 42 * z, 10 * z, '#fff');
    }
  }
  function drawEnvelope(ctx, p, z) {
    ctx.fillStyle = '#e8c45a'; ctx.fillRect(p.x - 6 * z, p.y - 4 * z, 12 * z, 8 * z);
    ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = 1 * z; ctx.strokeRect(p.x - 6 * z, p.y - 4 * z, 12 * z, 8 * z);
    ctx.beginPath(); ctx.moveTo(p.x - 6 * z, p.y - 4 * z); ctx.lineTo(p.x, p.y + 1 * z); ctx.lineTo(p.x + 6 * z, p.y - 4 * z); ctx.stroke();
    ctx.fillStyle = '#b8283a'; ctx.beginPath(); ctx.arc(p.x, p.y + 0.5 * z, 1.6 * z, 0, Math.PI * 2); ctx.fill();
  }
  function drawLimo(ctx, z) {
    var v = S.verdict, st = Sim.stand, f = Math.min(1, (performance.now() - v.t0) / 1400);
    var ease = 1 - Math.pow(1 - f, 3);
    var y0 = st.geom.cy + 3.2, x = st.geom.cx - 12 + 11 * ease;
    var P = function (dx, dy, h) { return R.toScreen(x + dx, y0 + dy, h || 0); }, H = 16;
    R.poly([P(-1.8, 0.4), P(1.8, 0.4), P(1.8, 0.4, H), P(-1.8, 0.4, H)], '#111');
    R.poly([P(1.8, 0.4), P(1.8, -0.4), P(1.8, -0.4, H), P(1.8, 0.4, H)], '#1d1d1d');
    R.poly([P(-1.8, -0.4, H), P(1.8, -0.4, H), P(1.8, 0.4, H), P(-1.8, 0.4, H)], '#2a2a2a');
    for (var i = 0; i < 4; i++) R.poly([P(-1.4 + i * 0.75, 0.4, 7), P(-0.9 + i * 0.75, 0.4, 7), P(-0.9 + i * 0.75, 0.4, 13), P(-1.4 + i * 0.75, 0.4, 13)], '#3b4a5a');
    R.poly([P(-1.8, 0.4, 5), P(1.8, 0.4, 5), P(1.8, 0.4, 6), P(-1.8, 0.4, 6)], '#c9a227');   // gold trim
    if (f >= 1) {
      var b = P(0, 0, 40);
      var DW = TF.Dialogue && TF.Dialogue.west, txt = '$' + v.profit + '. \u201C' + ((DW && DW[v.won ? 'fri_win' : 'fri_lose']) || (v.won ? 'Gentlemen, I\u2019m investing.' : 'Adorable. My pop-up opens Monday.')) + '\u201D';
      R.pill('Mrs. West: ' + txt, b.x, b.y - 10 * z, 10 * z, v.won ? 'rgba(30,110,50,0.95)' : 'rgba(90,20,60,0.95)');
      R.text('SNAP!', b.x + 60 * z, b.y + 14 * z, 12 * z, '#fff', 'rgba(200,150,20,0.95)');
    }
  }
  // WEST & CO.: a white-and-gold designer booth with a $29 price board and nobody in line.
  function drawPopup(ctx, it, z) {
    var a = S.popupAt, P = function (x, y, h) { return R.toScreen(a.x + x, a.y + y, h || 0); }, H = 34;
    R.poly([P(0.1, 1.9), P(1.9, 1.9), P(1.9, 1.9, H), P(0.1, 1.9, H)], '#f6f1e6');
    R.poly([P(1.9, 1.9), P(1.9, 0.1), P(1.9, 0.1, H), P(1.9, 1.9, H)], '#e2dccd');
    R.poly([P(0, 0, H), P(2, 0, H), P(2, 2, H + 6), P(0, 2, H + 6)], '#c9a227');
    var s = P(1, 1.9, H * 0.6);
    R.text('WEST & CO.', s.x, s.y, 8 * z, '#7a1e2c');
    R.text('Artisanal tacos $29', s.x, s.y + 9 * z, 6 * z, '#555');
  }

  // Free Play after the ending: the Angel Round perk or the rival pop-up next door.
  S.applyEnding = function (won) {
    if (won) {
      S.angel = true;
      Sim.stats.money += 100;
      Sim.events.push({ type: 'toast', text: 'Angel Round: Mrs. West invests $100 for 10% of the stand. ANGEL-BACKED!' });
    } else {
      S.popup = true;
      var door = Sim.oldMainDoor(), best = null;
      for (var y = 1; y < World.H - 2; y++) for (var x = 1; x < World.W - 2; x++) {
        var ok = [[0, 0], [1, 0], [0, 1], [1, 1]].every(function (d) { var t = World.get(x + d[0], y + d[1]); return t === World.T.GRASS && !World.isStand(x + d[0], y + d[1]) && !World.isLine(x + d[0], y + d[1]) && !World.isObject(x + d[0], y + d[1]); });
        if (!ok) continue;
        var dd = Math.hypot(x - door.x, y - door.y);
        if (dd > 3 && (!best || dd < best.d)) best = { x: x, y: y, d: dd };
      }
      S.popupAt = best;
    }
  };

  TF.plugins.push(S);
  TF.Story = S;
})(window.TF);
