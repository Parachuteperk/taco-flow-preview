// The background crowd on the 6B crowd engine (Pass 6B B1). TF.Crowd.Sim walks students between the
// map's entries on flow fields (20 Hz fixed steps, pooled walkers, spatial grid, separation) and
// TF.Crowd.Draw turns the visible ones into culled, LOD-picked, depth-sorted sprites from one atlas baked
// from every customer look (batches 1-4, incl. cowboy2). They fill the quad up to the level's walker
// target alongside the Sim's own guests, who stay the customers (they queue, buy and keep the economy as
// tuned); moving the customers onto the engine is a later 6B chunk. Purely visual: its own seeded stream,
// nothing here touches TF.Rng, the ledger or saves (a new day / level starts it empty).
(function (TF) {
  var Sim = TF.Sim, World = TF.World, R = TF.Render, C = TF.C;
  var CAP = 150;
  var CL = { retired: 0, sim: null, drawer: null, atlas: null, lods: new Uint8Array(CAP), spawnT: 0, spawned: 0, arrived: 0, drawn: 0, keys: [], off: false };

  // walkable for the crowd: the walks, plazas, stairs and ramps
  function costs() {
    var W = World.W, H = World.H, c = new Float32Array(W * H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var t = World.get(x, y);
      c[y * W + x] = (World.isPath(x, y) || t === World.T.PLAZA) && !World.isStand(x, y) && !World.isPickup(x, y) && !World.isLine(x, y) && !(World.isObject && World.isObject(x, y)) ? 1 : Infinity;
    }
    return c;
  }
  var seed = (TF.Rng ? TF.Rng.seed : 7) * 7919 + 3, r = seed >>> 0;
  function rnd() {   // the crowd's own stream (cosmetic: route + look picks)
    r = (r + 0x6D2B79F5) >>> 0;
    var t = Math.imul(r ^ (r >>> 15), 1 | r); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  CL.build = function () {
    if (!TF.Crowd || !TF.Crowd.Sim) { CL.off = true; return; }
    var dests = {}, W = World.W;
    CL.keys = [];
    World.exits.forEach(function (e, i) { var k = 'x' + i; dests[k] = [e.y * W + e.x]; CL.keys.push(k); });
    CL.sim = CL.keys.length >= 2 ? TF.Crowd.Sim.create({ W: World.W, H: World.H, costs: (CL.costs = costs()), stairs: null, destinations: dests, seed: seed, capacity: CAP }) : null;
    CL.spawnT = 0;
  };
  World.onLoad.push(function () { CL.build(); });
  CL.clear = function () { if (CL.sim) CL.sim.walkers.forEach(function (w) { if (w && w.active) CL.sim.removeWalker(w.id); }); };

  // how many background walkers right now: up to the level's target, less the Sim's own guests
  CL.target = function () {
    var max = (C.CROWD[Sim.crowd] || C.CROWD.normal).max;
    return Math.max(0, Math.min(CAP, max - Sim.guests.length));
  };
  CL.active = function () { var n = 0; if (CL.sim) CL.sim.walkers.forEach(function (w) { if (w && w.active) n++; }); return n; };

  CL.step = function (dt) {
    if (CL.off) return;
    if (!CL.sim) { CL.build(); if (!CL.sim) return; }
    if (CL.geometryVersion !== World.version) {
      CL.geometryVersion = World.version;
      CL.costs = costs(); CL.sim.setCosts(CL.costs);
    }
    CL.spawnT -= dt;
    var n = CL.active();
    while (CL.spawnT <= 0 && n < CL.target()) {
      CL.spawnT += 0.15;
      var a = Math.floor(rnd() * CL.keys.length), e = World.exits[a], b = -1, t = e.y * World.W + e.x;
      for (var tries = 0; tries < 8 && b < 0; tries++) {   // only somewhere this entry actually connects to
        var c = Math.floor(rnd() * (CL.keys.length - 1)); if (c >= a) c++;
        var f = CL.sim.fields.get(CL.keys[c], false);
        if (f && isFinite(f.dist[t]) && f.dist[t] > 0) b = c;
      }
      if (b < 0) continue;
      try {
        var id = CL.sim.addWalker({ x: e.x + 0.5, y: e.y + 0.5, dest: CL.keys[b], speed: 1.1 + rnd() * 0.6,
          onArrive: function (wid) { CL.sim.removeWalker(wid); CL.arrived++; } });
        if (id >= 0) { var w = CL.sim.walkers[id]; w.base = Math.floor(rnd() * 1000); w.look = 0; w.mirror = false; w.lx = undefined; w.ox = (rnd() - 0.5) * 0.6; w.oy = (rnd() - 0.5) * 0.6; CL.spawned++; n++; }
      } catch (err) { /* a blocked or unreachable entry: skip it */ }
    }
    if (CL.spawnT < 0) CL.spawnT = 0;
    CL.sim.update(dt);
    // a walker within a tile of their exit has left (exits are map edges / doorways, often one tile wide: waiting
    // to stand exactly on the tile jammed the Old Main stairs); anyone boxed in for 4 s leaves too
    CL.sim.walkers.forEach(function (w) {
      if (!w || !w.active) return;
      var f = CL.sim.fields.get(w.dest, false), t = Math.floor(w.y) * World.W + Math.floor(w.x);
      if (f && f.dist[t] <= 1) { CL.sim.removeWalker(w.id); CL.arrived++; w.lx = undefined; return; }
      if (w.lx === undefined || Math.abs(w.x - w.lx) + Math.abs(w.y - w.ly) > 0.5) { w.lx = w.x; w.ly = w.y; w.stillT = 0; return; }
      w.stillT += dt;
      if (w.stillT > 4) { CL.sim.removeWalker(w.id); CL.retired++; w.lx = undefined; }
    });
  };
  Sim.newDayHooks = Sim.newDayHooks || [];
  Sim.newDayHooks.push(function () { CL.clear(); });

  // ---- drawing --------------------------------------------------------------------------------------
  function atlas() {
    if (CL.atlas || !TF.Art.painted() || !TF.ArtPeople || !TF.ArtPeople.ready) return CL.atlas;
    var P = TF.ArtPeople, looks = [], names = [];
    P.VARIANTS.concat(P.VARIANTS_B2 || [], P.VARIANTS_B3 || [], P.VARIANTS_B4 || []).forEach(function (k) {
      var c = P.cust[k];
      if (!c || !c.toward || !c.away) return;
      names.push(k);
      [c.toward, c.away].forEach(function (set) {
        looks.push({ height: c.h, frames: set.map(function (img) { return { image: img, ax: img.ax, ay: img.ay, key: false }; }) });
      });
    });
    if (!looks.length) return null;
    CL.atlas = TF.Crowd.Draw.buildAtlas(looks, { personHeight: 30 });
    CL.lookNames = names;
    CL.drawer = TF.Crowd.Draw.create(CL.atlas.looks, CAP, { motionPadding: 1, sort: false });   // the scene's one sort orders them
    return CL.atlas;
  }
  // reused every frame: no per-walker allocations on the render path (B1 review)
  var LOD_OPTS = { lowZoom: 0.45, halfZoom: 0.8, halfDistance: 14 }, VIEW = { x: 0, y: 0, zoom: 1, halfTileW: C.TW / 2, halfTileH: C.TH / 2 };
  var RECT = { x0: 0, y0: 0, x1: 0, y1: 0 }, POOL = [];
  for (var pi = 0; pi < CAP; pi++) POOL.push({ kind: 'crowd', plugin: CL, e: null, x: 0, y: 0, k: 0 });
  CL.items = function (items, alpha, ui) {
    if (CL.off || !CL.sim || (ui && (ui.noGuests || ui.onlyPieces || ui.bare))) { CL.drawn = 0; return; }
    if (!atlas()) { CL.drawn = 0; return; }
    var nLooks = CL.lookNames.length, cx = R.toWorld(R.vw / 2, R.vh / 2), z = R.cam.z, ws = CL.sim.walkers;
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      if (!w || !w.active) continue;
      var dx = w.x - w.prevX, dy = w.y - w.prevY, vx = dx - dy, vy = dx + dy;
      if (Math.abs(vx) + Math.abs(vy) > 1e-6) { var front = vy >= 0; w.look = (w.base % nLooks) * 2 + (front ? 0 : 1); w.mirror = front ? vx < 0 : vx > 0; }
      CL.lods[w.id] = TF.Crowd.LOD.pick(z, Math.hypot(w.x - cx.x, w.y - cx.y), LOD_OPTS);
    }
    var rect = TF.ui && TF.ui.camera ? TF.ui.camera.visibleRect(40, 1, RECT) : null;
    if (!rect) {
      var a = R.toWorld(0, 0), b = R.toWorld(R.vw, 0), c = R.toWorld(0, R.vh), d = R.toWorld(R.vw, R.vh);
      rect = RECT; rect.x0 = Math.min(a.x, b.x, c.x, d.x) - 2; rect.y0 = Math.min(a.y, b.y, c.y, d.y) - 2; rect.x1 = Math.max(a.x, b.x, c.x, d.x) + 2; rect.y1 = Math.max(a.y, b.y, c.y, d.y) + 2;
    }
    VIEW.x = R.cam.x; VIEW.y = R.cam.y; VIEW.zoom = z;
    var list = CL.drawer.build(CL.sim, rect, CL.lods, CL.sim.alpha(), performance.now() / 1000, VIEW);
    for (i = 0; i < list.count; i++) { var e = list.entries[i], it = POOL[i]; it.e = e; it.k = e.depth; items.push(it); }
    CL.drawn = list.count;
  };
  CL.draw = function (ctx, it) {
    var e = it.e;
    ctx.drawImage(e.sheet, e.sx, e.sy, e.sw, e.sh, e.dx, e.dy, e.dw, e.dh);
  };
  CL.stats = function () { return { retired: CL.retired, active: CL.active(), target: CL.target(), drawn: CL.drawn, spawned: CL.spawned, arrived: CL.arrived, atlas: !!CL.atlas, looks: CL.lookNames ? CL.lookNames.length : 0 }; };

  TF.plugins.push(CL);
  TF.CrowdLayer = CL;
})(window.TF);
