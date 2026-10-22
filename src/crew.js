// Stand tiers + crew: what each tier and hire changes in the station timings (Sim.mods), who is
// available when, where the crew stand, how they're drawn, and the one small menu panel.
(function (TF) {
  var C = TF.C, World = TF.World, Sim = TF.Sim, R = TF.Render;

  // The stand grows in visible pieces on its 2x2 footprint. Tier 0 = folding table + cooler.
  var TIERS = [
    { tier: 1, id: 'grill', name: 'Grill', effect: 'Much faster cooking', price: 25, unlock: 4 },
    { tier: 2, id: 'banner', name: 'Banner', effect: 'Bigger draw zone', price: 35, unlock: 8 },
    { tier: 3, id: 'serving', name: 'Serving station', effect: 'Pickup spot, faster hand-off', price: 45, unlock: 12 },
    { tier: 4, id: 'canopy', name: 'Canopy', effect: 'More passers-by stop', price: 60, unlock: 18 }
  ];
  var ROSTER = [
    { id: 'jared', name: 'Jared', role: 'Register + cooler', effect: 'Sells + restocks', price: 0, tier: 0, spot: 'in' },
    { id: 'ali', name: 'Ali', role: 'Grill', effect: 'Grill 40% faster', price: 20, tier: 1, spot: 'in' },
    { id: 'antonio', name: 'Antonio', role: 'Laptop + stream', effect: 'Hype: more students', price: 40, tier: 2, spot: 'out' },
    { id: 'phillip', name: 'Phillip', role: 'Prep', effect: 'Cooking 20% faster', price: 30, tier: 2, spot: 'out' },
    { id: 'matt', name: 'Matt', role: 'Hand-off', effect: 'Instant hand-off', price: 25, tier: 3, spot: 'in' },
    { id: 'aaron', name: 'Aaron', role: 'Manager', effect: 'Everyone 15% faster', price: 50, tier: 4, spot: 'out' },
    { id: 'runner', name: 'Freshman Runner', role: 'Supply runs', effect: 'Restocks from the van', price: 50, tier: 0, spot: 'none' }
  ];

  var EXTRAS = [
    { id: 'cooler2', name: 'Second cooler', effect: 'Double stock', price: 35, needs: function () { return Sim.stand.placed; }, needsText: 'Place the stand first' },
    { id: 'aiali', name: 'AI Ali', effect: 'Ali keeps cooking', price: 80, needs: function () { return Crew.hiredSet.ali && Sim.stand.tier >= 4; }, needsText: 'Needs Ali + Canopy' },
    { id: 'cannon', name: 'Phillip\u2019s Tortilla Cannon', effect: 'Hand-off 2x faster', price: 40, needs: function () { return Crew.hiredSet.phillip && Sim.stand.tier >= 3; }, needsText: 'Needs Phillip + Serving station' }
  ];

  var Crew = { hiredSet: { jared: true }, extras: {}, EXTRAS: EXTRAS, ROSTER: ROSTER, lastDrawn: [], spots: {}, spotKey: '', t: 0, flash: {}, TIERS: TIERS };

  Crew.hired = function () { return ROSTER.filter(function (r) { return Crew.hiredSet[r.id]; }).map(function (r) { return r.id; }); };
  Crew.tier = function () { return Sim.stand.tier; };

  // ---- Effects --------------------------------------------------------------
  // Station timings per stand. The crew (and the extras) work stand 1; stand 2 is run by its
  // Freshman Cashier alone, at its own tier's base speeds.
  Crew.applyMods = function () { (Sim.stands || [Sim.stand]).forEach(function (st) { modsFor(st); }); };
  function modsFor(st) {
    var h = st.idx === 0 ? Crew.hiredSet : {}, m = st.mods, t = st.tier;
    var ex = st.idx === 0 ? Crew.extras : {};
    m.orderT = C.ORDER_T; m.cookT = C.COOK_T; m.grill = C.GRILL; m.handT = C.HAND_T;
    m.zoneR = C.ZONE_R; m.buyP = C.BUY_P; m.spawnMul = 1; m.priceAdd = 0; m.serving = false; m.stockMax = C.STOCK_T0;
    if (t >= 1) { m.cookT = 2.4; m.stockMax = C.STOCK_GRILL; }
    if (t >= 2) m.zoneR += 2.5;
    if (t >= 3) { m.serving = true; m.handT = 0.6; }
    if (t >= 4) m.buyP = Math.min(0.95, m.buyP + 0.1);
    if (h.ali) { m.cookT *= 0.6; m.grill += 1; }
    if (h.phillip) m.cookT *= 0.8;
    if (h.matt) m.handT = 0.25;
    // In Taco Week Antonio makes demand only through his hacks (TF.Hacks), not as a passive boost.
    if (h.antonio && !(TF.Week && TF.Week.active())) { m.zoneR += 2; m.buyP = Math.min(0.95, m.buyP + 0.1); m.spawnMul *= 1.3; }
    if (h.aaron) { m.orderT *= 0.85; m.cookT *= 0.85; m.handT *= 0.85; }
    if (ex.cooler2 && t === 0) m.stockMax *= 2;
    m.cannon = !!(ex.cannon && h.phillip && t >= 3);
    if (m.cannon) m.handT *= 0.5;
  }

  // Second stand: Taco Week Day 4+ (one big buy), max 2. Comes with a Freshman Cashier; the
  // player places it with the same starter pins + suggested line.
  Crew.STAND2_PRICE = 125;
  Crew.buyStand2 = function () {
    if (Sim.stands.length >= Sim.MAX_STANDS || Sim.stats.money < Crew.STAND2_PRICE || blocked('stand2') || !Sim.stand.placed) return false;
    if (!reserveOk('stand2', Crew.STAND2_PRICE)) return false;
    Sim.stats.money -= Crew.STAND2_PRICE;
    if (TF.Week) TF.Week.bought('stand2');
    var st = Sim.addStand();
    if (TF.Invest) TF.Invest.noteBuy('stand2', Crew.STAND2_PRICE, st);
    st.needsBuild = !!(TF.Build && TF.Build.live());   // built (12 s) once it's placed
    Sim.sel = st.idx;
    Crew.applyMods();
    if (TF.Onboard) TF.Onboard.computeSpots();
    // Show the new spots: center on them (phones only see a slice of the quad).
    var sp = TF.Onboard && TF.Onboard.spots;
    if (sp && sp.length) {
      var mx = 0, my = 0;
      sp.forEach(function (o) { mx += o.sx + 1; my += o.sy + 1; });
      TF.Render.centerOn(mx / sp.length, my / sp.length);
      var on = sp.every(function (o) { var q = TF.Render.toScreen(o.sx + 1, o.sy + 1); return q.x > 20 && q.x < TF.Render.vw - 20 && q.y > 80 && q.y < TF.Render.vh - 40; });
      if (!on) TF.Render.centerOn(sp[0].sx + 1, sp[0].sy + 1);
    }
    Crew.open(false);
    if (TF.ui) { TF.ui.setMode('idle'); TF.ui.setHint('Second stand bought! Tap a glowing spot for the Freshman Cashier\u2019s stand.', 5); }
    Sim.events.push({ type: 'toast', text: 'Second stand! A Freshman Cashier signs up.' });
    Crew.refresh();
    return true;
  };

  // Placed buildings: the button starts placement; the money (and permit / OPEN buy) is spent
  // when the player taps a valid tile (TF.Objects.tap -> Crew.buyObject).
  Crew.startObject = function (id) {
    var k = TF.Objects.KINDS[id];
    if (TF.Objects.blockReason(id) || blocked(id) || Sim.stats.money < k.price) return false;
    if (!reserveOk(id, k.price)) return false;
    Crew.preConfirmed = id;   // the reserve was confirmed (or not needed) at the button
    Crew.open(false);
    return TF.Objects.begin(id);
  };
  Crew.buyObject = function (id, price) {
    if (blocked(id) || Sim.stats.money < price) return false;
    Sim.stats.money -= price;
    if (TF.Week) TF.Week.bought(id);
    Crew.preConfirmed = null;
    Crew.refresh();
    return true;
  };

  Crew.buyExtra = function (id) {
    var x = EXTRAS.filter(function (e) { return e.id === id; })[0];
    if (!x || Crew.extras[id] || !x.needs() || Sim.stats.money < x.price || blocked(id)) return false;
    if (!reserveOk(id, x.price)) return false;
    Sim.stats.money -= x.price;
    Crew.extras[id] = true;
    if (TF.Week) TF.Week.bought(id);
    if (id === 'cooler2' && Sim.stand.tier === 0) Sim.stand.stock += C.STOCK_T0;   // it arrives full
    Crew.applyMods();
    if (Sim.stand.placed) Sim.floaters.push({ x: Sim.stand.geom.cx, y: Sim.stand.geom.cy, text: x.name + '!', t: 0 });
    Crew.refresh();
    return true;
  };

  Crew.hire = function (id) {
    var r = ROSTER.filter(function (x) { return x.id === id; })[0];
    if (!r || Crew.hiredSet[id] || Sim.stand.tier < r.tier || Sim.stats.money < r.price || blocked(id)) return false;
    if (!reserveOk(id, r.price)) return false;
    Sim.stats.money -= r.price;
    if (TF.Week) TF.Week.bought(id);
    Crew.hiredSet[id] = true;
    Crew.applyMods();
    Crew.spotKey = '';
    Crew.flash[id] = 1.5;
    if (Sim.stand.placed) Sim.floaters.push({ x: Sim.stand.geom.cx, y: Sim.stand.geom.cy, text: r.name + ' hired!', t: 0 });
    Crew.refresh();
    return true;
  };
  Crew.buyTier = function (id) {
    var u = TIERS.filter(function (x) { return x.id === id; })[0];
    var week = TF.Week && TF.Week.active();
    var st = Sim.selected();
    // no sales-count gates: stand upgrades are limited only by cash (and, in Taco Week, the daily build permit)
    if (!u || st.tier !== u.tier - 1 || st.building || Sim.stats.money < u.price || blocked(id)) return false;
    if (!reserveOk(id, u.price)) return false;
    Sim.stats.money -= u.price;
    if (TF.Week) TF.Week.bought(id);
    if (TF.Invest) TF.Invest.noteBuy(u.id, u.price, st);
    st.building = u.id;
    var done = function () {
      st.building = null;
      Sim.setTier(u.tier, st);
      Crew.spotKey = '';
      if (st.placed) Sim.floaters.push({ x: st.geom.cx, y: st.geom.cy, text: u.name + '!', t: 0 });
      Crew.refresh();
    };
    // during OPEN a freshman builds it (6-12 s, the stand keeps selling); otherwise it's instant
    if (TF.Build && st.placed) TF.Build.start({ st: st, id: u.id, name: u.name, apply: done }); else done();
    Crew.refresh();
    return true;
  };

  // Taco Week shop rules (PREP only, unlocked by day, one big buy per day); null when allowed.
  function blocked(id) { return TF.Week ? TF.Week.shopBlock(id) : null; }
  // $20 operating reserve (Taco Week): a buy that would leave less asks for a second tap.
  Crew.confirmId = null;
  function reserveOk(id, price) {
    if (!(TF.Week && TF.Week.active())) return true;
    var left = Sim.stats.money - price;
    if (left >= TF.Week.RESERVE || Crew.confirmId === id) { Crew.confirmId = null; return true; }
    Crew.confirmId = id;
    Sim.events.push({ type: 'toast', text: 'That leaves $' + left + ', under the $' + TF.Week.RESERVE + ' reserve. Tap again to confirm.' });
    Crew.refresh();
    return false;
  }
  function label(id, normal) { return Crew.confirmId === id ? 'Confirm?' : normal; }
  Crew.blocked = blocked;
  // Closing-time moment: everyone at the stand cheers.
  Crew.cheer = function () { Crew.hired().forEach(function (id) { Crew.flash[id] = 2.5; }); };

  Crew.step = function (dt) {
    Crew.t += dt;
    Object.keys(Crew.flash).forEach(function (k) { Crew.flash[k] -= dt; if (Crew.flash[k] <= 0) delete Crew.flash[k]; });
  };

  // ---- Where the crew stand ---------------------------------------------------
  // Stand-local frame: n = order-side normal, p = pickup-side normal, origin = footprint centre.
  Crew.local = function (a, b) {   // a along the pickup normal, b along the order normal
    var g = Sim.stand.geom;
    return { x: g.cx + g.np[0] * a + g.n[0] * b, y: g.cy + g.np[1] * a + g.n[1] * b };
  };
  // Each in-stand crew member works a station piece and stands on the camera side of it
  // (bigger x + y = nearer the camera), so the table / grill / counter never hides them.
  var STATION = { jared: ['tablecooler', 'table'], ali: ['grill'], matt: ['counter'] };
  // Candidate offsets around a station: camera side only (dx + dy > 0.2), nearest first.
  var OFFS = [];
  for (var oy = -1.25; oy <= 1.26; oy += 0.25) for (var ox = -1.25; ox <= 1.26; ox += 0.25) if (ox + oy > 0.2 && Math.hypot(ox, oy) >= 0.4) OFFS.push([ox, oy]);
  OFFS.sort(function (a, b) { return Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]); });
  var HALF_W = { table: 32, tablecooler: 32, grill: 16, counter: 25, banner: 12 };   // screen px at zoom 1
  // True if a tree / lamp / bench / planter nearer the camera would cover someone standing at c
  // (in screen units at zoom 1).
  function propCovers(c) {
    var cs = (c.x - c.y) * (C.TW / 2), cy = (c.x + c.y) * (C.TH / 2), T = World.T;
    for (var y = Math.floor(c.y) - 1; y <= Math.floor(c.y) + 3; y++) for (var x = Math.floor(c.x) - 1; x <= Math.floor(c.x) + 3; x++) {
      var t = World.get(x, y);
      if (t !== T.TREE && t !== T.LAMP && t !== T.BENCH && t !== T.PLANTER) continue;
      if (x + y + 1 <= c.x + c.y) continue;   // behind
      var px = (x - y) * (C.TW / 2), py = (x + y + 1) * (C.TH / 2), b = R.propBox(t, 1);
      if (cs + 12 > px + b.l && cs - 12 < px + b.r && cy - 36 < py + b.b && cy > py + b.t) return true;
    }
    return false;
  }
  Crew.propCovers = propCovers;

  // True if a piece nearer the camera would be drawn over someone standing at c.
  function hiddenBy(c, pieces) {
    var ck = c.x + c.y, cs = (c.x - c.y) * (C.TW / 2);
    return pieces.some(function (p) {
      return p.x + p.y > ck && Math.abs((p.x - p.y) * (C.TW / 2) - cs) < (HALF_W[p.piece] || 20) + 8;
    });
  }
  function stationSpots(st) {
    st = st || Sim.stand;
    var out = {};
    if (!st.placed) return out;
    var pieces = R.standPieces(st.sx, st.sy, st.rot, st.tier, false, st).filter(function (p) { return p.piece !== 'canopy'; });
    var avoid = [Sim.windowPos(st)];
    for (var k = 0; k < 4; k++) avoid.push(Sim.pickupPos(k, st));
    if (st.poly.length > 1) avoid.push(st.poly[1]);
    var who = st.idx === 0 ? STATION : { cashier: ['tablecooler', 'table'] };
    Object.keys(who).forEach(function (id) {
      if (st.idx === 0 && (!Crew.hiredSet[id] || (id === 'jared' && st.trip))) return;
      if (id === 'cashier' && st.trip) return;
      var piece = pieces.filter(function (p) { return who[id].indexOf(p.piece) >= 0; })[0];
      if (!piece) return;
      var best = null, loose = null;
      for (var i = 0; i < OFFS.length && !best; i++) {
        var c = { x: piece.x + OFFS[i][0], y: piece.y + OFFS[i][1] };
        if (World.isLine(Math.floor(c.x), Math.floor(c.y)) || hiddenBy(c, pieces) || propCovers(c) || !World.inside(Math.floor(c.x), Math.floor(c.y))) continue;
        if (!loose) loose = c;
        var ok = pieces.every(function (p) { return p === piece || Math.hypot(p.x - c.x, p.y - c.y) > 0.5; }) &&
          avoid.every(function (a) { return Math.hypot(a.x - c.x, a.y - c.y) > 0.38; }) &&
          Object.keys(out).every(function (o) { return Math.hypot(out[o].x - c.x, out[o].y - c.y) > 0.45; });
        if (ok) best = c;
      }
      out[id] = best || loose || { x: piece.x + 0.45, y: piece.y + 0.45 };
    });
    return out;
  }
  Crew.spotOf = function (id) {
    if (Crew.spots[id]) return Crew.spots[id];
    if (id === 'cashier') return Sim.stands[1] ? stationSpots(Sim.stands[1]).cashier || null : null;
    return stationSpots(Sim.stand)[id] || null;
  };

  // Everyone without a station inside the stand gets a lawn tile next to it, camera side first.
  function computeSpots() {
    var st = Sim.stand, key = st.placed ? [st.sx, st.sy, st.rot, st.line.length, Crew.hired().join()].join('|') : '';
    if (key === Crew.spotKey) return;
    Crew.spotKey = key; Crew.spots = {};
    if (!st.placed) return;
    var g = st.geom, taken = {};
    var mark = function (t) { taken[t[0] + ',' + t[1]] = 1; };
    g.pickup.forEach(mark); mark(g.order);
    mark([Math.floor(g.cx + (g.n[0] + g.np[0]) * 1.25), Math.floor(g.cy + (g.n[1] + g.np[1]) * 1.25)]);
    st.line.forEach(function (t) { mark([t.x, t.y]); });
    var pieces = R.standPieces(st.sx, st.sy, st.rot, st.tier, false).filter(function (p) { return p.piece !== 'canopy'; });
    var inside = stationSpots();
    Object.keys(inside).forEach(function (id) { mark([Math.floor(inside[id].x), Math.floor(inside[id].y)]); });
    var cands = [];
    for (var y = st.sy - 2; y <= st.sy + 3; y++) for (var x = st.sx - 2; x <= st.sx + 3; x++) {
      var tt = World.get(x, y);
      if (World.isStand(x, y) || taken[x + ',' + y] || (tt !== World.T.GRASS && tt !== World.T.PLAZA)) continue;
      // Camera side of the stand and not behind any piece (nor under the canopy) scores best.
      var front = y >= st.sy + 2 || x >= st.sx + 2;
      var hid = hiddenBy({ x: x + 0.5, y: y + 0.5 }, pieces) || propCovers({ x: x + 0.5, y: y + 0.5 }) || (!front && st.tier >= 4);
      cands.push({ x: x, y: y, score: (front ? 0 : 10) + (hid ? 20 : 0) + (tt === World.T.PLAZA ? 1 : 0) + Math.max(Math.abs(x + 0.5 - g.cx), Math.abs(y + 0.5 - g.cy)) });
    }
    cands.sort(function (a, b) { return a.score - b.score; });
    ROSTER.forEach(function (r) {
      if (!Crew.hiredSet[r.id] || r.spot !== 'out') return;
      var c = cands.shift();
      if (c) Crew.spots[r.id] = { x: c.x + 0.5, y: c.y + 0.5 };
    });
  }

  function frameFor(id) {
    var st = Sim.stand, t = Crew.t;
    switch (id) {
      case 'jared': return st.window && !st.window.paid ? 1 : 0;
      case 'ali': return st.cook.grill.length && !(TF.Events && TF.Events.grillStalled && TF.Events.grillStalled()) ? (Math.floor(t * 3) % 2 ? 2 : 0) : 0;
      case 'matt': return st.pickup.some(function (g) { return g && g.order && g.order.ready; }) ? 1 : 0;
      case 'antonio': return 1;
      case 'phillip': return st.cook.grill.length || st.cook.pending.length ? 1 : 0;
      case 'west': return Math.floor(t / 0.8) % 2;
      case 'aaron': return Math.floor(t / 0.7) % 3;
    }
    return 0;
  }
  function busy(id) {
    var st = Sim.stand;
    if (id === 'jared') return !!st.window;
    if (id === 'ali' || id === 'phillip') return st.cook.grill.length > 0;
    if (id === 'matt') return st.pickup.some(Boolean);
    return true;
  }

  Crew.items = function (items) {
    Crew.lastDrawn = [];
    var st = Sim.stand;
    if (Sim.runner) {
      var r = Sim.runner, a = R.lastAlpha || 1;
      items.push({ kind: 'crew', id: 'jared', where: 'run', x: r.px + (r.x - r.px) * a, y: r.py + (r.y - r.py) * a, k: 0 });
      items[items.length - 1].k = items[items.length - 1].x + items[items.length - 1].y;
    }
    // Stand 2's Freshman Cashier: at the table, or out on a restock walk with the cooler.
    var s2 = Sim.stands && Sim.stands[1];
    if (s2 && s2.placed) {
      if (s2.trip) {
        var r2 = s2.trip, a2 = R.lastAlpha || 1, cx = r2.px + (r2.x - r2.px) * a2, cy = r2.py + (r2.y - r2.py) * a2;
        items.push({ kind: 'crew', id: 'cashier', where: 'run', st: s2, x: cx, y: cy, k: cx + cy });
      } else {
        var c2 = stationSpots(s2).cashier;
        if (c2) items.push({ kind: 'crew', id: 'cashier', where: 'in', st: s2, x: c2.x, y: c2.y, k: c2.x + c2.y });
      }
    }
    if (!st.placed) return;
    computeSpots();
    var ins = stationSpots(st);
    Object.keys(ins).forEach(function (id) {
      var p = ins[id];
      items.push({ kind: 'crew', id: id, where: 'in', st: st, x: p.x, y: p.y, k: p.x + p.y });
    });
    Object.keys(Crew.spots).forEach(function (id) {
      var p = Crew.spots[id];
      items.push({ kind: 'crew', id: id, where: 'out', x: p.x, y: p.y, k: p.x + p.y });
    });
  };

  // The Freshman Cashier (stand 2): a student sprite with a maroon visor + apron (code-drawn).
  function drawCashier(ctx, it, p, z) {
    var st = it.st, r = it.where === 'run' ? st.trip : null;
    var face = r ? null : R.toScreen(it.x + st.geom.n[0], it.y + st.geom.n[1]);
    var g = { variant: 1, facing: r ? r.facing : (face.x < p.x ? 1 : 0), moving: !!(r && r.moving), anim: r ? r.anim : 0, hasTaco: false, tall: 1,
      shirt: '#c9a227', skin: '#b07a50', hair: '#2a1b12', pants: '#2d3a5a', longHair: true, backpack: false, pack: '#222' };
    var bob = !r && st.window ? Math.abs(Math.sin(Crew.t * 7)) * 1.2 * z : 0;
    var P = TF.ArtPeople;
    if (!(TF.Art.painted() && P && P.drawGuest(ctx, g, p.x, p.y - bob, z))) R.drawPerson(g, p.x, p.y - bob, z);
    ctx.fillStyle = '#7a1e2c'; ctx.fillRect(p.x - 5 * z, p.y - 32 * z - bob, 10 * z, 2.5 * z);           // visor
    ctx.fillStyle = 'rgba(244,239,228,0.9)'; ctx.fillRect(p.x - 3.5 * z, p.y - 17 * z - bob, 7 * z, 8 * z); // apron
    if (r) {
      if (TF.Art.has('cooler')) { var im = TF.Art.img.cooler, cs = 18 * z / im.width; ctx.drawImage(im, p.x - 9 * z, p.y - 20 * z, im.width * cs, im.height * cs); }
      R.text('restocking', p.x, p.y - 40 * z, 7 * z, '#fff5d6', 'rgba(60,30,20,0.85)');
    }
    Crew.lastDrawn.push('cashier');
  }

  Crew.draw = function (ctx, it, z) {
    var st = it.st || Sim.stand, P = TF.ArtPeople, painted = TF.Art.painted() && P && P.crew[it.id];
    var p = R.toScreen(it.x, it.y);
    if (it.id === 'cashier') { drawCashier(ctx, it, p, z); return; }
    if (it.where === 'run') {
      var r = Sim.runner;
      if (!r) return;
      var mirror = r.facing === 1 || r.facing === 2, swing = r.moving ? Math.sin(r.anim / 0.16 * Math.PI / 2) : 0;
      if (painted) P.drawWalker(ctx, 'jared', p.x, p.y, z, mirror, swing, TF.Art.img.cooler);
      else { drawPlaceholderCrew(ctx, 'jared', p.x, p.y, z, mirror, r); ctx.fillStyle = '#c62f2f'; ctx.fillRect(p.x - 6 * z, p.y - 17 * z, 12 * z, 8 * z); ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 6 * z, p.y - 18 * z, 12 * z, 2.5 * z); }
      R.text('restocking', p.x, p.y - 40 * z, 7 * z, '#fff5d6', 'rgba(60,30,20,0.85)');
      Crew.lastDrawn.push('jared');
      return;
    }
    var hacking = it.id === 'antonio' && ((TF.Events && TF.Events.hack.phase === 'typing') || (TF.Hacks && TF.Hacks.typingT > 0));
    var fr = frameFor(it.id), bob = hacking ? Math.abs(Math.sin(Crew.t * 30)) * 1.6 * z : busy(it.id) ? Math.abs(Math.sin(Crew.t * 7)) * 1.2 * z : 0;
    // Crew inside the stand face its order side; crew outside face the stand.
    var face = it.where === 'in' ? R.toScreen(it.x + st.geom.n[0], it.y + st.geom.n[1]) : R.toScreen(st.geom.cx, st.geom.cy);
    var mir = face.x < p.x;
    var wc = TF.Events && TF.Events.westChat && TF.Events.westChat(), smitten = it.id === 'ali' && wc && wc.ct >= 0.5 && !Crew.extras.aiali;
    if (smitten) {   // Ali turns to face Mrs. West and stops cooking
      var wp = R.toScreen(wc.x, wc.y);
      mir = wp.x < p.x; fr = 0; bob = 0;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(mir ? -0.12 : 0.12); ctx.translate(-p.x, -p.y);
    }
    if (painted) P.drawCrew(ctx, it.id, fr, p.x, p.y - bob, z, mir);
    else drawPlaceholderCrew(ctx, it.id, p.x, p.y - bob, z, mir);
    if (smitten) { ctx.restore(); R.text('\u2026', p.x, p.y - 36 * z, 10 * z, '#fff'); }
    if (it.id === 'ali' && TF.Events && TF.Events.flustered > 0) {   // snapped back, flustered: sweat drops
      ctx.fillStyle = '#7fc8ff';
      [[-7, -30], [8, -33], [-3, -38]].forEach(function (d, i) { ctx.beginPath(); ctx.arc(p.x + d[0] * z, p.y + (d[1] + ((Crew.t * 20 + i * 5) % 6)) * z, 1.6 * z, 0, Math.PI * 2); ctx.fill(); });
    }
    if (hacking) {   // furious typing: green code pixels flying off the laptop
      for (var c = 0; c < 10; c++) {
        var ph = (Crew.t * 3 + c * 0.37) % 1;
        ctx.fillStyle = 'rgba(80,255,120,' + (1 - ph).toFixed(2) + ')';
        ctx.fillRect(p.x + (mir ? -1 : 1) * (6 + (c * 7) % 14) * z, p.y - (14 + ph * 26) * z, 2 * z, 2 * z);
      }
      R.text('> hack_agenda.exe', p.x, p.y - 46 * z, 7 * z, '#50ff78', 'rgba(0,0,0,0.75)');
    }
    var raiding = it.id === 'antonio' && TF.Events && TF.Events.raidActive();
    if (raiding) {   // LIVE marker pulses big during a raid
      var pulse = 1 + 0.35 * Math.abs(Math.sin(Crew.t * 9));
      R.text('\u25CF LIVE', p.x, p.y - 40 * z, 8 * z * pulse, '#ff3355', 'rgba(0,0,0,0.7)');
      R.text('RAID!', p.x, p.y - 52 * z, 9 * z * pulse, '#c58aff', 'rgba(40,0,60,0.85)');
    } else if (it.id === 'antonio' && Math.floor(Crew.t * (hacking ? 8 : 2)) % 2) R.text('\u25CF LIVE', p.x, p.y - 38 * z, 7 * z, '#ff4a4a', 'rgba(0,0,0,0.6)');
    if (it.id === 'antonio' && TF.Hacks) TF.Hacks.drawLaptop(ctx, p, z, mir);   // his laptop levels up with him
    if (TF.Arcs) TF.Arcs.drawCrew(ctx, it.id, p, z, mir);   // rants, the jar / chain, speech bubbles
    if (it.id === 'matt' && TF.Events && TF.Events.shooing()) R.text('SHOO!', p.x, p.y - 44 * z + Math.sin(Crew.t * 20) * 2 * z, 10 * z, '#fff', 'rgba(120,20,20,0.9)');
    if (Crew.flash[it.id]) R.text('★', p.x, p.y - 44 * z, 12 * z, '#ffd23a', 'rgba(0,0,0,0.5)');
    Crew.lastDrawn.push(it.id);
  };

  var LOOK = {
    jared: { shirt: '#7a1e2c', skin: '#e8b48f', hair: '#5a3a1e', pants: '#2d3a5a' },
    ali: { shirt: '#f4f1e8', skin: '#7c4f31', hair: '#111', pants: '#2d3a5a' },
    matt: { shirt: '#d9a62a', skin: '#b07a50', hair: '#2a1b12', pants: '#2d3a5a' },
    phillip: { shirt: '#2f6b3a', skin: '#7c4f31', hair: '#2a1b12', pants: '#2d3a5a' },
    antonio: { shirt: '#2f2f3a', skin: '#b07a50', hair: '#111', pants: '#3a3a3a' },
    aaron: { shirt: '#e6dcc4', skin: '#f1c9a5', hair: '#d8b46a', pants: '#2d3a5a' },
    west: { shirt: '#8e5ba8', skin: '#f1c9a5', hair: '#c9c9c9', pants: '#8e5ba8' },
    runner: { shirt: '#c9a227', skin: '#d9a77e', hair: '#3b2a20', pants: '#2d3a5a' }
  };
  Crew.drawPlaceholder = function (ctx, id, x, y, z, mirror, walker) { drawPlaceholderCrew(ctx, id, x, y, z, mirror, walker); };
  function drawPlaceholderCrew(ctx, id, x, y, z, mirror, walker) {
    var l = LOOK[id];
    R.drawPerson({ facing: walker ? walker.facing : (mirror ? 1 : 0), moving: !!(walker && walker.moving), anim: walker ? walker.anim : 0,
      shirt: l.shirt, skin: l.skin, hair: l.hair, pants: l.pants, tall: 1.05 }, x, y, z);
    if (id === 'antonio') { ctx.fillStyle = '#9ab'; ctx.fillRect(x + (mirror ? -14 : 5) * z, y - 16 * z, 8 * z, 5 * z); }
  }

  // ---- Menu: stand upgrades + hire crew, one small panel ------------------------
  var panel = document.getElementById('crewPanel');
  var list = document.getElementById('crewList');
  Crew.buildMenu = function () {
    if (!panel) return;
    var html = '<div id="permitLine" class="soon permit" hidden></div><div id="soonLine" class="soon" hidden></div><details open class="sec"><summary>Stand upgrades <button id="btnSelStand" class="mini" hidden></button></summary>';
    TIERS.forEach(function (u) {
      html += '<div class="card up"><div class="info"><b>' + u.tier + '. ' + u.name + '</b><div class="fx">' + u.effect + '</div></div><button data-tier="' + u.id + '"></button></div>';
    });
    html += '<div class="card up"><div class="info"><b>Second stand</b><div class="fx">Own stock, line and tiers. A Freshman Cashier runs it.</div></div><button id="btnBuyStand2"></button></div>';
    html += '</details><details open class="sec"><summary>Extras</summary>';
    if (TF.Objects) Object.keys(TF.Objects.KINDS).forEach(function (id) {
      var k = TF.Objects.KINDS[id];
      html += '<div class="card up"><div class="info"><b>' + k.name + '</b><div class="fx">' + k.effect + ' \u00B7 $' + k.upkeep + '/day</div></div><button data-obj="' + id + '"></button></div>';
    });
    EXTRAS.forEach(function (x) {
      html += '<div class="card up"><div class="info"><b>' + x.name + '</b><div class="fx">' + x.effect + '</div></div><button data-extra="' + x.id + '"></button></div>';
    });
    html += '</details><details open class="sec"><summary>Hire crew</summary>';
    ROSTER.forEach(function (r) {
      html += '<div class="card"><canvas class="portrait" data-portrait="' + r.id + '" width="44" height="64"></canvas>' +
        '<div class="info"><b>' + r.name + '</b> <small>' + r.role + '</small><div class="fx">' + r.effect + '</div></div>' +
        '<button data-hire="' + r.id + '"></button></div>';
    });
    html += '</details><details class="sec"><summary>Jared\u2019s coin flip</summary><div class="card up"><div class="info"><div class="fx">Double-or-nothing on a quarter of the take.</div></div>' +
      '<select id="flipPolicy" aria-label="Coin flip policy"><option value="always">Always flip</option><option value="ask">Ask me</option><option value="never">Never</option></select></div></details>';
    list.innerHTML = html;
    list.querySelectorAll('[data-hire]').forEach(function (b) { b.addEventListener('click', function () { Crew.hire(b.getAttribute('data-hire')); }); });
    list.querySelectorAll('[data-tier]').forEach(function (b) { b.addEventListener('click', function () { Crew.buyTier(b.getAttribute('data-tier')); }); });
    document.getElementById('btnBuyStand2').addEventListener('click', function () { Crew.buyStand2(); });
    document.getElementById('btnSelStand').addEventListener('click', function (e) { e.preventDefault(); Sim.sel = (Sim.sel + 1) % Sim.stands.length; Crew.refresh(); });
    list.querySelectorAll('[data-extra]').forEach(function (b) { b.addEventListener('click', function () { Crew.buyExtra(b.getAttribute('data-extra')); }); });
    list.querySelectorAll('[data-obj]').forEach(function (b) { b.addEventListener('click', function () { Crew.startObject(b.getAttribute('data-obj')); }); });
    var pol = document.getElementById('flipPolicy');
    pol.value = TF.Bets ? TF.Bets.policy : 'ask';
    pol.addEventListener('change', function () { if (TF.Bets) TF.Bets.setPolicy(pol.value); });
    Crew.drawPortraits();
    Crew.refresh();
  };
  Crew.drawPortraits = function () {
    if (!list) return;
    list.querySelectorAll('[data-portrait]').forEach(function (cv) {
      var id = cv.getAttribute('data-portrait'), c = cv.getContext('2d'), img = TF.ArtPeople && (id === 'runner' ? (TF.ArtPeople.cust.capguy && TF.ArtPeople.cust.capguy.stand) : TF.ArtPeople.crewPortrait(id));
      c.clearRect(0, 0, cv.width, cv.height);
      if (img && TF.Art.painted()) {
        var s = Math.min(cv.width / img.width, (cv.height - 2) / img.height);
        c.drawImage(img, (cv.width - img.width * s) / 2, cv.height - img.height * s - 1, img.width * s, img.height * s);
      } else {
        var l = LOOK[id];
        c.fillStyle = l.shirt; c.fillRect(14, 28, 16, 22);
        c.fillStyle = l.skin; c.beginPath(); c.arc(22, 20, 8, 0, Math.PI * 2); c.fill();
        c.fillStyle = l.hair; c.fillRect(14, 10, 16, 5);
        c.fillStyle = l.pants; c.fillRect(15, 50, 14, 12);
      }
    });
  };
  var TIER_NAME = ['the start', 'Grill', 'Banner', 'Serving station', 'Canopy'];
  Crew.refresh = function () {
    var btn = document.getElementById('btnCrew');
    if (btn) btn.textContent = 'Stand & crew';
    if (!list || panel.hidden) return;
    var st = Sim.selected(), money = Sim.stats.money, sold = Sim.stats.served;
    var sel = document.getElementById('btnSelStand');
    sel.hidden = Sim.stands.length < 2;
    sel.textContent = 'Stand ' + (st.idx + 1) + ' \u25B8';
    // Only actionable cards stay visible; owned ones disappear, locked ones go to the "Coming" line.
    var soon = {}, show = function (b, on, name, why) {
      b.closest('.card').hidden = !on;
      if (!on && why) (soon[why] = soon[why] || []).push(name);
    };
    var b2 = document.getElementById('btnBuyStand2'), blk2 = blocked('stand2');
    b2.textContent = Sim.stands.length >= 2 ? 'Bought' : blk2 ? blk2 : label('stand2', 'Buy $' + Crew.STAND2_PRICE);
    b2.disabled = Sim.stands.length >= 2 || !!blk2 || money < Crew.STAND2_PRICE || !Sim.stand.placed;
    show(b2, Sim.stands.length < 2 && !dayLock(blk2), 'Second stand', Sim.stands.length < 2 && blk2);
    list.querySelectorAll('[data-tier]').forEach(function (b) {
      var u = TIERS.filter(function (x) { return x.id === b.getAttribute('data-tier'); })[0];
      var owned = st.tier >= u.tier, next = st.tier === u.tier - 1, locked = false;
      var wk = TF.Week && TF.Week.active(), blk = blocked(u.id);
      if (wk) locked = false;
      b.textContent = st.building === u.id ? 'Building\u2026' : owned ? 'Built' : !next ? 'After ' + TIER_NAME[u.tier - 1] : blk ? blk : locked ? 'At ' + u.unlock + ' sold' : label(u.id, 'Build $' + u.price);
      b.disabled = owned || !next || locked || !!blk || money < u.price || !st.placed || !!st.building;
      show(b, next && !dayLock(blk), u.name, next && blk);
    });
    list.querySelectorAll('[data-extra]').forEach(function (b) {
      var x = EXTRAS.filter(function (e) { return e.id === b.getAttribute('data-extra'); })[0];
      var ok = x.needs();
      var xb = blocked(x.id);
      b.textContent = Crew.extras[x.id] ? 'Owned' : xb ? xb : !ok ? x.needsText : label(x.id, 'Buy $' + x.price);
      b.disabled = !!Crew.extras[x.id] || !ok || !!xb || money < x.price;
      show(b, !Crew.extras[x.id] && ok && !dayLock(xb), x.name, !Crew.extras[x.id] && dayLock(xb) && xb);
    });
    list.querySelectorAll('[data-obj]').forEach(function (b) {
      var id = b.getAttribute('data-obj'), k = TF.Objects.KINDS[id], ob = TF.Objects.blockReason(id), bl = blocked(id);
      b.textContent = ob === 'Owned' ? 'Owned' : bl ? bl : ob ? ob : label(id, 'Place $' + k.price);
      b.disabled = !!ob || !!bl || money < k.price;
      show(b, ob !== 'Owned' && !dayLock(bl), k.name, ob !== 'Owned' && dayLock(bl) && bl);
    });
    list.querySelectorAll('[data-hire]').forEach(function (b) {
      var r = ROSTER.filter(function (x) { return x.id === b.getAttribute('data-hire'); })[0];
      var h = Crew.hiredSet[r.id], locked = st.tier < r.tier;
      var hb = blocked(r.id);
      b.textContent = h ? 'Hired' : hb ? hb : locked ? 'Needs ' + TIER_NAME[r.tier] : label(r.id, 'Hire $' + r.price);
      b.disabled = h || locked || !!hb || money < r.price;
      show(b, !h && !locked && !dayLock(hb), r.name, !h && (dayLock(hb) ? hb : locked && 'needs ' + TIER_NAME[r.tier]));
    });
    var fp = document.getElementById('flipPolicy');   // in Taco Week the coin flip lives in the Invest panel
    if (fp) fp.closest('details').hidden = !!(TF.Week && TF.Week.active());
    var pl = document.getElementById('permitLine'), pt = TF.Week ? TF.Week.permitLine() : '';
    pl.hidden = !pt; if (pl.textContent !== pt) pl.textContent = pt;
    var line = document.getElementById('soonLine'), keys = Object.keys(soon);
    line.hidden = !keys.length;
    var parts = keys.map(function (k) { return dayLock(k) ? k + ': ' + soon[k].join(', ') : soon[k].join(', ') + ' (' + k + ')'; });
    line.textContent = keys.length ? 'Coming: ' + parts.slice(0, 2).join(' \u00B7 ') + (parts.length > 2 ? ' +' + (parts.length - 2) + ' more' : '') : '';
  };
  function dayLock(why) { return !!why && /^Day /.test(why); }
  Crew.open = function (on) {
    panel.hidden = !on;
    if (on) { Crew.drawPortraits(); Crew.refresh(); }
  };

  if (panel) {
    document.getElementById('btnCrew').addEventListener('click', function () { TF.Audio.unlock(); Crew.open(panel.hidden); });
    document.getElementById('btnCrewClose').addEventListener('click', function () { Crew.open(false); });
    setInterval(function () { if (!panel.hidden) Crew.refresh(); }, 250);
  }
  Crew.applyMods();
  Crew.buildMenu();

  TF.Crew = Crew;
})(window.TF);
