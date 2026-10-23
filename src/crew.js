// Stand tiers + crew: what each tier and hire changes in the station timings (Sim.mods), who is
// available when, where the crew stand, how they're drawn, and the one small menu panel.
(function (TF) {
  var C = TF.C, World = TF.World, Sim = TF.Sim, R = TF.Render;

  // The stand grows in visible pieces on its 2x2 footprint. Tier 0 = folding table + cooler.
  var TIERS = [
    { tier: 1, id: 'grill', name: 'Grill', effect: 'Much faster cooking', price: 25, unlock: 4 },
    { tier: 2, id: 'banner', name: 'Banner', effect: 'Bigger draw zone', price: 35, unlock: 8 },
    { tier: 3, id: 'serving', name: 'Serving station', effect: 'Pickup spot, faster hand-off, 60-kit storage', price: 45, unlock: 12 },
    { tier: 4, id: 'canopy', name: 'Canopy', effect: 'More passers-by stop', price: 60, unlock: 18 }
  ];
  // Aaron's title comes from the copy file (data/story-copy.js); never President or Manager (Pass 7).
  function aaronTitle() { var c = TF.STORY_COPY && TF.STORY_COPY.characters && TF.STORY_COPY.characters.aaron; return (c && c.title) || 'Chief Handshake Officer'; }
  // Crew perks: the numbers modsFor() applies, also read by the character cards (src/storycards.js).
  var PERKS = { ali: { cookMul: 0.6, grillAdd: 1 }, phillip: { cookMul: 0.8 }, matt: { handT: 0.15 }, cannon: { handMul: 0.5 } };
  var SERVING_HAND_T = 0.3;   // hand-off with the Serving station (Matt needs it, so his card compares against this)
  var ROSTER = [
    { id: 'jared', name: 'Jared', role: 'Register + cooler', effect: 'Sells + restocks', price: 0, tier: 0, spot: 'in' },
    { id: 'ali', name: 'Ali', role: 'Grill', effect: 'Grill 40% faster', price: 20, tier: 1, spot: 'in' },
    { id: 'antonio', name: 'Antonio', role: 'Laptop + stream', effect: 'One hack a day: brings extra students', price: 40, tier: 2, spot: 'out' },
    { id: 'phillip', name: 'Phillip', role: 'Prep', effect: 'Cooking 20% faster', price: 30, tier: 2, spot: 'out' },
    { id: 'matt', name: 'Matt', role: 'Hand-off', effect: 'Fast hand-off, serves drinks quickly and repairs breakdowns', price: 25, tier: 3, spot: 'in' },
    { id: 'aaron', name: 'Aaron', role: aaronTitle(), effect: '+8s nearby patience, bulk orders; $8/day', price: 40, tier: 0, spot: 'out' },
    { id: 'runner', name: 'Freshman Runner', role: 'Supply runs', effect: 'Restocks from the van', price: 50, tier: 0, spot: 'none' }
  ];

  var EXTRAS = [
    { id: 'cooler2', name: 'Second cooler', effect: 'Double stock', price: 35, needs: function () { return Sim.stand.placed; }, needsText: 'Place the stand first' },
    { id: 'aiali', name: 'AI Ali', effect: 'Ali keeps cooking', price: 80, needs: function () { return Crew.hiredSet.ali && Sim.stand.tier >= 4; }, needsText: 'Needs Ali + Canopy' },
    { id: 'cannon', name: 'Phillip\u2019s Tortilla Cannon', effect: 'Hand-off 2x faster', price: 40, needs: function () { return Crew.hiredSet.phillip && Sim.stand.tier >= 3; }, needsText: 'Needs Phillip + Serving station' }
  ];

  var Crew = { hiredSet: { jared: true }, extras: {}, EXTRAS: EXTRAS, ROSTER: ROSTER, PERKS: PERKS, SERVING_HAND_T: SERVING_HAND_T, lastDrawn: [], spots: {}, spotKey: '', t: 0, flash: {}, TIERS: TIERS };

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
    if (t >= 1) { m.cookT = 1.2; m.stockMax = C.STOCK_GRILL; }
    if (t >= 2) m.zoneR += 2.5;
    if (t >= 3) { m.serving = true; m.handT = SERVING_HAND_T; m.stockMax = 60; }
    if (t >= 5) { m.orderT /= 1.4; m.cookT /= 1.4; m.stockMax = 84; }
    if (t >= 6) m.priceAdd += 1;
    if (t >= 7) m.zoneR *= 1.25;
    if (t >= 4) m.buyP = Math.min(0.95, m.buyP + 0.1);
    if (h.ali) { m.cookT *= PERKS.ali.cookMul; m.grill += PERKS.ali.grillAdd; }
    if (h.phillip) m.cookT *= PERKS.phillip.cookMul;
    // Matt's fast hand-off only while he's at the counter (C4: off fixing a breakdown, Jared covers at x0.8)
    if (h.matt) m.handT = TF.Handyman && TF.Handyman.away() ? TF.Handyman.coverHandT(m.handT) : PERKS.matt.handT;
    // In Taco Week Antonio makes demand only through his hacks (TF.Hacks), not as a passive boost.
    if (h.antonio && !(TF.Week && TF.Week.active())) { m.zoneR += 2; m.buyP = Math.min(0.95, m.buyP + 0.1); m.spawnMul *= 1.3; }
    if (ex.cooler2 && t === 0) m.stockMax *= 2;
    m.cannon = !!(ex.cannon && h.phillip && t >= 3);
    if (m.cannon) m.handT *= PERKS.cannon.handMul;
    if (TF.Empire) TF.Empire.mods(st, m);
    if (TF.Handyman) TF.Handyman.mods(st, m);   // open breakdowns (grill sputter, banner flicker)
  }

  // Expansion: Day 3+, up to six stands. Each package includes a grill and assigned cashier; the
  // player places it with the same starter pins + suggested line.
  Crew.STAND2_PRICE = 120;
  Crew.standPrice = function () { return (TF.Economy ? TF.Economy.standCosts : [120,350,750,1500,2500])[Sim.stands.length-1]; };
  Crew.buyStand2 = function () {
    var price = Crew.standPrice(), id = 'stand' + (Sim.stands.length + 1);
    if (Sim.stands.length >= Sim.MAX_STANDS || Sim.stats.money < price || blocked(id) || !Sim.stand.placed) return false;
    if (!reserveOk(id, price)) return false;
    TF.Ledger.add('build', -price, id);
    if (TF.Week) TF.Week.bought(id);
    var st = Sim.addStand();
    if (TF.P7Content) Sim.events.push({ type: 'toast', text: TF.P7Content.items[id].buyLine });
    st.tier = 1; // Expansion package includes a grill; further tiers remain paid upgrades.
    st.crew = 'cashier-' + (st.idx + 1); // Dedicated assignment, paid each shift; never shares another stand's operator.
    if (TF.Invest) TF.Invest.noteBuy(id, price, st);
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
    if (TF.ui) { TF.ui.setMode('idle'); TF.ui.setHint('Stand bought! Tap a glowing spot for the Freshman Cashier\u2019s stand.', 5); }
    Sim.events.push({ type: 'toast', text: 'Stand ' + (st.idx+1) + ': cashier assigned ($18/shift).' });
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
    if (blocked(id) || Sim.stats.money < price || TF.Objects.blockReason(id)) return false;
    TF.Ledger.add('build', -price, id);
    if (TF.Week) TF.Week.bought(id);
    if (TF.P7Content && TF.P7Content.items[id]) Sim.events.push({ type: 'toast', text: TF.P7Content.items[id].buyLine });
    Crew.preConfirmed = null;
    Crew.refresh();
    return true;
  };

  Crew.buyExtra = function (id) {
    var x = EXTRAS.filter(function (e) { return e.id === id; })[0];
    if (!x || Crew.extras[id] || !x.needs() || Sim.stats.money < x.price || blocked(id)) return false;
    if (!reserveOk(id, x.price)) return false;
    TF.Ledger.add('upgrade', -x.price, id);
    Crew.extras[id] = true;
    if (TF.Week) TF.Week.bought(id);
    if (id === 'cooler2' && Sim.stand.tier === 0 && !(TF.Econ && TF.Econ.on())) Sim.stand.stock += C.STOCK_T0;   // it arrives full
    Crew.applyMods();
    if (TF.Econ && TF.Econ.on()) TF.Econ.sync();
    if (Sim.stand.placed) Sim.floaters.push({ x: Sim.stand.geom.cx, y: Sim.stand.geom.cy, text: x.name + '!', t: 0 });
    Crew.refresh();
    return true;
  };

  Crew.hire = function (id) {
    if (id === 'aaron') return !!(TF.Aaron && TF.Aaron.hireLive && TF.Aaron.hireLive().ok);
    var r = ROSTER.filter(function (x) { return x.id === id; })[0];
    if (!r || Crew.hiredSet[id] || Sim.stand.tier < r.tier || Sim.stats.money < r.price || blocked(id)) return false;
    if (!reserveOk(id, r.price)) return false;
    TF.Ledger.add('hire', -r.price, id);
    if (TF.Week) TF.Week.bought(id);
    Crew.hiredSet[id] = true;
    Crew.applyMods();
    Crew.spotKey = '';
    Crew.flash[id] = 1.5;
    if (Sim.stand.placed) Sim.floaters.push({ x: Sim.stand.geom.cx, y: Sim.stand.geom.cy, text: r.name + ' hired!', t: 0 });
    Sim.events.push({ type: 'toast', text: r.name + ' hired: ' + r.effect + '!' });
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
    TF.Ledger.add('upgrade', -u.price, u.id);
    if (TF.P7Content && TF.P7Content.items[id]) Sim.events.push({type:'toast',text:TF.P7Content.items[id].buyLine});
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
  Crew.reserveOk = reserveOk;
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
      if (!World.isProp(t)) continue;
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
      return p.x + p.y > ck && Math.abs((p.x - p.y) * (C.TW / 2) - cs) < (HALF_W[p.piece] || 20) + 12;   // + half a v2 crew sprite (was 8 for the old, narrower art)
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
    var st = Sim.stand, t = Crew.t, name = 'idle';
    switch (id) {
      case 'jared': if (st.window && !st.window.paid) name = Math.floor(t * 3) % 2 ? 'change' : 'payment'; break;
      case 'ali': if (st.cook.grill.length && !(TF.Events && TF.Events.grillStalled && TF.Events.grillStalled())) name = Math.floor(t * 3) % 2 ? 'toss' : 'flip'; break;
      case 'matt': name = st.pickup.some(function (g) { return g && g.order && g.order.ready; }) ? 'handoff' : busy(id) ? 'tray' : 'idle'; break;
      case 'antonio': name = 'typing'; break;
      case 'phillip': if (st.cook.grill.length || st.cook.pending.length) name = Math.floor(t * 2) % 2 ? 'plate' : 'chop'; break;
      case 'west': name = ['fists', 'giggle', 'point', 'wave', 'check'][Math.floor(t / 0.8) % 5]; break;
      case 'aaron': name = ['point', 'thumbsUp', 'fistBump'][Math.floor(t / 0.7) % 3]; break;
    }
    return TF.ArtPeople.pose(id, name);
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
    // Every additional stand reuses the existing cashier art and restock animation.
    Sim.stands.slice(1).forEach(function (s2) {
    if (s2.placed && s2.crew) {
      if (s2.trip) {
        var r2 = s2.trip, a2 = R.lastAlpha || 1, cx = r2.px + (r2.x - r2.px) * a2, cy = r2.py + (r2.y - r2.py) * a2;
        items.push({ kind: 'crew', id: 'cashier', where: 'run', st: s2, x: cx, y: cy, k: cx + cy });
      } else {
        var c2 = stationSpots(s2).cashier;
        if (c2) items.push({ kind: 'crew', id: 'cashier', where: 'in', st: s2, x: c2.x, y: c2.y, k: c2.x + c2.y });
      }
    }
    });
    if (!st.placed) return;
    computeSpots();
    var ins = stationSpots(st);
    var HM = TF.Handyman, mp = HM && HM.away() ? HM.pos() : null;
    Object.keys(ins).forEach(function (id) {
      var p = ins[id];
      if (id === 'matt' && mp) { items.push({ kind: 'crew', id: 'matt', where: 'job', x: mp.x, y: mp.y, k: mp.x + mp.y }); return; }   // off on a job
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

  // Matt away from the counter (C4): walking his A* route, or the wrench pose on the job.
  function drawMattOnJob(ctx, p, z, painted) {
    var HM = TF.Handyman, S = HM.S, P = TF.ArtPeople, h = HM.heading || { x: 1, y: 0 };
    var walker = { facing: 0, moving: S.mode === 'WALKING', anim: Sim.t * 1.6 };
    Sim.faceEntity(walker, h.x, h.y);
    var mir = walker.facing === 1 || walker.facing === 3;
    if (S.mode === 'FIXING' && painted && P.drawCrewPose) P.drawCrewPose(ctx, 'matt', 'wrench', p.x, p.y, z, mir);
    else if (!(painted && P.drawWalker(ctx, 'matt', p.x, p.y, z, mir, 0, null, walker))) drawPlaceholderCrew(ctx, 'matt', p.x, p.y, z, mir);
    R.text(S.mode === 'FIXING' ? 'fixing…' : S.returning ? 'back to the counter' : 'on the way', p.x, p.y - 40 * z, 7 * z, '#fff5d6', 'rgba(20,40,70,0.85)');
    Crew.lastDrawn.push('matt');
  }

  Crew.draw = function (ctx, it, z) {
    var st = it.st || Sim.stand, P = TF.ArtPeople, painted = TF.Art.painted() && P && P.crew[it.id];
    var p = R.toScreen(it.x, it.y);
    if (it.id === 'cashier') { drawCashier(ctx, it, p, z); return; }
    if (it.where === 'job') { drawMattOnJob(ctx, p, z, painted); return; }
    if (it.where === 'run') {
      var r = Sim.runner;
      if (!r) return;
      var mirror = r.facing === 1 || r.facing === 3, swing = r.moving ? Math.sin(r.anim / 0.16 * Math.PI / 2) : 0;
      if (painted) P.drawWalker(ctx, 'jared', p.x, p.y, z, mirror, swing, TF.Art.img.cooler, r);
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
    // Antonio's v2 work poses already include a laptop; legacy art still needs the overlay.
    if (it.id === 'antonio' && TF.Hacks && !(painted && P.crew.antonio.sheet === 'crew_antonio_v2')) TF.Hacks.drawLaptop(ctx, p, z, mir);
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
    west: { shirt: '#8e5ba8', skin: '#f1c9a5', hair: '#8B3A1E', pants: '#8e5ba8' },
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
    var html = '<div id="p7Cargo" class="soon" hidden></div><div id="p7Leads" class="soon" hidden></div><div id="permitLine" class="soon permit" hidden></div><div id="soonLine" class="soon" hidden></div><details open class="sec" data-section="build"><summary>Build & upgrades <button id="btnSelStand" class="mini" hidden></button></summary>';
    TIERS.forEach(function (u) {
      html += '<div class="card up"><div class="info"><b>' + u.tier + '. ' + u.name + '</b><div class="fx">' + (u.blurb ? u.blurb + '<br>' : '') + u.effect + '</div></div><button data-tier="' + u.id + '"></button></div>';
    });
    html += '<div class="card up"><div class="info"><b>Second stand & portfolio</b><div class="fx">' + [2,3,4,5,6].map(function (n) { var c = TF.P7Content && TF.P7Content.items['stand'+n]; return (c ? c.name + ': ' + c.blurb : 'Stand '+n) + ' $' + TF.Economy.standCosts[n-2]; }).join('<br>') + '<br>Grill + cashier; $18/shift plus rent and maintenance.</div></div><button id="btnBuyStand2"></button></div>';
    html += '</details><details open class="sec" data-section="build"><summary>Buildings & extras</summary>';
    if (TF.Objects) Object.keys(TF.Objects.KINDS).forEach(function (id) {
      var k = TF.Objects.KINDS[id];
      html += '<div class="card up"><div class="info"><b>' + k.name + '</b><div class="fx">' + (k.blurb ? k.blurb + '<br>' : '') + k.effect + ' \u00B7 $' + k.upkeep + '/day</div></div><button data-obj="' + id + '"></button></div>';
    });
    EXTRAS.forEach(function (x) {
      html += '<div class="card up"><div class="info"><b>' + x.name + '</b><div class="fx">' + x.effect + '</div></div><button data-extra="' + x.id + '"></button></div>';
    });
    html += '</details><details open class="sec" data-section="hire"><summary>Hire crew</summary>';
    ROSTER.forEach(function (r) {
      html += '<div class="card"><canvas class="portrait" data-portrait="' + r.id + '" width="44" height="64"></canvas>' +
        '<div class="info"><b>' + r.name + '</b> <small>' + r.role + '</small><div class="fx">' + r.effect + ' · $' + r.price + ' to hire</div></div>' +
        '<button class="mini info" data-info="' + r.id + '" aria-label="About ' + r.name + '">\u24D8</button><button data-hire="' + r.id + '"></button></div>';
    });
    html += '</details><details class="sec"><summary>Jared\u2019s coin flip</summary><div class="card up"><div class="info"><div class="fx">Double-or-nothing on a quarter of the take.</div></div>' +
      '<select id="flipPolicy" aria-label="Coin flip policy"><option value="always">Always flip</option><option value="ask">Ask me</option><option value="never">Never</option></select></div></details>';
    list.innerHTML = html;
    list.querySelectorAll('[data-hire]').forEach(function (b) { b.addEventListener('click', function () { Crew.hire(b.getAttribute('data-hire')); }); });
    list.querySelectorAll('[data-info]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); if (TF.StoryCards) TF.StoryCards.showCharacter(b.getAttribute('data-info')); }); });
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
    list.querySelectorAll('[data-portrait]').forEach(function (cv) { Crew.paintPortrait(cv, cv.getAttribute('data-portrait')); });
  };
  // One portrait onto a canvas from the existing art (crew sheets, Mrs. West's idle frame, the runner's
  // customer sprite), or the flat placeholder figure while the art loads. No new art.
  Crew.paintPortrait = function (cv, id) {
    var c = cv.getContext && cv.getContext('2d'); if (!c) return;
    var P = TF.ArtPeople, img = P && (id === 'runner' ? (P.cust.capguy && P.cust.capguy.stand) : id === 'west' ? (P.west && P.west.idle) : P.crewPortrait(id));
    c.clearRect(0, 0, cv.width, cv.height);
    if (img && TF.Art && TF.Art.painted()) {
      var s = Math.min(cv.width / img.width, (cv.height - 2) / img.height);
      c.drawImage(img, (cv.width - img.width * s) / 2, cv.height - img.height * s - 1, img.width * s, img.height * s);
    } else {
      var l = LOOK[id] || LOOK.jared, k = cv.width / 44;
      c.save(); c.scale(k, cv.height / 64);
      c.fillStyle = l.shirt; c.fillRect(14, 28, 16, 22);
      c.fillStyle = l.skin; c.beginPath(); c.arc(22, 20, 8, 0, Math.PI * 2); c.fill();
      c.fillStyle = l.hair; c.fillRect(14, 10, 16, 5);
      c.fillStyle = l.pants; c.fillRect(15, 50, 14, 12);
      c.restore();
    }
  };
  // Pure affordability query: no RNG, ledger changes or purchase side effects.
  Crew.affordable = function () {
    var st = Sim.selected(), cash = Sim.stats.money;
    if (!st.placed) return null;
    return TIERS.filter(function (u) { return !st.building && u.tier === st.tier + 1; })
      .concat(ROSTER.filter(function (r) { return !Crew.hiredSet[r.id] && Sim.stand.tier >= r.tier; }))
      .concat(EXTRAS.filter(function (x) { return !Crew.extras[x.id] && x.needs() && (x.id !== 'cooler2' || st.tier === 0); }))
      .filter(function (x) { return cash >= x.price && !blocked(x.id); })[0] || null;
  };
  var TIER_NAME = ['the start', 'Grill', 'Banner', 'Serving station', 'Canopy', 'Food Truck', 'Neon Menu', 'Billboard'];
  Crew.refresh = function () {
    var btn = document.getElementById('btnCrew');
    var offer = Crew.affordable();
    Crew.ready = !!offer;
    if (btn) {
      btn.textContent = 'Hire / Crew';
      btn.classList.toggle('buy-ready', !!offer);
      btn.title = offer ? offer.name + ': ' + offer.effect : 'Stand upgrades and helpers';
    }
    if (!list || panel.hidden) return;
    if (TF.Empire) { TF.Empire.refreshLeads(); TF.Empire.refreshCargo(); }
    var st = Sim.selected(), money = Sim.stats.money, sold = Sim.stats.served;
    var sel = document.getElementById('btnSelStand');
    sel.hidden = Sim.stands.length < 2;
    sel.textContent = 'Stand ' + (st.idx + 1) + (st.offsite ? ' (auto-operating)' : '') + ' \u25B8';
    // Only actionable cards stay visible; owned ones disappear, locked ones go to the "Coming" line.
    var soon = {}, show = function (b, on, name, why) {
      b.closest('.card').hidden = !on;
      if (!on && why) (soon[why] = soon[why] || []).push(name);
    };
    var b2 = document.getElementById('btnBuyStand2'), blk2 = blocked('stand' + (Sim.stands.length + 1));
    b2.textContent = Sim.stands.length >= Sim.MAX_STANDS ? 'Six stands owned' : blk2 ? blk2 : label('stand' + (Sim.stands.length+1), 'Stand ' + (Sim.stands.length+1) + ' $' + Crew.standPrice());
    b2.disabled = Sim.stands.length >= Sim.MAX_STANDS || !!blk2 || money < Crew.standPrice() || !Sim.stand.placed;
    show(b2, Sim.stands.length < Sim.MAX_STANDS && !dayLock(blk2), 'Second stand', Sim.stands.length < Sim.MAX_STANDS && blk2);
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
      var h = Crew.hiredSet[r.id], locked = Sim.stand.tier < r.tier;
      var hb = blocked(r.id);
      b.textContent = h ? 'Hired' : hb ? hb : locked ? 'Needs ' + TIER_NAME[r.tier] : label(r.id, 'Hire $' + r.price);
      b.disabled = h || locked || !!hb || money < r.price;
      show(b, true, r.name, false);
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
  function dayLock(why) { return !!why && /^(Day |L[1-4] Day )/.test(why); }
  Crew.open = function (on, section) {
    if (!panel) return;
    Crew.section = section || 'hire';
    list.querySelectorAll('[data-section]').forEach(function (el) { el.hidden = el.getAttribute('data-section') !== Crew.section; });
    var heading = panel.querySelector('.head b'); if (heading) heading.textContent = Crew.section === 'build' ? 'Build' : 'Hire / Crew';
    panel.hidden = !on;
    if (!on && TF.ui && TF.ui.state) { TF.ui.state.buildOpen = false; if (TF.ui.refresh) TF.ui.refresh(); }
    if (on) { Crew.drawPortraits(); Crew.refresh(); }
  };

  if (panel) {
    document.getElementById('btnCrew').addEventListener('click', function () { TF.Audio.unlock(); Crew.open(panel.hidden || Crew.section !== 'hire', 'hire'); });
    document.getElementById('btnCrewClose').addEventListener('click', function () { Crew.open(false); });
    setInterval(function () { Crew.refresh(); }, 250);
  }
  Crew.applyMods();
  Crew.buildMenu();

  TF.Crew = Crew;
})(window.TF);
