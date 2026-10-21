// Recurring campus events: Mrs. West dropping by the grill, and Antonio hacking the class agenda.
// Both are non-blocking: walkers, bubbles and a small DOM popup, driven by sim time.
(function (TF) {
  var C = TF.C, World = TF.World, Sim = TF.Sim;

  var Ev = {
    west: null, nextWest: Infinity, westVisits: 0, aliPausedSeconds: 0, aiAliChats: 0,
    hack: { phase: 'idle', t: 0, cooldown: 0, next: Infinity, spawnLeft: 0, spawnT: 0, hacks: 0, lastSpawned: 0, auto: 0 }
  };
  function rnd(a, b) { return a + (b - a) * Sim.rand(); }

  var TIPS = [
    { text: 'Great tacos, dear! +$5 tip', money: 5 },
    { text: 'Add more salsa! +10% price for 30s', boost: 30 },
    { text: 'Warm tortillas sell. +$5 tip', money: 5 },
    { text: 'Smile at the line! +10% price for 30s', boost: 30 }
  ];

  // ---- Mrs. West ----------------------------------------------------------------
  // Only once Ali is hired: every 60-120 sim-s she walks from Old Main to the grill, chats with
  // Ali for ~12 s (he stops cooking), leaves a tip or advice, then walks back.
  function westSpot() {
    var a = TF.Crew && TF.Crew.spotOf('ali');
    if (!a) return null;
    // Beside Ali on the camera side, so both stay visible.
    var cand = [[0.55, 0.25], [0.25, 0.55], [0.6, -0.2], [-0.2, 0.6]];
    for (var i = 0; i < cand.length; i++) {
      var x = a.x + cand[i][0], y = a.y + cand[i][1];
      if (World.walkable(Math.floor(x), Math.floor(y)) && !World.isLine(Math.floor(x), Math.floor(y))) return { x: x, y: y };
    }
    return { x: a.x + 0.5, y: a.y + 0.3 };
  }

  function startWest() {
    var spot = westSpot();
    if (!spot) return;
    var door = Sim.oldMainDoor();
    var w = Ev.west = {
      x: door.x + 0.5 + door.ox, y: door.y + 0.5 + door.oy, px: 0, py: 0, offX: 0, offY: 0, pOffX: 0, pOffY: 0,
      path: [], speed: 1.3, hx: 0, hy: 1, facing: 0, moving: false, anim: 0, phase: 'in', t: 0, tip: null, spot: spot, exit: door
    };
    w.px = w.x; w.py = w.y;
    w.path = [{ x: door.x + 0.5, y: door.y + 0.5 }];
    var tiles = World.astar(door.x, door.y, Math.floor(spot.x), Math.floor(spot.y));
    if (tiles) for (var i = 1; i < tiles.length; i++) w.path.push({ x: tiles[i].x + 0.5, y: tiles[i].y + 0.5 });
    w.path.push(spot);
    Ev.westVisits++;
  }

  function stepWest(dt) {
    if (!Ev.west) {
      if (TF.Crew && TF.Crew.hiredSet.ali && Sim.stand.placed) {
        if (Ev.nextWest === Infinity) Ev.nextWest = Sim.t + rnd(60, 120);
        if (Sim.t >= Ev.nextWest) startWest();
      }
      Sim.cookRate = 1;
      return;
    }
    var w = Ev.west;
    w.px = w.x; w.py = w.y;
    if (w.phase === 'chat') {
      w.moving = false;
      w.t -= dt;
      // Ali stops cooking to chat -- unless AI Ali takes the conversation for him.
      if (TF.Crew && TF.Crew.extras.aiali) { Sim.cookRate = 1; Ev.aiAliChats += dt; }
      else { Sim.cookRate = 0; Ev.aliPausedSeconds += dt; }
      if (w.t <= 0) {
        w.phase = 'out'; Sim.cookRate = 1;
        var tiles = World.exitPath(Math.floor(w.x), Math.floor(w.y), w.exit);
        w.path = (tiles || []).slice(1).map(function (t) { return { x: t.x + 0.5, y: t.y + 0.5 }; });
        w.path.push({ x: w.exit.x + 0.5 + w.exit.ox, y: w.exit.y + 0.5 + w.exit.oy });
      }
    } else if (Sim.walkEntity(w, dt, false)) {
      if (w.phase === 'in') {
        w.phase = 'chat'; w.t = rnd(10, 15);
        var tip = w.tip = TIPS[Math.floor(Sim.rand() * TIPS.length)];
        if (tip.money) { Sim.stats.money += tip.money; Sim.floaters.push({ x: w.x, y: w.y, text: '+$' + tip.money, t: 0 }); }
        if (tip.boost) Sim.priceBoostT = tip.boost;
        Sim.events.push({ type: 'toast', text: 'Mrs. West: “' + tip.text + '”' });
      } else {
        Ev.west = null;
        Ev.nextWest = Sim.t + rnd(60, 120);
      }
    }
    if (w.moving) Sim.faceEntity(w, w.hx, w.hy);
  }

  // ---- Antonio hacks the class agenda -------------------------------------------
  // Button (90 s cooldown) or now and then on its own: Antonio types ~2 s, a glitchy campus
  // schedule popup says classes are out, and ~50 students pour out of Old Main over ~10 s.
  Ev.canHack = function () { return !!(TF.Crew && TF.Crew.hiredSet.antonio) && Ev.hack.phase === 'idle' && Ev.hack.cooldown <= 0; };
  Ev.startHack = function (auto) {
    if (!Ev.canHack()) return false;
    var h = Ev.hack;
    h.phase = 'typing'; h.t = 2; h.cooldown = 90; h.hacks++; h.auto += auto ? 1 : 0;
    return true;
  };

  function stepHack(dt) {
    var h = Ev.hack;
    if (h.cooldown > 0) h.cooldown -= dt;
    var hasAntonio = TF.Crew && TF.Crew.hiredSet.antonio;
    if (hasAntonio && h.next === Infinity) h.next = Sim.t + rnd(150, 240);
    if (hasAntonio && h.phase === 'idle' && Sim.t >= h.next) { Ev.startHack(true); h.next = Sim.t + rnd(150, 240); }
    if (h.phase === 'typing') {
      h.t -= dt;
      if (h.t <= 0) {
        h.phase = 'wave'; h.spawnLeft = 50; h.spawnT = 0; h.lastSpawned = 0;
        Sim.capExtra = 70;
        Sim.events.push({ type: 'hack' });
      }
    } else if (h.phase === 'wave') {
      h.spawnT -= dt;
      var door = Sim.oldMainDoor();
      while (h.spawnT <= 0 && h.spawnLeft > 0) {
        h.spawnT += 10 / 50;
        h.spawnLeft--;
        var g = Sim.spawnGuest(door);
        g.x += (Sim.rand() - 0.5) * 0.6; g.px = g.x;
        g.fromHack = true;
        h.lastSpawned++;
      }
      if (h.spawnLeft <= 0) { h.phase = 'idle'; Sim.capExtra = 0; }
    }
  }

  // ---- Antonio's Twitch Raid ------------------------------------------------------
  // Button (120 s cooldown) or now and then on its own: "RAID!" in chat, his LIVE marker pulses,
  // and ~36 students arrive from the map edges (not Old Main, unlike the agenda hack).
  Ev.raid = { phase: 'idle', t: 0, cooldown: 0, next: Infinity, spawnLeft: 0, spawnT: 0, raids: 0, lastSpawned: 0, fromEdges: 0 };
  var RAIDERS = ['TacoTuesdayTV', 'BobcatGamer', 'QuadSquad', 'xX_Salsa_Xx', 'RoundRockRaids'];
  Ev.canRaid = function () { return !!(TF.Crew && TF.Crew.hiredSet.antonio) && Ev.raid.phase === 'idle' && Ev.raid.cooldown <= 0; };
  Ev.startRaid = function () {
    if (!Ev.canRaid()) return false;
    var r = Ev.raid;
    r.phase = 'incoming'; r.t = 1.5; r.cooldown = 120; r.raids++;
    var n = 30 + Math.floor(Sim.rand() * 40);
    Sim.events.push({ type: 'toast', text: '\uD83D\uDCE3 RAID! ' + RAIDERS[Math.floor(Sim.rand() * RAIDERS.length)] + ' is raiding with ' + n + ' viewers!' });
    return true;
  };
  function stepRaid(dt) {
    var r = Ev.raid;
    if (r.cooldown > 0) r.cooldown -= dt;
    var has = TF.Crew && TF.Crew.hiredSet.antonio;
    if (has && r.next === Infinity) r.next = Sim.t + rnd(200, 320);
    if (has && r.phase === 'idle' && Sim.t >= r.next) { Ev.startRaid(); r.next = Sim.t + rnd(200, 320); }
    if (r.phase === 'incoming') {
      r.t -= dt;
      if (r.t <= 0) { r.phase = 'wave'; r.spawnLeft = 36; r.spawnT = 0; r.lastSpawned = 0; r.fromEdges = 0; }
    } else if (r.phase === 'wave') {
      r.spawnT -= dt;
      var door = Sim.oldMainDoor(), edges = World.exits.filter(function (e) { return e !== door; });
      while (r.spawnT <= 0 && r.spawnLeft > 0) {
        r.spawnT += 8 / 36; r.spawnLeft--;
        var g = Sim.spawnGuest(edges[Math.floor(Sim.rand() * edges.length)]);
        g.fromRaid = true; r.lastSpawned++; r.fromEdges++;
      }
      if (r.spawnLeft <= 0) r.phase = 'idle';
    }
  }
  Ev.raidActive = function () { return Ev.raid.phase !== 'idle'; };

  // ---- Grackle Squad -------------------------------------------------------------
  // Every 70-130 s a flock of great-tailed grackles mobs the stand. With Matt hired he shoos them
  // off in ~1.5 s; without him they hang around ~8 s and ordering + hand-off run 50% slower.
  Ev.grackle = { phase: 'idle', t: 0, next: Infinity, birds: [], events: 0, slowSeconds: 0, shooed: 0 };
  Ev.startGrackles = function () {
    var g = Ev.grackle, st = Sim.stand;
    if (!st.placed || g.phase !== 'idle') return false;
    g.phase = 'arrive'; g.t = 1.4; g.events++; g.birds = [];
    var ang = Sim.rand() * Math.PI * 2;
    for (var i = 0; i < 7; i++) {
      var a = ang + (Sim.rand() - 0.5) * 0.8, tx = st.geom.cx + (Sim.rand() - 0.5) * 2.4, ty = st.geom.cy + 1 + (Sim.rand() - 0.5) * 2.4;
      g.birds.push({ x: tx + Math.cos(a) * 9, y: ty + Math.sin(a) * 9, tx: tx, ty: ty, h: 60, flap: Sim.rand() * 6, hop: Sim.rand() * 6 });
    }
    Sim.events.push({ type: 'toast', text: 'Grackles! The squad is mobbing the stand' });
    return true;
  };
  function stepGrackles(dt) {
    var g = Ev.grackle, st = Sim.stand;
    if (st.placed && g.next === Infinity) g.next = Sim.t + rnd(70, 130);
    if (g.phase === 'idle') { Sim.serviceSlow = 1; if (st.placed && Sim.t >= g.next) { Ev.startGrackles(); g.next = Sim.t + rnd(70, 130); } return; }
    g.t -= dt;
    g.birds.forEach(function (b) {
      b.flap += dt * 18;
      if (g.phase === 'arrive') { var k = Math.min(1, dt * 2.2); b.x += (b.tx - b.x) * k; b.y += (b.ty - b.y) * k; b.h += (0 - b.h) * k; }
      else if (g.phase === 'peck') { b.hop += dt * 5; b.h = Math.max(0, Math.sin(b.hop) * 3); }
      else { b.x += b.vx * dt; b.y += b.vy * dt; b.h += 40 * dt; }
    });
    var matt = TF.Crew && TF.Crew.hiredSet.matt;
    if (g.phase === 'arrive' && g.t <= 0) { g.phase = 'peck'; g.t = matt ? 1.5 : 8; }
    else if (g.phase === 'peck') {
      if (!matt) { Sim.serviceSlow = 1.5; g.slowSeconds += dt; }
      if (g.t <= 0 || (matt && g.t <= 0)) {
        if (matt) { g.shooed++; Sim.events.push({ type: 'toast', text: 'Matt: \u201CSHOO!\u201D' }); }
        g.phase = 'flee'; g.t = 1.6; Sim.serviceSlow = 1;
        g.birds.forEach(function (b) { var a = Math.atan2(b.y - st.geom.cy, b.x - st.geom.cx) + (Sim.rand() - 0.5); b.vx = Math.cos(a) * 7; b.vy = Math.sin(a) * 7; });
      }
    } else if (g.phase === 'flee' && g.t <= 0) { g.phase = 'idle'; g.birds = []; }
  }
  Ev.shooing = function () { return Ev.grackle.phase === 'peck' && TF.Crew && TF.Crew.hiredSet.matt; };

  Ev.step = function (dt) { stepWest(dt); stepHack(dt); stepRaid(dt); stepGrackles(dt); };

  // ---- Drawing ------------------------------------------------------------------
  Ev.items = function (items, alpha) {
    Ev.grackle.birds.forEach(function (b) { items.push({ kind: 'event', what: 'bird', b: b, x: b.x, y: b.y, k: b.x + b.y + 0.05 }); });
    var w = Ev.west;
    if (!w) return;
    var x = w.px + (w.x - w.px) * alpha, y = w.py + (w.y - w.py) * alpha;
    items.push({ kind: 'event', what: 'west', x: x, y: y, k: x + y });
  };
  Ev.draw = function (ctx, it, z) {
    if (it.what === 'bird') { drawBird(ctx, it.b, z); return; }
    var R = TF.Render, w = Ev.west;
    if (!w) return;
    var p = R.toScreen(it.x, it.y), P = TF.ArtPeople, painted = TF.Art.painted() && P && P.crew.west;
    var mirror = w.facing === 1 || w.facing === 2;
    if (w.phase === 'chat') {
      var ali = TF.Crew.spotOf('ali'), a = ali ? R.toScreen(ali.x, ali.y) : p;
      if (TF.Crew.extras.aiali) {
        a = R.toScreen(it.x - 0.45, it.y + 0.15);
        if (!(P && P.drawHolo(ctx, 'ali', a.x, a.y, z, a.x > p.x))) {
          ctx.globalAlpha = 0.6; TF.Crew.drawPlaceholder(ctx, 'ali', a.x, a.y, z, a.x > p.x); ctx.globalAlpha = 1;
        }
        R.text('AI', a.x, a.y - 36 * z, 7 * z, '#7fd8ff', 'rgba(0,30,60,0.85)');
      }
      mirror = a.x < p.x;
      w.mirror = mirror;
      if (!(TF.Art.painted() && P && P.drawWest(ctx, w, p.x, p.y, z, Math.floor(Sim.t * 1.2) % 6))) {
        if (painted) P.drawCrew(ctx, 'west', Math.floor(Sim.t * 1.5) % 2, p.x, p.y, z, mirror);
        else TF.Crew.drawPlaceholder(ctx, 'west', p.x, p.y, z, mirror);
      }
      // Speech bubble with her tip, heart over Ali.
      if (w.tip) bubble(ctx, w.tip.text, p.x, p.y - 44 * z, z);
      R.text('♥', a.x, a.y - 42 * z + Math.sin(Sim.t * 5) * 2 * z, 12 * z, '#e0406a', 'rgba(255,255,255,0.8)');
    } else {
      var swing = w.moving ? Math.sin(w.anim / 0.16 * Math.PI / 2) : 0;
      if (!(TF.Art.painted() && P && P.drawWest(ctx, w, p.x, p.y, z)) && !(painted && P.drawWalker(ctx, 'west', p.x, p.y, z, mirror, swing, null))) TF.Crew.drawPlaceholder(ctx, 'west', p.x, p.y, z, mirror, w);
    }
  };
  // A great-tailed grackle: glossy black body, long keel tail, yellow eye, flapping when airborne.
  function drawBird(ctx, b, z) {
    var R = TF.Render, p = R.toScreen(b.x, b.y), y = p.y - b.h * z;
    if (b.h < 4) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 3 * z, 1.2 * z, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#14141e';
    ctx.beginPath(); ctx.ellipse(p.x, y - 3 * z, 3.2 * z, 2 * z, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x - 2.5 * z, y - 3 * z); ctx.lineTo(p.x - 7 * z, y - 5 * z); ctx.lineTo(p.x - 6.5 * z, y - 1.5 * z); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + 2.8 * z, y - 5 * z, 1.6 * z, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(p.x + 3.1 * z, y - 5.5 * z, 0.8 * z, 0.8 * z);
    if (b.h > 2) {   // wings
      var f = Math.sin(b.flap) * 4 * z;
      ctx.strokeStyle = '#2a2a48'; ctx.lineWidth = 1.4 * z;
      ctx.beginPath(); ctx.moveTo(p.x - 1 * z, y - 4 * z); ctx.lineTo(p.x - 3 * z, y - 6 * z - f); ctx.moveTo(p.x + 1 * z, y - 4 * z); ctx.lineTo(p.x + 2 * z, y - 6 * z - f); ctx.stroke();
    }
  }

  function bubble(ctx, str, x, y, z) {
    ctx.font = 'bold ' + Math.round(8 * z) + 'px system-ui, sans-serif';
    var w = ctx.measureText(str).width + 10 * z, h = 13 * z;
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = '#8e5ba8'; ctx.lineWidth = 1.2 * z;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h, w, h, 4 * z); else ctx.rect(x - w / 2, y - h, w, h);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3 * z, y); ctx.lineTo(x + 3 * z, y); ctx.lineTo(x, y + 4 * z); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a2a5a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y - h / 2);
  }

  TF.Events = Ev;
})(window.TF);
