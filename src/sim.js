// Fixed-step simulation: spawning, the customer state machine, the stands (a list: each with its
// own painted queue line, stock, cook, pickup, tier and station timings) and restock walks.
(function (TF) {
  var C = TF.C, World = TF.World;

  function mkMods() {
    return { orderT: C.ORDER_T, cookT: C.COOK_T, grill: C.GRILL, handT: C.HAND_T, zoneR: C.ZONE_R, buyP: C.BUY_P, spawnMul: 1, priceAdd: 0, serving: false, stockMax: C.STOCK_T0 };
  }
  function mkStand(idx) {
    return {
      reputation: 30, crew: idx ? null : 'jared', funnel: { walkers: 0, interested: 0, queued: 0, served: 0, lost: {} },
      idx: idx, placed: false, sx: 0, sy: 0, rot: 0, geom: null,
      line: [], poly: [], polyLen: 0, cap: 0, connected: false, link: null,
      queue: [], window: null, pickup: [null, null, null, null],
      cook: { pending: [], grill: [] },
      tier: 0, stock: C.STOCK_T0, restocks: 0, needRestock: false,
      trip: null,           // the stand's own cashier on a restock walk (Jared at stand 1)
      mods: mkMods()        // station timings; TF.Crew.applyMods rewrites them
    };
  }

  var Sim = {
    t: 0,
    guests: [],
    floaters: [],
    events: [],             // drained by main.js each frame (sounds etc.)
    nextId: 1,
    spawnT: 0.5,
    stats: { spawned: 0, served: 0, completedLoop: 0, money: 0, balked: 0, gaveUp: 0, grillWork: 0, tortillaShots: 0, noline: 0, closedTurnaway: 0, congestT: 0, lostThenServed: 0 },
    closing: false,         // Taco Week CLOSE phase: nobody new joins
    flyers: [],             // tortillas in flight (cannon), purely visual
    thoughts: { longline: 0, tasty: 0, pricey: 0, slow: 0, where: 0 },
    cookRate: 1,            // stand 1's grill (Ali); 0 while Mrs. West distracts him
    serviceSlow: 1,         // > 1 while grackles mob stand 1 (ordering + hand-off slower)
    priceBoostT: 0,         // "Add more salsa!": +10% price while > 0
    crowd: 'normal',        // low | normal | high
    rushT: 0, nextRush: 80, // periodic rushes double spawns for ~30 s (Free Play)
    capExtra: 0,
    waits: [],              // recent pay -> taco-in-hand seconds
    stands: [mkStand(0)],
    sel: 0,                 // the stand the player is editing (move / line / upgrades)
    rand: World.rng(+((/[?&]seed=(\d+)/.exec(location.search) || [])[1] || 7))
  };
  // Stand 1 aliases kept for the rest of the code base (crew, events, tests).
  Sim.stand = Sim.stands[0];
  Sim.mods = Sim.stand.mods;
  Object.defineProperty(Sim, 'runner', { get: function () { return Sim.stands[0].trip; }, set: function (v) { Sim.stands[0].trip = v; } });
  Sim.selected = function () { return Sim.stands[Sim.sel] || Sim.stands[0]; };
  Sim.MAX_STANDS = 6;

  function rnd(a, b) { return a + (b - a) * Sim.rand(); }
  function center(t) { return { x: t.x + 0.5, y: t.y + 0.5 }; }
  function tileOf(g) { return { x: Math.floor(g.x), y: Math.floor(g.y) }; }
  function placedStands() { return Sim.stands.filter(function (s) { return s.placed; }); }
  function syncWorld() {
    World.stands = Sim.stands.map(function (s) { return s.placed ? { sx: s.sx, sy: s.sy, rot: s.rot, idx: s.idx } : null; });
    World.stand = World.stands[0];
  }

  // ---- Stand geometry ----------------------------------------------------
  Sim.windowPos = function (st) {
    var g = (st || Sim.stand).geom;
    return { x: g.order[0] + 0.5 - g.n[0] * 0.2, y: g.order[1] + 0.5 - g.n[1] * 0.2 };
  };
  // Four waiting spots, two on each tile in front of the pickup hatch.
  Sim.pickupPos = function (k, st) {
    var g = (st || Sim.stand).geom, t = g.pickup[k >> 1];
    var side = (k & 1) ? 0.22 : -0.22;
    return { x: t[0] + 0.5 - g.np[0] * 0.2 + g.np[1] * side, y: t[1] + 0.5 - g.np[1] * 0.2 + g.np[0] * side };
  };
  function cornerPos(st) {
    var g = st.geom;
    return { x: g.cx + (g.n[0] + g.np[0]) * 1.25, y: g.cy + (g.n[1] + g.np[1]) * 1.25 };
  }
  Sim.door = cornerPos;

  // ---- Queue lines -----------------------------------------------------------
  // Each chain runs from the tile in front of its order window to the entry. Queue positions are
  // arc-length distances along a polyline: window point -> tile centres -> entry edge.
  // Light line-shape rules (item 7): a queue tile on a busy footpath crossing slows passers-by
  // while people stand in it, and a line hugging the pickup tiles slows the hand-off.
  TF.lineInfo = function (line, geom) {
    var crossings = [], pickupClear = true;
    line.forEach(function (t, i) {
      if (i === 0) return;   // the order tile itself always sits next to the pickup
      // a plaza tile with foot traffic on 3+ sides is a crossing people need to walk through
      var walk = function (x, y) { var k = World.get(x, y); return k === World.T.PATH || k === World.T.PLAZA; };
      var n = World.DIRS.filter(function (d) { return walk(t.x + d[0], t.y + d[1]); }).length;
      if (World.get(t.x, t.y) === World.T.PLAZA && n >= 3) crossings.push(t);
      if (geom.pickup.some(function (p) { return Math.max(Math.abs(p[0] - t.x), Math.abs(p[1] - t.y)) <= 1; })) pickupClear = false;   // incl. diagonal: pickup crowd
    });
    return { cap: line.length * 2, crossings: crossings, blocked: crossings.length > 0, pickupClear: pickupClear };
  };
  Sim.congest = {};
  function rebuildLines() {
    World.lineSet = {}; World.lineOwner = {};
    World.version++;
    Sim.stands.forEach(function (st) {
      st.line.forEach(function (t, i) { World.lineSet[t.x + ',' + t.y] = i; World.lineOwner[t.x + ',' + t.y] = st.idx; });
    });
    Sim.stands.forEach(rebuildLine);
    Sim.congest = {};
    Sim.stands.forEach(function (st) { if (st.info) st.info.crossings.forEach(function (t) { Sim.congest[t.x + ',' + t.y] = st; }); });
  }
  function rebuildLine(st) {
    st.poly = []; st.polyLen = 0; st.cap = 0; st.connected = false; st.link = null; st.info = null;
    if (!st.placed || !st.line.length) return;
    st.info = TF.lineInfo(st.line, st.geom);
    var pts = [Sim.windowPos(st)];
    st.line.forEach(function (t) { pts.push(center(t)); });
    // Connected when the far end touches a walkway tile (not the tile it came from).
    var end = st.line[st.line.length - 1], prev = st.line[st.line.length - 2];
    var prevDir = prev ? [end.x - prev.x, end.y - prev.y] : [st.geom.n[0], st.geom.n[1]];
    var best = null;
    World.DIRS.forEach(function (d) {
      var nx = end.x + d[0], ny = end.y + d[1];
      if (!World.isWalkway(nx, ny)) return;
      var score = d[0] === prevDir[0] && d[1] === prevDir[1] ? 2 : 1;   // prefer straight on
      if (!best || score > best.score) best = { x: nx, y: ny, score: score };
    });
    if (best) {
      st.connected = true;
      st.link = { x: best.x, y: best.y };
      pts.push({ x: end.x + 0.5 + (best.x - end.x) * 0.5, y: end.y + 0.5 + (best.y - end.y) * 0.5 });
    }
    st.poly = pts.map(function (p, i) {
      if (i) st.polyLen += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      return { x: p.x, y: p.y, s: st.polyLen };
    });
    st.cap = st.line.length * 2;
  }

  Sim.polyAt = function (s, st) {
    st = st || Sim.stand;
    var P = st.poly;
    if (P.length < 2) return { x: P.length ? P[0].x : 0, y: P.length ? P[0].y : 0, dx: -st.geom.n[0], dy: -st.geom.n[1] };
    s = Math.max(0, Math.min(st.polyLen, s));
    for (var i = 1; i < P.length; i++) {
      if (s <= P[i].s || i === P.length - 1) {
        var a = P[i - 1], b = P[i], L = b.s - a.s || 1e-6, f = (s - a.s) / L;
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dx: (a.x - b.x) / L, dy: (a.y - b.y) / L };
      }
    }
  };

  function enrouteCount(st) {
    var n = 0;
    for (var i = 0; i < Sim.guests.length; i++) if (Sim.guests[i].state === 'TO_QUEUE' && Sim.guests[i].st === st) n++;
    return n;
  }

  // After a line changes: queued guests past the new capacity (or on a line that no longer
  // reaches a path) leave politely; guests on their way re-path to the new entry.
  function lineChanged(st) {
    rebuildLines();
    var keep = [];
    st.queue.forEach(function (g, i) {
      if (g.state === 'ORDER' || g.atWindow) keep.push(g);
      else if (st.connected && i < st.cap) keep.push(g);
      else leavePolitely(g);
    });
    st.queue = keep;
    if (st.window && keep.indexOf(st.window) < 0) st.window = null;
    keep.forEach(function (g) { g.qs = Math.min(g.qs, st.polyLen); });
    Sim.guests.forEach(function (g) {
      if (g.state !== 'TO_QUEUE' || g.st !== st) return;
      if (!st.connected || st.queue.length >= st.cap) leavePolitely(g);
      else goToQueue(g, st);
    });
  }

  Sim.canAddLine = function (x, y, st) {
    st = st || Sim.selected();
    if (!st.placed) return { ok: false, reason: 'Place the stand first' };
    if (World.isLine(x, y)) return { ok: false, reason: 'Already part of the line' };
    var end = st.line[st.line.length - 1];
    var o = st.geom.order;
    if (!end) { if (x !== o[0] || y !== o[1]) return { ok: false, reason: 'Start the line at the order window' }; }
    else if (Math.abs(x - end.x) + Math.abs(y - end.y) !== 1) return { ok: false, reason: 'Line tiles must join the end of the line' };
    if (!World.lineGround(x, y)) {
      return { ok: false, reason: World.isPath(x, y) ? 'Lines go on grass or plaza — end it next to the path' : 'Can’t build the line there' };
    }
    return { ok: true, reason: '' };
  };

  Sim.addLineTile = function (x, y, st) {
    st = st || Sim.selected();
    var v = Sim.canAddLine(x, y, st);
    if (!v.ok) return v;
    st.line.push({ x: x, y: y });
    lineChanged(st);
    // Non-queuers never use line tiles: anyone on or heading over the new tile re-routes.
    Sim.guests.forEach(function (g) {
      if (g.state !== 'WANDER' && g.state !== 'LEAVE' && g.state !== 'PAID_WAIT') return;
      var onIt = Math.floor(g.x) === x && Math.floor(g.y) === y;
      var via = g.path.some(function (p) { return Math.floor(p.x) === x && Math.floor(p.y) === y; });
      if (!onIt && !via) return;
      if (onIt) { var w = World.nearestWalkable(x, y); g.x = g.px = w.x + 0.5; g.y = g.py = w.y + 0.5; }
      g.path = [];
      if (g.state === 'WANDER') ensureOnWalk(g); else if (g.state === 'LEAVE') startLeave(g);
    });
    return v;
  };

  // Removes the given line tile and everything after it (on whichever stand owns it).
  Sim.removeLineFrom = function (x, y) {
    var k = x + ',' + y, i = World.lineSet[k];
    if (i === undefined) return false;
    var st = Sim.stands[World.lineOwner[k]] || Sim.stand;
    st.line = st.line.slice(0, i);
    lineChanged(st);
    return true;
  };
  Sim.lineOwnerAt = function (x, y) { var o = (World.lineOwner || {})[x + ',' + y]; return o === undefined ? null : Sim.stands[o]; };

  // ---- Guests ------------------------------------------------------------
  var SHIRTS = ['#7a1e2c', '#c9a227', '#3d6fb4', '#e07a3f', '#5b8c5a', '#8e5ba8', '#2f2f3a', '#d6d2c4', '#b8394b', '#501214'];
  var SKINS = ['#f1c9a5', '#d9a77e', '#b07a50', '#7c4f31', '#e8b48f'];
  var HAIR = ['#2a1b12', '#5a3a1e', '#111', '#a8743a', '#d8b46a', '#3b2a20', '#8a3b1e'];
  var PANTS = ['#2d3a5a', '#3a3a3a', '#5b4a3a', '#1f2c40', '#6b6b78', '#8a6a44'];
  var PACKS = ['#222', '#3d6fb4', '#7a1e2c', '#5b4a3a', '#2f5b3a'];
  function pick(a) { return a[Math.floor(Sim.rand() * a.length)]; }

  function spawn(exAt) {
    var entries = World.exits.filter(function (e) { return World.isWalkway(e.x, e.y); });
    var ex = exAt || entries[Math.floor(Sim.rand() * entries.length)];
    if (!ex || !World.isWalkway(ex.x, ex.y)) return null;
    var g = {
      id: Sim.nextId++,
      x: ex.x + 0.5, y: ex.y + 0.5,
      px: 0, py: 0, offX: 0, offY: 0, pOffX: 0, pOffY: 0,
      hx: -ex.ox, hy: -ex.oy, facing: 0, moving: false, anim: Sim.rand() * 4,
      speed: rnd(C.WALK_MIN, C.WALK_MAX),
      state: 'WANDER', path: [], lastTile: null, budget: Math.floor(rnd(TF.Econ && TF.Econ.on() ? 90 : C.WANDER_MIN, TF.Econ && TF.Econ.on() ? 140 : C.WANDER_MAX)),
      considered: false, seen: {}, spawnExit: ex, hasTaco: false, paid: false, order: null, spot: -1, qs: 0, st: null,
      timer: 0, blockedT: 0, ghostT: 0, emote: null, emoteT: 0, gone: false, paidAt: 0,
      thought: null, thoughtT: 0, maxPay: rnd(4.5, 10), waitT: 0,
      variant: Math.floor(Sim.rand() * 1000),
      shirt: pick(SHIRTS), skin: pick(SKINS), hair: pick(HAIR), pants: pick(PANTS), pack: pick(PACKS),
      backpack: Sim.rand() < 0.6, cap: Sim.rand() < 0.2, longHair: Sim.rand() < 0.4, tall: 0.92 + Sim.rand() * 0.16
    };
    g.path.push(center(ex));
    g.px = g.x; g.py = g.y;
    Sim.guests.push(g);
    Sim.stats.spawned++;
    if (TF.Econ && TF.Econ.on() && placedStands().length) {
      var destinations = placedStands(), dest = destinations[Math.floor(Sim.rand()*destinations.length)];
      var key = ex.x + ',' + ex.y;
      if (dest.walkTargetsVersion !== World.version) { dest.walkTargets = {}; dest.walkTargetsVersion = World.version; }
      var walkTo = dest.walkTargets[key];
      if (!walkTo) {
        var field = World.exitField(ex, true), bestD = Infinity;
        for (var yy=0; yy<World.H; yy++) for(var xx=0; xx<World.W; xx++) {
          if (!World.isWalkway(xx,yy) || !Number.isFinite(field[yy*World.W+xx])) continue;
          var dd=Math.hypot(xx+0.5-dest.geom.cx,yy+0.5-dest.geom.cy);
          if(dd<bestD) { bestD=dd; walkTo={x:xx,y:yy}; }
        }
        dest.walkTargets[key]=walkTo;
      }
      if (walkTo) pathTo(g, walkTo, null, World.pavedCost);
    }
    return g;
  }
  Sim.spawnGuest = spawn;

  function isWalker(o) { return o.state === 'WANDER' || o.state === 'LEAVE' || o.state === 'TO_QUEUE' || o.state === 'TO_PICKUP' || o.state === 'PAID_WAIT'; }

  // Walkers bucketed by tile once per step, so following checks only the 3x3 tiles around.
  var GW, GH, grid;
  function sizeGrid() {   // sized to the map; rebuilt when a level loads (L2+ are bigger than L1)
    GW = World.W + 4; GH = World.H + 4; grid = [];
    for (var gi = 0; gi < GW * GH; gi++) grid.push([]);
  }
  sizeGrid();
  World.onLoad.push(sizeGrid);
  Sim.gridSize = function () { return [GW, GH]; };
  function bucket(x, y) { return (Math.max(0, Math.min(GH - 1, Math.floor(y) + 2))) * GW + Math.max(0, Math.min(GW - 1, Math.floor(x) + 2)); }
  function buildGrid() {
    for (var i = 0; i < grid.length; i++) grid[i].length = 0;
    for (var j = 0; j < Sim.guests.length; j++) { var o = Sim.guests[j]; if (isWalker(o)) grid[bucket(o.x, o.y)].push(o); }
  }

  function avoidance(g, hx, hy, dt) {
    if (g.ghostT > 0) { g.ghostT -= dt; return 1; }
    var f = 1, gx = g.x + g.offX, gy = g.y + g.offY;
    var bx = Math.max(0, Math.min(GW - 1, Math.floor(g.x) + 2)), by = Math.max(0, Math.min(GH - 1, Math.floor(g.y) + 2));
    for (var cy = Math.max(0, by - 1); cy <= Math.min(GH - 1, by + 1); cy++) for (var cx = Math.max(0, bx - 1); cx <= Math.min(GW - 1, bx + 1); cx++) {
      var cell = grid[cy * GW + cx];
      for (var i = 0; i < cell.length; i++) {
        var o = cell[i];
        if (o === g || o.gone) continue;
        var dx = o.x + o.offX - gx, dy = o.y + o.offY - gy;
        var ahead = dx * hx + dy * hy;
        if (ahead <= 0 || ahead > C.FOLLOW_SLOW) continue;
        if (Math.abs(-dx * hy + dy * hx) > C.FOLLOW_LAT) continue;
        if (o.moving && o.hx * hx + o.hy * hy < -0.3) continue;   // oncoming: lanes separate them
        f = Math.min(f, Math.max(0, (ahead - C.FOLLOW_STOP) / (C.FOLLOW_SLOW - C.FOLLOW_STOP)));
      }
    }
    if (f < 0.05) { g.blockedT += dt; if (g.blockedT > C.UNSTICK_T) { g.ghostT = 0.8; g.blockedT = 0; } }
    else g.blockedT = Math.max(0, g.blockedT - dt * 2);
    return f;
  }

  // Move along waypoints; returns true when the path is finished.
  function walk(g, dt, avoid) {
    if (!g.path.length) { g.moving = false; g.leftDt = 0; return true; }
    var t0 = g.path[0];
    var hx0 = t0.x - g.x, hy0 = t0.y - g.y, d0 = Math.hypot(hx0, hy0);
    var f = 1;
    if (avoid && d0 > 1e-6) f = avoidance(g, hx0 / d0, hy0 / d0, dt);
    if (avoid) {   // squeezing past a queue that stands on a busy crossing
      var cst = Sim.congest[Math.floor(g.x) + ',' + Math.floor(g.y)];
      if (cst && cst.queue.length >= 2) { f *= 0.5; Sim.stats.congestT += dt; }
    }
    var budget = g.speed * dt * f, moved = 0;
    while (budget > 1e-7 && g.path.length) {
      var t = g.path[0], dx = t.x - g.x, dy = t.y - g.y, d = Math.hypot(dx, dy);
      if (d < 1e-6) { g.path.shift(); continue; }
      g.hx = dx / d; g.hy = dy / d;
      if (budget >= d) { g.x = t.x; g.y = t.y; g.path.shift(); budget -= d; moved += d; continue; }
      g.x += g.hx * budget; g.y += g.hy * budget; moved += budget; budget = 0;
    }
    // Unused time this step, so a guest that picks a new waypoint keeps walking without a hitch.
    g.leftDt = g.path.length ? 0 : budget / (g.speed * Math.max(f, 1e-3));
    g.moving = moved > 1e-6;
    g.anim += moved;
    return g.path.length === 0;
  }

  function setFacingFromHeading(g, hx, hy) {
    var vx = hx - hy, vy = (hx + hy) / 2;   // screen-space direction
    var front = vy > 0.01 ? true : vy < -0.01 ? false : g.facing < 2;
    var right = vx > 0.01 ? true : vx < -0.01 ? false : (g.facing === 0 || g.facing === 3);
    g.facing = front ? (right ? 0 : 1) : (right ? 3 : 2);
  }

  function pathTo(g, goal, extra, cost) {
    // Start from the next waypoint tile if mid-segment, so nobody turns back.
    var startPt = g.path.length ? g.path[0] : { x: g.x, y: g.y };
    var st = { x: Math.floor(startPt.x), y: Math.floor(startPt.y) };
    var tiles = World.astar(st.x, st.y, goal.x, goal.y, cost);
    if (!tiles) return false;
    var pts = g.path.length ? [g.path[0]] : [];
    for (var i = 1; i < tiles.length; i++) pts.push(center(tiles[i]));
    if (tiles.length === 1 && !g.path.length) pts.push(center(tiles[0]));
    if (extra) pts.push(extra);
    g.path = pts;
    return true;
  }

  function startLeave(g) {
    var opts = World.exits.filter(function (e) { return e !== g.spawnExit; });
    var ex = opts[Math.floor(Sim.rand() * opts.length)] || World.exits[0];
    g.state = 'LEAVE';
    g.exit = ex;
    routeToExit(g, ex);
  }

  // Only the service approach may cross lawn: find a short access route, then stay
  // on pavement all the way to an exit. Never bridge disconnected walks through grass.
  function exitAccess(sx, sy, ex) {
    if (!World.inside(sx, sy) || !World.walkable(sx, sy)) return null;
    var field = World.exitField(ex, true), queue = [{ x: sx, y: sy, prev: -1 }], seen = {};
    seen[sx + ',' + sy] = true;
    for (var i = 0; i < queue.length; i++) {
      var t = queue[i];
      if (World.isWalkway(t.x, t.y)) {
        if (!Number.isFinite(field[t.y * World.W + t.x])) continue;
        var out = [], k = i;
        while (k >= 0) { out.push({ x: queue[k].x, y: queue[k].y }); k = queue[k].prev; }
        return out.reverse();
      }
      World.DIRS.forEach(function (d) {
        var x = t.x + d[0], y = t.y + d[1], key = x + ',' + y;
        if (!seen[key] && World.walkable(x, y)) { seen[key] = true; queue.push({ x: x, y: y, prev: i }); }
      });
    }
    return null;
  }

  function routeToExit(g, ex) {
    var startPt = g.path.length ? g.path[0] : { x: g.x, y: g.y };
    var sx = Math.floor(startPt.x), sy = Math.floor(startPt.y), access = ex && exitAccess(sx, sy, ex);
    if (!access) {
      for (var e = 0; e < World.exits.length; e++) {
        access = exitAccess(sx, sy, World.exits[e]);
        if (access) { ex = World.exits[e]; break; }
      }
    }
    if (!access) { g.path = []; return false; }
    var end = access[access.length - 1], tail = World.exitPath(end.x, end.y, ex, true);
    if (!tail) { g.path = []; return false; }
    var tiles = access.concat(tail.slice(1));
    g.exit = ex;
    var pts = g.path.length ? [g.path[0]] : [];
    for (var i = 1; i < tiles.length; i++) pts.push(center(tiles[i]));
    if (tiles.length === 1 && !g.path.length) pts.push(center(tiles[0]));
    // Interior door entries retire on their tile; edge exits walk out of bounds.
    if (!World.inside(ex.x + ex.ox, ex.y + ex.oy)) pts.push({ x: ex.x + 0.5 + ex.ox, y: ex.y + 0.5 + ex.oy });
    g.path = pts;
    return true;
  }
  Sim.routeToExit = routeToExit;
  // Kits a finished restock walk puts in the stand: Taco Week takes them from the van (TF.Econ);
  // Free Play refills to the stand's max as before.
  Sim.refillAmount = function (st) { return TF.Econ && TF.Econ.on() ? TF.Econ.refill(st) : st.mods.stockMax; };
  // A new level (World.loadLevel): new ground. Stands, lines, queues, guests, restock trips and
  // construction jobs belong to the old map and are cleared; cash (ledger), the portfolio and the crew
  // roster carry over (PLAN §1a). Stand 2 goes back to unbought.
  // The economy ramp row for the loaded level: its economyLevel, else the number in its id (generated
  // L2-L4 files have only id 'L2'..; they were all getting L1's $180 rent, C3c).
  Sim.levelNo = function () {
    var lv = World.level;
    return (lv && lv.economyLevel) || (lv && +((/\d+/.exec(lv.id || '') || [])[0])) || 1;
  };
  Sim.resetForLevel = function () {
    Sim.guests = []; Sim.flyers = []; Sim.floaters = [];
    Sim.stands.length = 1;
    var st = Sim.stand;
    st.placed = false; st.line = []; st.queue = []; st.window = null; st.trip = null;
      st.funnel = { walkers: 0, interested: 0, queued: 0, served: 0, lost: {} }; st.needRestock = false;
    st.tier = 0; st.stock = 0; st.building = null;   // upgrades reset per level (PLAN §1a)
    if (TF.Week && TF.Week.resetForLevel) TF.Week.resetForLevel();   // Monday PREP of the new level
    if (TF.Econ) TF.Econ.resetLevel(Sim.levelNo());
    // purchased extras (second cooler, cannon, AI Ali) are upgrades: they reset with the stand; the roster stays
    if (TF.Crew) { TF.Crew.extras = {}; if (TF.Crew.normalizeFreshmen) TF.Crew.normalizeFreshmen(); TF.Crew.applyMods(); TF.Crew.spotKey = ''; }
    for (var k = 0; k < st.pickup.length; k++) st.pickup[k] = null;
    st.cook.grill = []; st.cook.pending = [];
    Sim.sel = 0;
    syncWorld(); rebuildLines();
    if (TF.Build) TF.Build.jobs = [];
    if (TF.Supply) TF.Supply.trip = null;
  };
  World.onLoad.push(function () { Sim.resetForLevel(); });
  Sim.returnToQueue = function (g) { return goToQueue(g, g.st); };
  Sim.pathTo = pathTo;

  // Taco Week closing: people still walking over turn back; at the end of overtime anyone still
  // in line leaves, and anyone who already paid gets their taco on the way out.
  Sim.closeStand = function () {
    Sim.guests.forEach(function (g) { if (g.state === 'TO_QUEUE') { Sim.stats.closedTurnaway++; loseSale(g, g.st, 'closing time'); leavePolitely(g); } });
  };
  Sim.flushQueue = function () {
    Sim.guests.forEach(function (g) {
      var st = g.st;
      if (g.state === 'QUEUE' || (g.state === 'ORDER' && !g.paid) || g.state === 'TO_QUEUE') {
        Sim.stats.closedTurnaway++; loseSale(g, st, 'closing time');
        if (st) { var i = st.queue.indexOf(g); if (i >= 0) st.queue.splice(i, 1); if (st.window === g) st.window = null; }
        leavePolitely(g);
      } else if (g.paid && !g.hasTaco && st) {
        g.hasTaco = true; if (g.lostWhy) Sim.stats.lostThenServed++; Sim.stats.served++;
        st.served = (st.served || 0) + 1; st.funnel.served++;
        var j = st.queue.indexOf(g); if (j >= 0) st.queue.splice(j, 1);
        if (st.window === g) st.window = null;
        if (g.spot >= 0) { st.pickup[g.spot] = null; g.spot = -1; }
        g.atWindow = false; startLeave(g);
      }
    });
    Sim.stands.forEach(function (st) { st.cook.pending.length = 0; st.cook.grill.length = 0; });
  };
  Sim.reopenStand = function () { Sim.closing = false; };
  // Overnight: last night's walkers, lines, orders and restock walks are gone; the morning starts clean
  // (C6: a resumed day starts from exactly this state, so a replay gives the same ledger).
  Sim.newDay = function () {
    Sim.guests = []; Sim.floaters = []; Sim.flyers = [];
    Sim.stands.forEach(function (st) {
      st.queue = []; st.window = null; st.trip = null;
      st.funnel = { walkers: 0, interested: 0, queued: 0, served: 0, lost: {} };
      for (var k = 0; k < st.pickup.length; k++) st.pickup[k] = null;
      st.cook.pending = []; st.cook.grill = [];
    });
    if (TF.Supply) TF.Supply.trip = null;
    (Sim.newDayHooks || []).forEach(function (f) { f(); });   // e.g. the background crowd (6B)
  };

  // What is holding a stand back right now (one label), or null when it flows.
  TF.bottleneckOf = function (st) {
    if (!st || !st.placed) return null;
    // say why a stand isn't selling instead of failing silently (Pass 7)
    if (st.constructing) return 'BEING BUILT';
    if (st.idx > 0 && !st.crew) return 'NEEDS A CASHIER';
    if (!st.connected) return 'NO QUEUE LINE';
    if (TF.Econ && TF.Econ.on() && TF.Econ.stockStatus(st) === 'restocking') return 'RESTOCKING';
    if (st.trip) return 'RESTOCKING';
    if (TF.Econ && TF.Econ.on() ? TF.Econ.kits(st) <= 0 : st.stock <= 0) return 'NO STOCK';
    var main = st === Sim.stand;
    if (main && ((Sim.cookRate === 0 && (st.cook.grill.length || st.cook.pending.length)) || Sim.serviceSlow > 1)) return 'GRILL STALLED';
    if (st.window && st.window.paid && st.window.state === 'ORDER') return 'PICKUP FULL';
    if (st.cap > 0 && st.queue.length >= st.cap) return 'LINE FULL';
    if (st.cook.pending.length >= 2) return 'SLOW KITCHEN';
    return null;
  };

  function leavePolitely(g) {
    if (g.spot >= 0 && g.st) { g.st.pickup[g.spot] = null; g.spot = -1; }
    g.considered = true;
    g.path = [];
    g.emote = 'bye'; g.emoteT = 1.2;
    startLeave(g);
  }

  // A wanderer that ended up off the walks heads back to the nearest one.
  function ensureOnWalk(g) {
    var t = g.path.length ? { x: Math.floor(g.path[0].x), y: Math.floor(g.path[0].y) } : tileOf(g);
    if (World.isWalkway(t.x, t.y)) return;
    var w = World.nearestWalkway(t.x, t.y);
    if (!w || !pathTo(g, w, null)) startLeave(g);
  }

  function goToQueue(g, st) {
    if (!st.connected) return false;
    g.state = 'TO_QUEUE';
    g.st = st;
    g.path = g.path.slice(0, 1);
    var entry = st.poly[st.poly.length - 1];
    if (!pathTo(g, st.link, { x: entry.x, y: entry.y }, World.pavedCost)) { g.state = 'WANDER'; g.path = []; return false; }
    g.queuedStands = g.queuedStands || {};
    if (!g.queuedStands[st.idx]) { st.funnel.queued++; g.queuedStands[st.idx] = true; }
    unloseSale(g);   // walked away from the other stand, but buys here after all
    return true;
  }

  // Seconds a student expects to wait at a stand: the line ahead of them times ordering speed.
  Sim.predictedWait = function (st) {
    return (st.queue.length + enrouteCount(st)) * (st.mods.orderT + (st.mods.serving ? 0 : st.mods.handT * 0.5));
  };

  // A student near one or more stands they haven't sized up yet picks the best: shortest walk +
  // predicted wait. Each stand is considered once, so someone turned away by stand 1's long line
  // can still try stand 2 when they pass it.
  function chooseStand(g) {
    var best = null;
    placedStands().forEach(function (st) {
      if (g.seen[st.idx] || st.constructing) return;   // a stand still being built isn't open yet
      var d = Math.hypot(g.x - st.geom.cx, g.y - st.geom.cy);
      if (d > st.mods.zoneR) return;
      g.seen[st.idx] = true;
      st.funnel.walkers++;
      var score = d / g.speed + Sim.predictedWait(st) + (st.connected ? 0 : 1000);
      if (!best || score < best.score) best = { st: st, score: score };
    });
    return best && best.st;
  }

  // Taco Week demand: tuned so the stand is stressed at bells, not overwhelmed all day.
  var demandArg = /[?&]demand=([0-9.]+)/.exec(location.search);
  function weekDemand() { return TF.Week && TF.Week.active() ? (demandArg ? +demandArg[1] : C.WEEK_DEMAND) : 1; }
  function wanderStep(g) {
    var t = tileOf(g);
    if (!g.considered) {
      var st = chooseStand(g);
      if (st) {
        var econ = TF.Econ && TF.Econ.on(), fair = econ ? TF.Econ.level().prices.fair / 100 : Sim.menuPrice(st);
        var base = econ ? TF.Economy.interest({ distance: Math.hypot(g.x-st.geom.cx,g.y-st.geom.cy), radius: st.mods.zoneR, banner: st.tier >= 2, canopy: st.tier >= 4, reputation: st.reputation, event: (Sim.demandMul || 1) }) : st.mods.buyP * weekDemand();
        var draw = Sim.rand(), willing;
        base *= (TF.Empire ? TF.Empire.interest(st) : 1);
        base *= (TF.Objects ? TF.Objects.litterMul(st) : 1) * (TF.Hacks ? TF.Hacks.buyMul : 1);
        willing = econ ? base * TF.Economy.elasticity(Sim.menuPrice(st) / fair) : base;
        if (econ && draw < Math.max(base, willing)) st.funnel.interested++;
        if (econ && draw < base && draw >= willing) { loseSale(g, st, 'too pricey'); if (TF.Objects && TF.Objects.drinkOnly) TF.Objects.drinkOnly(g, st, 'too pricey'); }
        else if (econ && draw >= Math.max(base, willing) && TF.Objects && TF.Objects.drinkOnly && Math.hypot(g.x - st.geom.cx, g.y - st.geom.cy) < 6) TF.Objects.drinkOnly(g, st, 'hot');   // hot days: a cold drink, no taco
        if (draw < willing) {
          if (econ) g.maxPay = Math.max(fair, Sim.menuPrice(st)) * Math.pow(Math.max(0.001, Sim.rand()), -1/1.5);   // litter puts people off; TACO-NET pulls them in
          if (Sim.closing) { loseSale(g, st, 'closing time'); }
          else if (!st.connected) { g.emote = 'noline'; g.emoteT = 1.6; Sim.stats.noline++; loseSale(g, st, 'no line'); }
          else if (TF.Econ && TF.Econ.on() && TF.Econ.soldOutAll(st)) { g.emote = 'slow'; g.emoteT = 1.6; loseSale(g, st, 'sold out'); }   // no kits anywhere
          else if (g.maxPay < Sim.menuPrice(st)) { think(g, 'pricey'); loseSale(g, st, 'too pricey'); }
          else if (st.queue.length + enrouteCount(st) < st.cap) { if (goToQueue(g, st)) return; loseSale(g, st, 'no line'); }
          else {
            Sim.stats.balked++; noteBalk(st, 'longline'); loseSale(g, st, 'line full');
            if (TF.Objects && TF.Objects.drinkOnly) TF.Objects.drinkOnly(g, st, 'line full');   // the cooler is self-serve
            if (Sim.recentBalks(st, 'longline') <= 1) think(g, 'longline'); else Sim.thoughts.longline++;   // grouped: one bubble, then the stand's warning
          }
        }
      }
    }
    if (--g.budget <= 0) { startLeave(g); return; }
    if (!World.isWalkway(t.x, t.y)) { ensureOnWalk(g); if (g.state === 'WANDER' && !g.path.length) startLeave(g); return; }
    var opts = [], straight = null;
    for (var i = 0; i < 4; i++) {
      var d = World.DIRS[i], nx = t.x + d[0], ny = t.y + d[1];
      if (!World.isWalkway(nx, ny)) continue;
      if (g.lastTile && g.lastTile.x === nx && g.lastTile.y === ny) continue;
      opts.push({ x: nx, y: ny });
      if (Math.round(g.hx) === d[0] && Math.round(g.hy) === d[1]) straight = { x: nx, y: ny };
    }
    if (!opts.length) {
      if (g.lastTile && World.isWalkway(g.lastTile.x, g.lastTile.y)) opts.push(g.lastTile);
      else { startLeave(g); return; }
    }
    var next = straight && Sim.rand() < 0.6 ? straight : opts[Math.floor(Sim.rand() * opts.length)];
    g.lastTile = t;
    g.path.push(center(next));
  }

  // Lost-sales ledger (Pass 5 item 1): every student who walks away without a taco is counted
  // once, with the reason, the moment it happens. If they later join another stand's line the
  // entry is taken back, so a customer is never both lost and served.
  Sim.LOST_REASONS = ['line full', 'gave up waiting', 'too pricey', 'sold out', 'no line', 'closing time'];
  Sim.lost = {};
  Sim.LOST_REASONS.forEach(function (k) { Sim.lost[k] = 0; });
  Sim.lostTotal = function () { return Sim.LOST_REASONS.reduce(function (s, k) { return s + Sim.lost[k]; }, 0); };
  function loseSale(g, st, why) {
    if (st) {
      g.funnelLosses = g.funnelLosses || {};
      if (!g.funnelLosses[st.idx]) { st.funnel.lost[why] = (st.funnel.lost[why] || 0) + 1; g.funnelLosses[st.idx] = why;
        if (why === 'gave up waiting' || why === 'line full' || why === 'sold out') st.reputation = Math.max(0, st.reputation - 0.25); }
    }
    if (g.lostWhy) return;
    g.lostWhy = why; g.lostSt = st;
    if (TF.FX) TF.FX.balk(g, st, why);
    Sim.lost[why]++;
    if (st) { st.lost = st.lost || {}; st.lost[why] = (st.lost[why] || 0) + 1; }
    Sim.lostFlash = { t: Sim.t, why: why };
  }
  function unloseSale(g) {
    if (!g.lostWhy) return;
    Sim.lost[g.lostWhy]--;
    if (g.lostSt && g.lostSt.lost) g.lostSt.lost[g.lostWhy]--;
    g.lostWhy = null; g.lostSt = null;
  }
  Sim.loseSale = loseSale;
  Sim.leavePolitely = function (g) { leavePolitely(g); };   // cast effects (chunk 3)

  // How many students walked away from a stand for a reason in the last 10 s.
  Sim.recentBalks = function (st, why) {
    return (st.balks || []).filter(function (b) { return b.why === why && Sim.t - b.t <= 10; }).length;
  };
  // Recent balks per stand (for grouped warnings).
  function noteBalk(st, why) {
    st.balks = st.balks || [];
    st.balks.push({ t: Sim.t, why: why });
    if (st.balks.length > 40) st.balks.shift();
  }

  // RCT-style thought bubbles: a quick icon over a guest when something happens to them.
  function think(g, type, secs) {
    g.thought = type; g.thoughtT = secs || 2.2;
    Sim.thoughts[type]++;
  }
  Sim.think = think;
  // Rough menu price a guest compares against what they're willing to pay.
  Sim.menuPrice = function (st) {
    if (TF.Econ && TF.Econ.on()) return TF.Econ.priceDollars();   // Taco Week: the price tier (Cheap / Fair / Bougie)
    var p = (C.PRICE_MIN + C.PRICE_MAX) / 2 + ((st || Sim.stand).mods.priceAdd || 0);
    return Sim.priceBoostT > 0 ? p * 1.1 : p;
  };

  function freeSpot(st) {
    for (var i = 0; i < st.pickup.length; i++) if (!st.pickup[i]) return i;
    return -1;
  }

  function sendToPickup(g, viaCorner) {
    var st = g.st, k = freeSpot(st);
    if (k < 0) return false;
    st.pickup[k] = g;
    g.spot = k;
    g.state = 'TO_PICKUP';
    g.path = viaCorner ? [cornerPos(st), Sim.pickupPos(k, st)] : [Sim.pickupPos(k, st)];
    return true;
  }

  function pay(g) {
    if (g.paid) return;
    var st = g.st, econ = TF.Econ && TF.Econ.on(), base = 0, extra = 0;
    if (econ) {   // Taco Week: the rules layer prices the sale (tier) and posts it to the ledger
      var sale = TF.Econ.sell(g);
      if (sale.reason === 'restocking') return;
      if (sale.reason) {   // out of kits, or the price went up while they waited
        loseSale(g, st, sale.reason === 'tooPricey' ? 'too pricey' : 'sold out');
        if (sale.reason === 'tooPricey') think(g, 'pricey');
        var wi = st.queue.indexOf(g); if (wi >= 0) st.queue.splice(wi, 1); if (st.window === g) st.window = null; leavePolitely(g); return;
      }
      base = sale.dollars;
    }
    var price = econ ? base : C.PRICE_MIN + Math.floor(Sim.rand() * (C.PRICE_MAX - C.PRICE_MIN + 1)) + (st.mods.priceAdd || 0);
    if (Sim.priceBoostT > 0) { var bo = Math.max(1, Math.round(price * 0.1)); price += bo; extra += bo; }
    if (TF.CallLine) { var cl = TF.CallLine.onPay(g, st); price += cl; extra += cl; }
    g.paid = true;
    g.paidAt = Sim.t;
    var drink = TF.Objects ? TF.Objects.onPay(g, st) : 0;   // + a $2 agua fresca
    if (drink) { TF.Ledger.add('drinks', drink, 'agua fresca'); if (TF.Week) TF.Week.earn(drink); var wp = Sim.windowPos(st); Sim.floaters.push({ x: wp.x + 0.3, y: wp.y - 0.4, text: '+$' + drink + ' \uD83E\uDD64', t: 0 }); }
    var catalog = TF.Empire ? TF.Empire.onPay(g, st) : 0;
    price += catalog; extra += catalog;
    var prem = TF.Hacks ? TF.Hacks.onPay() : 0;   // GOLDEN TACO +$1 event premium
    if (prem) { price += prem; extra += prem; }
    if (!econ) TF.Ledger.add('sales', price, 'taco');
    else if (extra) TF.Ledger.add('premium', extra, 'add-ons');   // the base sale was posted by the rules layer
    st.rev = (st.rev || 0) + price + drink;   // revenue per stand (investment tallies)
    st.sold = (st.sold || 0) + 1;
    if (TF.Bets) TF.Bets.earn(price);
    if (TF.Week) TF.Week.earn(price);
    var w = Sim.windowPos(st);
    Sim.floaters.push({ x: w.x, y: w.y, text: '+$' + price, t: 0 });
    Sim.events.push({ type: 'cash', amount: price });
    if (TF.FX) TF.FX.cash(g, st);
    g.order = { guest: g, t: st.mods.cookT, total: st.mods.cookT, ready: false, progress: 0, handT: 0 };
    st.cook.pending.push(g.order);
    if (!econ) {
      st.stock = Math.max(0, st.stock - 1);
      if (st.stock === 0) st.needRestock = true;
    }
  }

  function updateGuest(g, dt) {
    g.px = g.x; g.py = g.y; g.pOffX = g.offX; g.pOffY = g.offY;
    if (g.emoteT > 0) { g.emoteT -= dt; if (g.emoteT <= 0) g.emote = null; }
    if (g.thoughtT > 0) { g.thoughtT -= dt; if (g.thoughtT <= 0) g.thought = null; }
    var laneOn = false, faceTo = null, st = g.st, slow = (st === Sim.stand ? Sim.serviceSlow : 1) / (TF.CallLine ? TF.CallLine.rate() : 1);

    switch (g.state) {
      case 'WANDER':
        laneOn = true;
        if (walk(g, dt, true)) {
          var moved0 = g.moving, left = g.leftDt;
          wanderStep(g);
          if ((g.state === 'WANDER' || g.state === 'LEAVE' || g.state === 'TO_QUEUE') && left > 0) {
            walk(g, left, false);
            g.moving = g.moving || moved0;
          }
        }
        break;
      case 'TO_QUEUE':
        laneOn = g.path.length > 1;
        if (walk(g, dt, true)) {
          if (!st.connected || st.queue.length >= st.cap) { leavePolitely(g); break; }
          st.queue.push(g); g.state = 'QUEUE'; g.qs = st.polyLen;
        }
        break;
      case 'QUEUE': {
        // 1-D along the painted line: walk toward our slot, never closer than 0.45 to the person ahead.
        var k = st.queue.indexOf(g);
        var target = k * C.Q_SPACING;
        if (k > 0) target = Math.max(target, st.queue[k - 1].qs + C.Q_SPACING * 0.9);
        var before = g.qs;
        if (g.qs > target) g.qs = Math.max(target, g.qs - g.speed * 0.85 * dt);
        var p = Sim.polyAt(g.qs, st);
        if (g.qs < before - 1e-6) { g.hx = p.dx; g.hy = p.dy; g.moving = true; g.anim += before - g.qs; }
        else { g.moving = false; faceTo = { x: p.dx, y: p.dy }; }
        g.x = p.x; g.y = p.y;
        if (k === 0 && g.qs <= 1e-4 && !st.window && Sim.isOpen(st)) { st.window = g; g.state = 'ORDER'; g.timer = st.mods.orderT; }
        impatience(g, dt);
        break;
      }
      case 'ORDER':
        faceTo = { x: -st.geom.n[0], y: -st.geom.n[1] };
        g.moving = false;
        // C4: unpaid at the window still counts (econ: continuous), and it's checked before the payment, so a
        // customer whose patience runs out on the same step leaves instead of paying (C4 final review)
        if (!g.paid) { impatience(g, dt); if (g.state !== 'ORDER') break; }
        if (!g.paid) { g.timer -= dt / slow; if (g.timer <= 0) pay(g); }
        if (g.paid && !st.mods.serving) { g.state = 'WAIT_PICKUP'; g.atWindow = true; }   // no serving station: wait at the table
        else if (g.paid && freeSpot(st) >= 0) {
          var qi = st.queue.indexOf(g);
          if (qi >= 0) st.queue.splice(qi, 1);
          st.window = null;
          sendToPickup(g, true);
        }
        break;
      case 'PAID_WAIT':   // paid, then the stand moved: walk to the new hatch and take a free spot
        laneOn = g.path.length > 0;
        walk(g, dt, true);
        if (!g.path.length) faceTo = { x: -st.geom.np[0], y: -st.geom.np[1] };
        if (!g.path.length || Math.hypot(g.x - st.geom.cx, g.y - st.geom.cy) < 3) sendToPickup(g, false);
        break;
      case 'TO_PICKUP':
        if (walk(g, dt, false)) g.state = 'WAIT_PICKUP';
        break;
      case 'WAIT_PICKUP':
        faceTo = g.atWindow ? { x: -st.geom.n[0], y: -st.geom.n[1] } : { x: -st.geom.np[0], y: -st.geom.np[1] };
        g.moving = false;
        g.waitT += dt;
        if (!g.hasTaco && g.waitT > 8 && !g.thoughtSlow) { g.thoughtSlow = true; think(g, 'slow'); }
        if (!g.hasTaco && g.order && g.order.ready) {
          g.order.handT += dt / slow / (st.info && !st.info.pickupClear ? 1.35 : 1);
          if (g.order.handT >= st.mods.handT * (TF.Arcs ? TF.Arcs.handMul() : 1) + (TF.Objects ? TF.Objects.handExtra(g, st) : 0)) {
            g.hasTaco = true; if (g.lostWhy) Sim.stats.lostThenServed++;
            g.timer = C.GOT_IT_T;
            Sim.stats.served++;
            st.served = (st.served || 0) + 1;
            st.funnel.served++;
            st.reputation = Math.min(100, Math.max(0, st.reputation + (g.waitT < 22 && Sim.menuPrice(st) <= (TF.Econ && TF.Econ.on() ? TF.Econ.level().prices.fair / 100 : 8) ? 0.65 : -0.05)));
            Sim.waits.push({ at: g.paidAt, w: Sim.t - g.paidAt });
            if (Sim.waits.length > 60) Sim.waits.shift();
            Sim.events.push({ type: 'handoff' });
            if (TF.FX) TF.FX.handoff(g, st);
            // Tortilla cannon (Phillip's gadget): the taco flies from the stand to the pickup spot.
            if (st.mods.cannon && !g.atWindow) {
              Sim.flyers.push({ x0: st.geom.cx, y0: st.geom.cy, x1: g.x, y1: g.y, t: 0, T: 0.45 });
              Sim.stats.tortillaShots++;
            }
          }
        }
        if (g.hasTaco) {
          g.timer -= dt;
          if (g.timer <= 0) {
            if (g.atWindow) { var wi = st.queue.indexOf(g); if (wi >= 0) st.queue.splice(wi, 1); if (st.window === g) st.window = null; g.atWindow = false; }
            else { st.pickup[g.spot] = null; g.spot = -1; }
            if (!(TF.Empire && TF.Empire.linger(g)) && !(TF.Objects && TF.Objects.trySeat(g))) startLeave(g);   // or sit and eat in the shade
          }
        }
        break;
      case 'LINGER':
        g.moving = false; g.lingerT -= dt;
        if (g.lingerT <= 0) {
          if (TF.Empire && TF.Empire.returnCustomer(g)) break;
          startLeave(g);
        }
        break;
      case 'TO_SEAT':
        if (walk(g, dt, true)) { g.state = 'EAT'; g.eatT = 6; g.moving = false; think(g, 'tasty'); g.thoughtTasty = true; }
        break;
      case 'EAT':   // seated at the picnic table
        g.moving = false; g.eatT -= dt;
        if (g.eatT <= 0) { TF.Objects.freeSeat(g); startLeave(g); }
        break;
      case 'LEAVE':
        if (!g.path.length && !routeToExit(g, g.exit)) { g.moving = false; break; }
        laneOn = g.path.length > 1;
        if (g.hasTaco && !g.thoughtTasty) { g.leaveT = (g.leaveT || 0) + dt; if (g.leaveT > 2) { g.thoughtTasty = true; think(g, 'tasty'); } }
        if (g.hasTaco && !g.littered && TF.Objects) { g.litT = (g.litT || 0) + dt; if (g.litT > 3.5) TF.Objects.maybeLitter(g); }   // done eating: wrapper
        if (walk(g, dt, true)) {
          g.gone = true;
          if (g.hasTaco) Sim.stats.completedLoop++;
        }
        break;
    }

    if (g.moving) setFacingFromHeading(g, g.hx, g.hy);
    else if (faceTo) setFacingFromHeading(g, faceTo.x, faceTo.y);

    var tx = laneOn ? -g.hy * C.LANE_OFF : 0, ty = laneOn ? g.hx * C.LANE_OFF : 0;
    var k2 = Math.min(1, dt * 6);
    g.offX += (tx - g.offX) * k2;
    g.offY += (ty - g.offY) * k2;
  }

  // Sim.cookRate < 1 while something distracts stand 1's cook (Mrs. West chatting with Ali).
  function updateCook(st, dt) {
    var ck = st.cook, rate = (st === Sim.stand ? Sim.cookRate * (Sim.rantRate || 1) : 1) * (TF.CallLine ? TF.CallLine.rate() : 1);   // Ali's sports rant slows it too
    while (ck.grill.length < st.mods.grill && ck.pending.length) ck.grill.push(ck.pending.shift());
    if (ck.grill.length && st === Sim.stand) Sim.stats.grillWork += dt * rate;
    for (var i = ck.grill.length - 1; i >= 0; i--) {
      var o = ck.grill[i];
      o.t -= dt * rate;
      o.progress = 1 - Math.max(0, o.t) / o.total;
      if (o.t <= 0) { o.ready = true; ck.grill.splice(i, 1); }
    }
  }

  // ---- Stock + restock walks ----------------------------------------------------
  // Open = the stand's cashier is there and there is stock. When the cooler empties (and no
  // Freshman Runner is hired) the cashier finishes the orders in hand, walks the paths off the
  // map with the cooler and comes back refilled.
  Sim.isOpen = function (st) { st = st || Sim.stand; return st.placed && (st.idx === 0 || !!st.crew) && !st.trip && (TF.Econ && TF.Econ.on() ? TF.Econ.kits(st) > 0 : st.stock > 0) && !st.constructing; };

  // Pass 6 C4 (PLAN §1c): with the economy on, patience is the continuous unpaid wait from joining the
  // line (the level's base, 28 s on L1, +-3 s per person, + picnic shade, - a tipped trash can nearby).
  // Free Play keeps the old rule (only time the stand is closed counts).
  Sim.patienceFor = function (g) {
    var lv = TF.Economy && TF.Economy.levels[Sim.levelNo() - 1];
    var base = lv ? lv.patienceS : C.PATIENCE;
    var shade = TF.Objects ? TF.Objects.patienceBonus(g) : 0;
    var fault = TF.Handyman ? TF.Handyman.patienceDelta(g) : 0;
    var a = TF.Aaron && TF.Aaron.live, spot = a && a.getState().hired && TF.Crew && TF.Crew.spotOf && TF.Crew.spotOf('aaron');
    var pitch = a && spot ? a.patienceBonus(spot, {position: {x: g.x, y: g.y}, waiting: true}) : 0;
    return base + ((g.variant % 7) - 3) + shade + fault + pitch;
  };
  function impatience(g, dt) {
    var st = g.st;
    if (TF.Econ && TF.Econ.on()) {
      g.waitT = (g.waitT || 0) + dt;
      var lim = g.patience = Sim.patienceFor(g);
      if (g.waitT > lim * 0.6 && !g.thoughtSlow) { g.thoughtSlow = true; think(g, 'slow'); }
      var sh = TF.Objects ? TF.Objects.patienceBonus(g) : 0;   // shade kept someone who'd have left
      if (sh && !g.shadeKept && g.waitT > lim - sh) { g.shadeKept = true; TF.Objects.shadeStats.kept++; }
      if (g.waitT > lim) giveUp(g, st);
      return;
    }
    if (Sim.isOpen(st)) { g.closedT = 0; return; }
    g.closedT = (g.closedT || 0) + dt;
    if (g.closedT > 8 && !g.thoughtSlow) { g.thoughtSlow = true; think(g, 'slow'); }
    var shade = TF.Objects ? TF.Objects.patienceBonus(g) : 0;   // picnic shade: +8 s for 4 nearby
    if (shade && !g.shadeKept && g.closedT > C.PATIENCE + (g.variant % 7)) { g.shadeKept = true; TF.Objects.shadeStats.kept++; }
    if (g.closedT > C.PATIENCE + (g.variant % 7) + shade) giveUp(g, st);
  }
  function giveUp(g, st) {
    var i = st.queue.indexOf(g);
    if (i >= 0) st.queue.splice(i, 1);
    if (st.window === g) st.window = null;
    Sim.stats.gaveUp++;
    noteBalk(st, 'slow'); loseSale(g, st, 'gave up waiting');
    leavePolitely(g);
    g.emote = 'slow'; g.emoteT = 1.8;
  }

  // The exit closest to `from`; if that tile itself is blocked (e.g. a tree at the stand's corner on a
  // bigger map), start from the nearest walkable tile around it.
  function nearestExit(from) {
    var fx = Math.floor(from.x), fy = Math.floor(from.y), best = null;
    for (var r = 0; r <= 3 && !best; r++) {
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        var x = fx + dx, y = fy + dy;
        World.exits.forEach(function (e) {
          var dd = World.exitDist(x, y, e) + r;
          if (dd < Infinity && (!best || dd < best.d)) best = { e: e, d: dd, x: x, y: y };
        });
      }
    }
    if (best) {
      best.t = World.exitPath(best.x, best.y, best.e);
      if (!best.t) return null;
    }
    return best;
  }

  function updateRestock(st, dt) {
    // With a Freshman Runner hired he fetches stock from the supply van and the cashier keeps selling.
    if (TF.Crew && TF.Crew.hiredSet.runner && !st.trip) { st.needRestock = false; return; }
    var handing = st.window && st.window.paid;
    // The 25% signal also schedules the runner. The cashier must sell the remaining
    // kits before leaving, including when a larger cooler raises that threshold.
    if (st.needRestock && st.stock <= 0 && !st.trip && !handing) {
      var d = cornerPos(st), ex = nearestExit(d);
      if (!ex) return;   // No route: stay sold out and retry; never refill through terrain.
      var r = st.trip = {
        x: ex.x + 0.5, y: ex.y + 0.5, px: ex.x + 0.5, py: ex.y + 0.5, offX: 0, offY: 0, pOffX: 0, pOffY: 0, path: [], speed: C.RESTOCK_SPEED || 1.8,
        hx: 1, hy: 0, facing: 0, moving: false, anim: 0, phase: 'out', exit: ex.e, access: { x: ex.x, y: ex.y }, timer: 0
      };
      r.path = ex.t.slice(1).map(center);
      r.path.push({ x: ex.e.x + 0.5 + ex.e.ox, y: ex.e.y + 0.5 + ex.e.oy });
      st.needRestock = false;
    }
    var r2 = st.trip;
    if (!r2) return;
    r2.px = r2.x; r2.py = r2.y; r2.pOffX = r2.offX; r2.pOffY = r2.offY;
    if (r2.phase === 'away') {
      r2.moving = false;
      r2.timer -= dt;
      if (r2.timer <= 0) {
        if (!r2.access) {
          var retryAccess = nearestExit(cornerPos(st));
          if (retryAccess) r2.access = { x: retryAccess.x, y: retryAccess.y };
        }
        var start = r2.returnStart || r2.exit;
        var back = r2.access && World.astar(start.x, start.y, r2.access.x, r2.access.y);
        if (!back) { r2.timer = 1; return; }   // Wait off-map and retry if the route is blocked.
        r2.phase = 'back';
        r2.path = back.map(center);
      }
    } else if (walk(r2, dt, false)) {
      if (r2.phase === 'out') { r2.phase = 'away'; r2.timer = C.RESTOCK_AWAY; }
      else { st.trip = null; st.stock = Sim.refillAmount(st); st.restocks++; Sim.events.push({ type: 'restock' }); }
    }
    if (r2.moving) setFacingFromHeading(r2, r2.hx, r2.hy);
  }

  Sim.setTier = function (tier, st) {
    st = st || Sim.selected();
    var was = st.tier;
    st.tier = tier;
    if (TF.Crew) TF.Crew.applyMods();
    // The grill brings fresh ingredients that last much longer than a cooler of tacos.
    if (was < 1 && tier >= 1 && !(TF.Econ && TF.Econ.on())) { st.stock = st.mods.stockMax; st.needRestock = false; }   // Taco Week: kits cost money, no free refill
  };

  Sim.step = function (dt) {
    if (TF.CallLine && TF.CallLine.active) return;
    Sim.t += dt;
    Sim.spawnT -= dt;
    if (Sim.priceBoostT > 0) Sim.priceBoostT -= dt;
    // Periodic rushes (Free Play): double spawns for ~30 s.
    if (Sim.rushT > 0) Sim.rushT -= dt;
    else if (Sim.t >= Sim.nextRush && !(TF.Week && TF.Week.active())) { Sim.rushT = C.RUSH_T; Sim.nextRush = Sim.t + rnd(C.RUSH_EVERY[0], C.RUSH_EVERY[1]); Sim.events.push({ type: 'toast', text: 'Rush!' }); }
    var crowd = C.CROWD[Sim.crowd];
    if (Sim.spawnT <= 0) {
      var week = TF.Week && TF.Week.active() && TF.Economy;
      Sim.spawnT += week ? 180 / (TF.Economy.walkers(TF.Econ.abs(TF.Week.day)) * (TF.Empire ? TF.Empire.arrivals() : 1)) : rnd(C.SPAWN_MIN, C.SPAWN_MAX) / (Sim.mods.spawnMul * crowd.mul * (Sim.rushT > 0 ? 2 : 1) * (Sim.demandMul || 1) * (TF.CastExtra ? TF.CastExtra.demandMul : 1));
      if ((!week || TF.Week.phase === 'open') && Sim.guests.length < (week ? TF.Econ.level().peakCrowd : crowd.max)) spawn();
    }
    if (TF.Events) TF.Events.step(dt);
    if (TF.Ambient) TF.Ambient.step(dt);
    if (TF.Bets) TF.Bets.step(dt);
    if (TF.Week) TF.Week.step(dt);
    if (TF.CallLine) TF.CallLine.step(dt);
    Sim.stands.forEach(function (st) { if (st.placed) { updateCook(st, dt); updateRestock(st, dt); } });
    if (TF.Supply) TF.Supply.step(dt);
    TF.plugins.forEach(function (p) { if (p.step) p.step(dt); });   // Pass 5 systems (build, drinks, ...)
    buildGrid();
    for (var i = 0; i < Sim.guests.length; i++) updateGuest(Sim.guests[i], dt);
    Sim.guests = Sim.guests.filter(function (g) { return !g.gone; });
    for (var fj = Sim.flyers.length - 1; fj >= 0; fj--) { Sim.flyers[fj].t += dt; if (Sim.flyers[fj].t > Sim.flyers[fj].T) Sim.flyers.splice(fj, 1); }
    for (var j = Sim.floaters.length - 1; j >= 0; j--) {
      Sim.floaters[j].t += dt;
      if (Sim.floaters[j].t > 1.3) Sim.floaters.splice(j, 1);
    }
    if (TF.Crew) TF.Crew.step(dt);
  };

  // ---- Stands: add / place / move ---------------------------------------------
  // Up to six stands; Crew assigns an operator and the expansion package tier.
  Sim.addStand = function () {
    if (Sim.stands.length >= Sim.MAX_STANDS) return null;
    var st = mkStand(Sim.stands.length);
    Sim.stands.push(st);
    if (TF.Crew) TF.Crew.applyMods();
    return st;
  };

  // Moving a stand clears its line: unpaid guests in line leave politely; guests who already
  // paid keep their order and are served at the new hatch (no refunds needed).
  Sim.placeStand = function (sx, sy, rot, st) {
    rot = rot || 0;
    st = st || Sim.selected();
    World.validating = st.idx;   // a stand may overlap its own old footprint
    var v = World.validateStand(sx, sy, rot);
    World.validating = null;
    if (!v.ok) return v;
    var wasPlaced = st.placed;
    var oldQueue = st.queue.slice();
    if (st.needsBuild && TF.Build) {   // second stand bought during OPEN: construction starts once it's placed
      st.needsBuild = false;
      st.constructing = true;
      Sim.afterPlace = function () {
        TF.Build.start({ st: st, id: 'stand2', name: 'Stand ' + (st.idx+1), apply: function () { st.constructing = false; }, at: { x: st.geom.cx, y: st.geom.cy + 0.6 } });
      };
    }
    st.offsite = false;
    st.placed = true; st.sx = sx; st.sy = sy; st.rot = rot;
    st.geom = World.standGeom(sx, sy, rot);
    syncWorld();
    st.line = [];
    st.queue = [];
    st.window = null;
    rebuildLines();
    if (!wasPlaced) {
      if (TF.Econ && TF.Econ.on() && TF.Week.phase === 'open') TF.Econ.refill(st, 0.5);
      // Pass 7 fix (Aaron: "no one is buying from my 2nd stand"): a stand bought during OPEN is
      // placed here for the first time, and this early return skipped the construction start at the
      // bottom, so it stayed 'constructing' (closed to buyers) for the rest of the run.
      runAfterPlace();
      return v;
    }

    for (var k = 0; k < st.pickup.length; k++) st.pickup[k] = null;
    if (st.trip) {
      var access = nearestExit(cornerPos(st));
      st.trip.access = access ? { x: access.x, y: access.y } : null;
      if (st.trip.phase === 'back') {
        var route = access && World.astar(Math.floor(st.trip.x), Math.floor(st.trip.y), access.x, access.y);
        st.trip.path = route ? route.map(center) : [];
        if (!route) {
          st.trip.returnStart = { x: Math.floor(st.trip.x), y: Math.floor(st.trip.y) };
          st.trip.phase = 'away'; st.trip.timer = 1;
        }
      }
    }
    Sim.guests.forEach(function (g) {
      var t = tileOf(g);
      if (World.isStand(t.x, t.y)) {
        var w = World.nearestWalkable(t.x, t.y);
        g.x = g.px = w.x + 0.5; g.y = g.py = w.y + 0.5; g.path = [];
      }
    });
    var pt = st.geom.pickup[0];
    oldQueue.forEach(function (g) {
      if (g.paid) { g.atWindow = false; g.path = []; g.spot = -1; g.state = 'PAID_WAIT'; pathTo(g, { x: pt[0], y: pt[1] }, null); }
      else leavePolitely(g);
    });
    Sim.guests.forEach(function (g) {
      if (g.state === 'TO_QUEUE' && g.st === st) leavePolitely(g);
      else if ((g.state === 'TO_PICKUP' || g.state === 'WAIT_PICKUP') && g.st === st && oldQueue.indexOf(g) < 0) {
        g.spot = -1;
        if (g.hasTaco) { startLeave(g); return; }
        g.path = [];
        g.state = 'PAID_WAIT';
        pathTo(g, { x: pt[0], y: pt[1] }, null);
      } else if (g.state === 'LEAVE' && g.exit) {
        routeToExit(g, g.exit);
      } else if (g.state === 'WANDER') {
        var nt = g.path.length ? g.path[0] : null;
        if (nt && World.isStand(Math.floor(nt.x), Math.floor(nt.y))) { g.path = []; ensureOnWalk(g); }
      }
    });
    runAfterPlace();
    return v;
  };
  function runAfterPlace() { if (Sim.afterPlace) { var ap = Sim.afterPlace; Sim.afterPlace = null; ap(); } }

  Sim.counts = function () {
    var c = { queue: 0, atPickup: 0, leavingWithTaco: 0, alive: Sim.guests.length, enroute: 0 };
    Sim.stands.forEach(function (st) { c.queue += st.queue.length; });
    Sim.guests.forEach(function (g) {
      if (g.state === 'WAIT_PICKUP' || g.state === 'TO_PICKUP') c.atPickup++;
      if (g.state === 'LEAVE' && g.hasTaco) c.leavingWithTaco++;
      if (g.state === 'TO_QUEUE') c.enroute++;
    });
    return c;
  };

  // Average pay -> taco-in-hand seconds, optionally only for orders paid at or after `since`.
  Sim.avgWait = function (since) {
    var w = Sim.waits.filter(function (e) { return since === undefined || e.at >= since; });
    return w.length ? w.reduce(function (a, e) { return a + e.w; }, 0) / w.length : 0;
  };
  Sim.waitCount = function (since) { return Sim.waits.filter(function (e) { return e.at >= since; }).length; };

  // Shared helpers for event walkers (Mrs. West, the hack wave, the supply runner).
  Sim.walkEntity = walk;
  Sim.faceEntity = setFacingFromHeading;
  Sim.routeTo = pathTo;
  Sim.nearestExit = nearestExit;
  Sim.oldMainDoor = function () {
    var d = World.level ? World.level.landmarks.oldMain.door : { x: 13, y: 0 };
    return World.exits.filter(function (e) { return e.y === d.y && e.x === d.x; })[0] || World.exits[0];
  };

  syncWorld();
  TF.Sim = Sim;
})(window.TF);
