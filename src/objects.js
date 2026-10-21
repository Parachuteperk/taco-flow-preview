// Placed buildings (Pass 5 items 3, 4, 4b): the drink cooler, picnic tables + shade and trash
// cans. Bought from the Stand & crew panel, then placed by tapping a glowing tile (the player
// picks the spot; the money, permit or OPEN buy is only spent once it's placed). During OPEN a
// freshman builds it (TF.Build). Objects block walking, lines and stands on their tiles.
(function (TF) {
  var Sim = TF.Sim, World = TF.World, R = TF.Render, T = World.T;
  var O = { list: [], placing: null, day: { drinks: 0, drinkRev: 0 }, totals: { drinks: 0, drinkRev: 0, upkeep: 0, drinkCost: 0 } };

  // Kinds. valid(x, y) -> null when the footprint at (x, y) is OK, otherwise the reason.
  O.KINDS = {
    drinks: { name: 'Drink cooler', w: 1, h: 1, price: 40, upkeep: 2, max: 1, major: false,
      effect: '+$2 drinks, slower pickup', hint: 'Tap a glowing tile touching a PICKUP spot.' },
    picnic: { name: 'Picnic tables + shade', w: 2, h: 2, price: 55, upkeep: 4, max: 2, major: true, grassOnly: true,
      effect: '+8 s patience for 4 waiting', hint: 'Tap glowing lawn near your line (2\u00D72).',
      extraCheck: function (x, y) {
        var st = nearLine(x + 1, y + 1, 3.5);
        if (!st) return 'Too far: keep it within 3 tiles of your line';
        if (O.count('picnic', st)) return 'This stand already has picnic tables';
        return null;
      } },
    trash: { name: 'Trash can', w: 1, h: 1, price: 15, upkeep: 1, max: 2, major: false,
      effect: 'No litter within 4 tiles', hint: 'Tap a glowing tile (lawn or plaza).' }
  };
  // The stand whose line / window is within r tiles of (x, y).
  function nearLine(x, y, r) {
    var best = null;
    Sim.stands.forEach(function (st) {
      if (!st.placed) return;
      var pts = st.line.map(function (t) { return { x: t.x + 0.5, y: t.y + 0.5 }; }).concat([{ x: st.geom.cx, y: st.geom.cy }]);
      pts.forEach(function (p) { var d = Math.hypot(p.x - x, p.y - y); if (d <= r && (!best || d < best.d)) best = { st: st, d: d }; });
    });
    return best && best.st;
  }
  O.mask = new Uint8Array(World.W * World.H);
  World.isObject = function (x, y) { return x >= 0 && y >= 0 && x < World.W && y < World.H && O.mask[y * World.W + x] === 1; };
  var prevBlocked = World.blockedForStand;
  World.blockedForStand = function (x, y) { return (prevBlocked && prevBlocked(x, y)) || World.isObject(x, y); };

  function tiles(kind, x, y) {
    var k = O.KINDS[kind], out = [];
    for (var dy = 0; dy < k.h; dy++) for (var dx = 0; dx < k.w; dx++) out.push([x + dx, y + dy]);
    return out;
  }
  function freeGround(x, y, grassOnly) {
    var t = World.get(x, y);
    if (!World.inside(x, y)) return 'Off the quad';
    if (t === T.PATH) return 'Keep the footpath clear';
    if (t !== T.GRASS && !(t === T.PLAZA && !grassOnly)) return grassOnly && t === T.PLAZA ? 'Needs lawn, not plaza (people walk there)' : 'Something is in the way';
    if (World.isStand(x, y) || World.isPickup(x, y) || World.isLine(x, y) || World.blockedForStand(x, y)) return 'That tile is taken';
    return null;
  }
  function pickupOf(x, y) {   // the stand whose pickup tile (x, y) touches, if any
    for (var i = 0; i < Sim.stands.length; i++) {
      var st = Sim.stands[i];
      if (st.placed && st.geom.pickup.some(function (p) { return Math.abs(p[0] - x) + Math.abs(p[1] - y) === 1; })) return st;
    }
    return null;
  }
  O.reason = function (kind, x, y) {
    var k = O.KINDS[kind], ts = tiles(kind, x, y);
    for (var i = 0; i < ts.length; i++) { var r = freeGround(ts[i][0], ts[i][1], k.grassOnly); if (r) return r; }
    if (kind === 'drinks' && !pickupOf(x, y)) return 'The cooler must touch a PICKUP spot';
    return k.extraCheck ? k.extraCheck(x, y) : null;
  };
  O.validSpots = function (kind) {
    var out = [];
    for (var y = 0; y < World.H; y++) for (var x = 0; x < World.W; x++) if (!O.reason(kind, x, y)) out.push({ x: x, y: y });
    return out;
  };
  O.count = function (kind, st) { return O.list.filter(function (o) { return o.kind === kind && (!st || o.st === st); }).length; };
  O.of = function (kind, st) { return O.list.filter(function (o) { return o.kind === kind && o.ready && (!st || o.st === st); })[0] || null; };
  O.blockReason = function (kind) {
    var k = O.KINDS[kind];
    if (!Sim.stand.placed) return 'Place the stand first';
    if (kind === 'picnic') {   // one per stand
      var free = Sim.stands.some(function (st) { return st.placed && !O.count('picnic', st); });
      return free ? null : 'Owned';
    }
    if (O.count(kind) >= k.max) return k.max > 1 ? 'Max ' + k.max : 'Owned';
    return null;
  };

  // ---- Placement mode (main.js forwards taps while state.mode === 'object') ------------------
  O.begin = function (kind) {
    O.placing = { kind: kind, spots: O.validSpots(kind) };
    if (!O.placing.spots.length) { Sim.events.push({ type: 'toast', text: 'No room for a ' + O.KINDS[kind].name + ' right now.' }); O.placing = null; return false; }
    var mx = 0, my = 0;
    O.placing.spots.forEach(function (s) { mx += s.x; my += s.y; });
    R.centerOn(mx / O.placing.spots.length + 0.5, my / O.placing.spots.length + 0.5);
    TF.ui.setMode('object');
    TF.ui.setHint(O.KINDS[kind].hint + ' (Cancel: the Build button)', 6);
    return true;
  };
  O.cancel = function () { O.placing = null; };
  O.tap = function (x, y) {
    var p = O.placing;
    if (!p) return false;
    var why = O.reason(p.kind, x, y);
    if (why) { O.bad = { x: x, y: y, reason: why, t: performance.now() }; TF.ui.setHint(why, 2); return false; }
    var k = O.KINDS[p.kind], C = TF.Crew;
    if (!C.buyObject(p.kind, k.price)) return false;   // money / permit / reserve rules live in Crew
    var st = p.kind === 'drinks' ? pickupOf(x, y) : p.kind === 'picnic' ? nearLine(x + 1, y + 1, 3.5) : nearestStand(x, y);
    var o = { kind: p.kind, x: x, y: y, st: st, ready: false, day: TF.Week ? TF.Week.day : 0 };
    if (p.kind === 'picnic') o.seats = [null, null, null, null];
    O.list.push(o);
    tiles(p.kind, x, y).forEach(function (t) { O.mask[t[1] * World.W + t[0]] = 1; });
    World.version++;   // walkers re-route around it
    O.placing = null;
    TF.ui.setMode('idle');
    if (st && st.placed) R.centerOn(st.geom.cx, st.geom.cy + 0.5);   // back to the stand
    var done = function () { o.ready = true; };
    if (TF.Build) TF.Build.start({ st: st, id: p.kind, name: k.name, apply: done, at: { x: x + k.w / 2, y: y + k.h / 2 } }); else done();
    return true;
  };
  function nearestStand(x, y) {
    var best = null;
    Sim.stands.forEach(function (st) { if (st.placed) { var d = Math.hypot(st.geom.cx - x, st.geom.cy - y); if (!best || d < best.d) best = { st: st, d: d }; } });
    return best ? best.st : Sim.stand;
  }

  // ---- Drinks ----------------------------------------------------------------------------
  // Called when a student pays: 35% add a $2 drink while today's 25 last. A drink adds ~2 s to the
  // hand-off unless someone mans the pickup (Matt).
  O.DRINK = { p: 0.35, price: 2, cost: 0.5, perDay: 25, slow: 2 };
  O.rng = World.rng(31);   // its own stream: buying a cooler doesn't reshuffle the crowd
  O.onPay = function (g, st) {
    var c = O.of('drinks', st);
    if (!c || O.day.drinks >= O.DRINK.perDay || O.rng() >= O.DRINK.p) return 0;
    g.drink = true;
    O.day.drinks++; O.day.drinkRev += O.DRINK.price; O.totals.drinks++; O.totals.drinkRev += O.DRINK.price;
    return O.DRINK.price;
  };
  O.handExtra = function (g, st) { return g.drink && !(TF.Crew && TF.Crew.hiredSet.matt && st.idx === 0) ? O.DRINK.slow : 0; };

  // End of a Taco Week day: upkeep + drink costs come out of the till; returns the summary.
  O.endDay = function () {
    var up = 0;
    O.list.forEach(function (o) { up += O.KINDS[o.kind].upkeep; });
    var cost = Math.round(O.day.drinks * O.DRINK.cost);
    Sim.stats.money -= up + cost;
    O.totals.upkeep += up; O.totals.drinkCost += cost;
    var r = { drinks: O.day.drinks, drinkRev: O.day.drinkRev, upkeep: up, drinkCost: cost, litter: O.litter.length, litterPct: Math.round((1 - Math.min.apply(null, Sim.stands.map(function (st) { return st.litterMul || 1; }))) * 100) };
    O.day = { drinks: 0, drinkRev: 0 };
    return r;
  };

  // ---- Picnic tables + shade ------------------------------------------------------------------
  // Shade keeps up to 4 waiting customers near the tables patient for 8 s more (it adds no queue
  // capacity). Some customers who got their taco sit down to eat for a few seconds.
  O.SHADE = { bonus: 8, n: 4, r: 5 };
  O.shadeStats = { kept: 0, seated: 0 };
  O.patienceBonus = function (g) {
    var pc = O.of('picnic', g.st);
    if (!pc) return 0;
    var cx = pc.x + 1, cy = pc.y + 1;
    if (Math.hypot(g.x - cx, g.y - cy) > O.SHADE.r) return 0;
    // the first 4 in this stand's queue who are in the shade
    var n = 0, q = g.st.queue;
    for (var i = 0; i < q.length && n < O.SHADE.n; i++) {
      if (Math.hypot(q[i].x - cx, q[i].y - cy) > O.SHADE.r) continue;
      if (q[i] === g) return O.SHADE.bonus;
      n++;
    }
    return 0;
  };
  var SEATS = [[0.45, 0.35], [1.55, 0.35], [0.45, 1.65], [1.55, 1.65]];
  O.trySeat = function (g) {
    var pc = O.of('picnic', g.st);
    if (!pc || O.rng() > 0.6) return false;
    var k = pc.seats.indexOf(null);
    if (k < 0) return false;
    var seat = { x: pc.x + SEATS[k][0], y: pc.y + SEATS[k][1] };
    // walk to the lawn tile beside that seat, then step onto the bench
    var ax = Math.floor(seat.x) + (SEATS[k][0] < 1 ? -1 : 1), ay = Math.floor(seat.y);
    if (!World.walkable(ax, ay)) { ax = Math.floor(seat.x); ay = Math.floor(seat.y) + (SEATS[k][1] < 1 ? -1 : 1); }
    if (!World.walkable(ax, ay) || !Sim.pathTo(g, { x: ax, y: ay }, seat)) return false;
    pc.seats[k] = g; g.seat = { o: pc, k: k };
    g.state = 'TO_SEAT';
    O.shadeStats.seated++;
    return true;
  };
  O.freeSeat = function (g) { if (g.seat) { g.seat.o.seats[g.seat.k] = null; g.seat = null; } };

  // ---- Litter + trash cans ----------------------------------------------------------------------
  // A few seconds after getting a taco, half the customers drop the wrapper, unless a trash can is
  // within 4 tiles (then it goes in the can). Litter inside a stand's draw zone cuts its draw by 1%
  // a piece, up to 10%; every piece blows away / gets picked up after 90 s, so it's never permanent.
  O.LITTER = { p: 0.5, canR: 4, life: 90, max: 40, perPiece: 0.01, cap: 0.10 };
  O.litter = [];
  O.litterStats = { dropped: 0, binned: 0, expired: 0 };
  O.maybeLitter = function (g) {
    if (g.littered) return;
    g.littered = true;
    var can = O.list.filter(function (o) { return o.kind === 'trash' && o.ready && Math.hypot(o.x + 0.5 - g.x, o.y + 0.5 - g.y) <= O.LITTER.canR; })[0];
    if (can) { O.litterStats.binned++; can.binned = (can.binned || 0) + 1; can.flash = 0.6; return; }
    if (O.rng() >= O.LITTER.p) return;
    if (O.litter.length >= O.LITTER.max) O.litter.shift();   // capped for phones: the oldest goes
    O.litter.push({ x: g.x + (O.rng() - 0.5) * 0.3, y: g.y + (O.rng() - 0.5) * 0.3, t: 0, rot: O.rng() * 3, col: O.rng() < 0.5 ? '#f4efe4' : '#ffd23a' });
    O.litterStats.dropped++;
  };
  O.litterMul = function (st) { return st.litterMul || 1; };

  O.step = function (dt) {
    for (var i = O.litter.length - 1; i >= 0; i--) { O.litter[i].t += dt; if (O.litter[i].t > O.LITTER.life) { O.litter.splice(i, 1); O.litterStats.expired++; } }
    O.list.forEach(function (o) { if (o.flash > 0) o.flash -= dt; });
    Sim.stands.forEach(function (st) {
      if (!st.placed) return;
      var r = st.mods.zoneR, n = 0;
      for (var j = 0; j < O.litter.length; j++) if (Math.hypot(O.litter[j].x - st.geom.cx, O.litter[j].y - st.geom.cy) <= r) n++;
      st.litterN = n;
      st.litterMul = 1 - Math.min(O.LITTER.cap, n * O.LITTER.perPiece);
    });
  };

  // ---- Drawing ---------------------------------------------------------------------------
  O.items = function (items, alpha, ui) {
    if (O.litter.length) items.push({ kind: 'obj', plugin: O, litter: true, x: 0, y: 0, k: -1 });   // ground layer
    O.list.forEach(function (o) {
      var k = O.KINDS[o.kind];
      var big = o.kind === 'picnic';
      items.push({ kind: 'obj', plugin: O, o: o, x: o.x + k.w / 2, y: o.y + k.h / 2, k: o.x + o.y + k.w + k.h - (big ? 2.2 : 1.2), fadeBox: big ? { l: -44, r: 44, t: -78, b: 18 } : { l: -16, r: 16, t: -30, b: 4 } });
    });
  };
  O.drawOverlay = function (ctx, z) {   // glowing valid tiles + a rejected tap (called by render)
    var p = O.placing;
    if (p) {
      var pulse = 0.35 + 0.25 * Math.sin(performance.now() / 160);
      p.spots.forEach(function (s) {
        tiles(p.kind, s.x, s.y).slice(0, 1).forEach(function (t) { R.diamondFill(t[0], t[1], 'rgba(80,255,140,' + pulse.toFixed(2) + ')', '#2fbf5c'); });
      });
    }
    var b = O.bad;
    if (b && performance.now() - b.t < 2000) {
      R.diamondFill(b.x, b.y, 'rgba(230,30,30,0.6)', '#ff2b2b');
      var q = R.toScreen(b.x + 0.5, b.y + 0.5, 26);
      R.pill(b.reason, q.x, q.y, 10 * z, 'rgba(150,20,20,0.95)');
      O.lastBad = b.reason;
    }
  };
  O.draw = function (ctx, it, z) {
    if (it.litter) { drawLitter(ctx, z); return; }
    var o = it.o;
    ctx.save();
    ctx.globalAlpha = (it.fade || 1) * (o.ready ? 1 : 0.55);
    if (o.kind === 'drinks') drawDrinks(ctx, o, z);
    else if (o.kind === 'picnic') drawPicnic(ctx, o, z);
    else if (o.kind === 'trash') drawTrash(ctx, o, z);
    ctx.restore();
  };
  function drawLitter(ctx, z) {
    O.litter.forEach(function (l) {
      var p = R.toScreen(l.x, l.y), a = Math.min(1, (O.LITTER.life - l.t) / 10);
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(p.x, p.y); ctx.rotate(l.rot);
      ctx.fillStyle = l.col; ctx.fillRect(-3 * z, -2 * z, 6 * z, 4 * z);
      ctx.fillStyle = '#c62f2f'; ctx.fillRect(-3 * z, -0.5 * z, 6 * z, 1 * z);
      ctx.restore();
    });
  }
  function drawTrash(ctx, o, z) {
    var P = function (x, y, h) { return R.toScreen(o.x + x, o.y + y, h || 0); }, H = 20;
    R.poly([P(0.3, 0.7), P(0.7, 0.7), P(0.7, 0.7, H), P(0.3, 0.7, H)], '#2f6b3a');
    R.poly([P(0.7, 0.7), P(0.7, 0.3), P(0.7, 0.3, H), P(0.7, 0.7, H)], '#24542d');
    var lid = o.flash > 0 ? 4 : 0;   // the lid pops when a wrapper goes in
    R.poly([P(0.26, 0.26, H + 1 + lid), P(0.74, 0.26, H + 1 + lid), P(0.74, 0.74, H + 1 + lid), P(0.26, 0.74, H + 1 + lid)], '#3d8a4b', '#1d4424', 1);
    var l = P(0.5, 0.7, H * 0.5);
    R.text('\u267B', l.x - 2 * z, l.y, 8 * z, '#fff');
  }
  // A wooden table with two benches under a maroon-and-gold shade umbrella.
  function drawPicnic(ctx, o, z) {
    var P = function (x, y, h) { return R.toScreen(o.x + x, o.y + y, h || 0); };
    var c = P(1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 54 * z, 26 * z, 0, 0, Math.PI * 2); ctx.fill();   // shade
    var wood = '#a8743c', dark = '#7a5228';
    [[0.35, 0.5], [0.35, 1.5]].forEach(function (b) {   // benches
      R.poly([P(b[0] - 0.12, b[1] - 0.12, 7), P(1.65 + 0.12, b[1] - 0.12, 7), P(1.65 + 0.12, b[1] + 0.12, 7), P(b[0] - 0.12, b[1] + 0.12, 7)], dark);
    });
    R.poly([P(0.4, 0.75, 13), P(1.6, 0.75, 13), P(1.6, 1.25, 13), P(0.4, 1.25, 13)], wood, '#5a3a1a', 1);   // table top
    R.poly([P(0.4, 1.25, 13), P(1.6, 1.25, 13), P(1.6, 1.25, 10), P(0.4, 1.25, 10)], dark);
    var top = P(1, 1, 58), pole = P(1, 1, 13);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.moveTo(pole.x, pole.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    for (var i = 0; i < 8; i++) {   // umbrella: 8 stripes
      var a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2, rx = 46 * z, ry = 20 * z;
      ctx.fillStyle = i % 2 ? '#ffd23a' : '#7a1e2c';
      ctx.beginPath(); ctx.moveTo(top.x, top.y - 8 * z);
      ctx.lineTo(top.x + Math.cos(a0) * rx, top.y + Math.sin(a0) * ry + 6 * z);
      ctx.lineTo(top.x + Math.cos(a1) * rx, top.y + Math.sin(a1) * ry + 6 * z);
      ctx.closePath(); ctx.fill();
    }
  }
  function drawDrinks(ctx, o, z) {
    var c = R.toScreen(o.x + 0.5, o.y + 0.5), H = 16;
    var P = function (x, y, h) { return R.toScreen(o.x + x, o.y + y, h); };
    R.poly([P(0.2, 0.8, 0), P(0.8, 0.8, 0), P(0.8, 0.8, H), P(0.2, 0.8, H)], '#2a7fc9');    // front
    R.poly([P(0.8, 0.8, 0), P(0.8, 0.2, 0), P(0.8, 0.2, H), P(0.8, 0.8, H)], '#1d5f99');    // side
    R.poly([P(0.2, 0.2, H), P(0.8, 0.2, H), P(0.8, 0.8, H), P(0.2, 0.8, H)], '#e8f4ff');    // lid
    var l = P(0.5, 0.8, H * 0.55);
    R.text('AGUAS', l.x - 2 * z, l.y, 6 * z, '#fff');
    // three cups on the lid: horchata, jamaica, tamarindo
    ['#f3ead8', '#b0204a', '#9a5a20'].forEach(function (col, i) {
      var q = P(0.35 + i * 0.15, 0.5, H + 4);
      ctx.fillStyle = col; ctx.fillRect(q.x - 2 * z, q.y - 3 * z, 4 * z, 6 * z);
      ctx.fillStyle = '#fff'; ctx.fillRect(q.x - 2 * z, q.y - 4 * z, 4 * z, 1.2 * z);
    });
    if (o.ready && O.day.drinks >= O.DRINK.perDay) R.text('SOLD OUT', c.x, c.y - 30 * z, 7 * z, '#fff', 'rgba(160,30,30,0.9)');
  }

  TF.plugins.push(O);
  TF.Objects = O;
  if (TF.Crew) TF.Crew.buildMenu();   // the panel was built before this file loaded: add the building cards
})(window.TF);
