// Tile map, stand / queue-line rules and A* pathfinding.
(function (TF) {
  var C = TF.C;
  // The map comes from the level file (src/data/levels/L1.js); C.MAP_W/H is only a fallback.
  var LV = (TF.LEVELS || {})[TF.LEVEL_ID || 'L1'] || null;
  var W = LV ? LV.w : C.MAP_W, H = LV ? LV.h : C.MAP_H;
  // Per-level tuning: peak walkers and demand. Reapplied on every loadLevel (L2 = 250, not L1's 150).
  var BASE = { crowdMax: C.CROWD.normal.max, demand: C.WEEK_DEMAND };
  function applyTuning(lv) {
    C.CROWD.normal.max = lv && lv.spawn && lv.spawn.crowdMax ? lv.spawn.crowdMax : BASE.crowdMax;
    C.WEEK_DEMAND = lv && lv.demand ? lv.demand : BASE.demand;
  }
  applyTuning(LV);
  // Tile kinds. STAIRS and RAMP are walkable like PATH (RAMP = the step-free route, for wheelchair
  // walkers later). Props: each placed prop type maps to a blocking kind; unknown types are T.PROP
  // and render looks up their sprite by type name, so new painted props drop in with no code.
  var T = { GRASS: 0, PATH: 1, TREE: 2, BENCH: 3, LAMP: 4, PLAZA: 5, PLANTER: 6, BUILDING: 7, STAIRS: 8, RAMP: 9, PROP: 10, HILL: 11 };
  var PROP_TILE = { oak: T.TREE, bench: T.BENCH, lamp: T.LAMP, planter: T.PLANTER };
  var WALK = {}; WALK[T.PATH] = 1; WALK[T.STAIRS] = 1; WALK[T.RAMP] = 1;

  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var World = {
    T: T, W: W, H: H,
    tiles: new Uint8Array(W * H),
    shade: new Float32Array(W * H),
    propType: [],         // tile index -> prop type ('oak', 'bench', ...) for every prop tile
    props: [],            // [{type, x, y, rot}] as placed (from the level file + generated oaks)
    exits: [],
    stand: null,          // {sx, sy, rot} when placed (set by Sim)
    lineSet: {},          // "x,y" -> chain index (set by Sim)
    lineOwner: {},        // "x,y" -> index of the stand whose line it is
    stands: [],           // placed stands {sx, sy, rot, idx} (set by Sim)
    validating: null,
    rng: rng,
    level: LV,
    onLoad: []          // other modules re-size their per-tile buffers here (objects mask, ...)
  };

  World.inside = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H; };
  World.get = function (x, y) { return World.inside(x, y) ? World.tiles[y * W + x] : -1; };
  World.set = function (x, y, t) { if (World.inside(x, y)) World.tiles[y * W + x] = t; };
  World.isPath = function (x, y) { return WALK[World.get(x, y)] === 1; };   // walks, stairs, ramps
  World.isProp = function (t) { return t === T.TREE || t === T.BENCH || t === T.LAMP || t === T.PLANTER || t === T.PROP; };

  // ---- The TXST Quad ------------------------------------------------------
  // Old Main sits on its hill past the top edge; a red-brick plaza fills the middle, limestone
  // walks cross it and run out to the edges, with planters, live oaks and lamps around it.
  World.build = function () {
    if (!LV) return buildLegacy();
    if (LV.map) return buildFromMap();
    var r = rng(LV.trees.seed), i, x, y;
    World.tiles.fill(T.GRASS);
    for (i = 0; i < W * H; i++) World.shade[i] = r();
    LV.walks.forEach(function (s) {
      for (y = Math.min(s[1], s[3]); y <= Math.max(s[1], s[3]); y++) for (x = Math.min(s[0], s[2]); x <= Math.max(s[0], s[2]); x++) World.set(x, y, T.PATH);
    });
    (LV.surfaces || []).forEach(function (sf) {   // stairs / ramps: walkable, drawn as limestone
      var k = sf.kind === 'ramp' ? T.RAMP : T.STAIRS, q = sf.rect;
      for (y = q[1]; y <= q[3]; y++) for (x = q[0]; x <= q[2]; x++) World.set(x, y, k);
    });
    LV.plazas.forEach(function (p) {
      for (y = p[1]; y <= p[3]; y++) for (x = p[0]; x <= p[2]; x++) if (World.get(x, y) !== T.PATH) World.set(x, y, T.PLAZA);
    });
    World.props = []; World.propType = [];
    function place(pr, ok) {
      if (ok && !ok(World.get(pr.x, pr.y))) return;
      World.set(pr.x, pr.y, PROP_TILE[pr.type] !== undefined ? PROP_TILE[pr.type] : T.PROP);
      World.propType[pr.y * W + pr.x] = pr.type;
      World.props.push({ type: pr.type, x: pr.x, y: pr.y, rot: pr.rot || 0 });
    }
    var props = LV.props || [];
    // ground-level props first (planters), then the generated oaks, then everything else
    props.filter(function (p) { return p.type === 'planter'; }).forEach(function (p) { place(p); });
    for (i = 0; i < LV.trees.tries; i++) {   // live oaks in the lawns, never touching a walk
      x = Math.floor(r() * W); y = Math.floor(r() * H);
      if (World.get(x, y) !== T.GRASS || World.nearWalk(x, y, 1)) continue;
      if (r() < LV.trees.p) place({ type: 'oak', x: x, y: y });
    }
    props.filter(function (p) { return p.type !== 'planter'; }).forEach(function (p) {
      place(p, p.type === 'lamp' ? function (t) { return t === T.GRASS || t === T.PLAZA; } : function (t) { return t === T.GRASS; });
    });
    findExits();
  };
  // ---- ASCII tile maps (LEVELS_TXST) --------------------------------------------------------------
  // Each map row is a string; LV.legend maps chars to {tile, prop, role}. A run of letters between
  // '#'/'^' cells is a building's name (label only). Fills: tiles, props, stand slots, entries,
  // chokes, building labels and Old Main's block.
  var KIND = { grass: T.GRASS, path: T.PATH, building: T.BUILDING, hill: T.HILL, stairs: T.STAIRS, ramp: T.RAMP, plaza: T.PLAZA };
  function buildFromMap() {
    var r = rng((LV.trees && LV.trees.seed) || 20261021), x, y, i;
    World.tiles.fill(T.GRASS);
    for (i = 0; i < W * H; i++) World.shade[i] = r();
    World.props = []; World.propType = []; World.slots = []; World.entries = []; World.chokes = []; World.labels = [];
    var om = null, nameCell = {};
    LV.map.forEach(function (row, y) {   // building names: letters (and '-') flanked by '#'/'^'
      var re = /[#^]([A-Z][A-Z\-]+)(?=[#^])/g, m;
      while ((m = re.exec(row))) {
        for (var k = 0; k < m[1].length; k++) nameCell[(m.index + 1 + k) + ',' + y] = 1;
        World.labels.push({ name: m[1], x: m.index + 1 + m[1].length / 2, y: y + 0.5 });
      }
    });
    var propAt = [];
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var ch = (LV.map[y] || '')[x] || '.', lg = nameCell[x + ',' + y] ? { tile: 'building' } : (LV.legend[ch] || { tile: 'grass' });
      World.set(x, y, KIND[lg.tile] !== undefined ? KIND[lg.tile] : T.GRASS);
      if (lg.prop) propAt.push({ type: lg.prop, x: x, y: y });
      if (lg.role === 'slot' || lg.role === 'slot2') World.slots.push({ x: x, y: y, main: lg.role === 'slot' });
      if (lg.role === 'entry') World.entries.push({ x: x, y: y });
      if (lg.role === 'choke') World.chokes.push({ x: x, y: y });
      if (lg.role === 'oldmain') om = om ? { x0: Math.min(om.x0, x), y0: Math.min(om.y0, y), x1: Math.max(om.x1, x), y1: Math.max(om.y1, y) } : { x0: x, y0: y, x1: x, y1: y };
    }
    World.oldMainBlock = om;
    function put(pr) {
      World.set(pr.x, pr.y, PROP_TILE[pr.type] !== undefined ? PROP_TILE[pr.type] : T.PROP);
      World.propType[pr.y * W + pr.x] = pr.type;
      World.props.push({ type: pr.type, x: pr.x, y: pr.y, rot: pr.rot || 0 });
    }
    propAt.forEach(put);
    (LV.props || []).forEach(function (pr) { var t = World.get(pr.x, pr.y); if (t === T.GRASS || (pr.type === 'lamp' && t === T.PLAZA)) put(pr); });
    // Stand slots: each run of S / s marks a slot's anchor (its first cell).
    var seen = {};
    World.standSlots = World.slots.filter(function (s) { var k = (s.x - 1) + ',' + s.y; seen[s.x + ',' + s.y] = 1; return !seen[k]; })
      .map(function (s, i) { return { id: (s.main ? 'main-' : 'stand2-') + i, x: s.x, y: s.y - (s.main ? 1 : 0), main: s.main }; })
      .sort(function (a, b) { return (b.main ? 1 : 0) - (a.main ? 1 : 0); });   // the main slot first
    findExits();
  }

  // Entrances/exits: every walk tile on the map edge, plus the map's 'E' cells (gaps between
  // buildings, the top of the Old Main stairs): walkers appear / vanish there, facing away from the walk.
  function findExits() {
    World.exits = []; World.droppedEntries = [];
    var isEntry = {};
    (World.entries || []).forEach(function (e) { isEntry[e.x + ',' + e.y] = 1; });
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (!World.isPath(x, y)) continue;
      if (World.entries && World.entries.length) {   // a map with 'E' cells: only those are entries
        if (!isEntry[x + ',' + y]) continue;
        // face away from the walk: the neighbour that isn't walkable (or the map edge)
        var out = DIRS.filter(function (d) { var nx = x + d[0], ny = y + d[1]; return !World.inside(nx, ny) || !(World.isPath(nx, ny) || World.get(nx, ny) === T.PLAZA); });
        var hasWalk = DIRS.some(function (d) { return World.isPath(x + d[0], y + d[1]); });
        if (!out.length || !hasWalk) { World.droppedEntries.push({ x: x, y: y }); continue; }   // an isolated 'E' (no walk leads to it): rejected, listed
        // walk out through a door: prefer a building / hill / the map edge over a lawn
        var gap = out.filter(function (d) { var k = World.get(x + d[0], y + d[1]); return k === T.BUILDING || k === T.HILL || k === -1; })[0] || out[0];
        World.exits.push({ x: x, y: y, ox: gap[0], oy: gap[1] });
      } else if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
        World.exits.push({ x: x, y: y, ox: x === 0 ? -1 : x === W - 1 ? 1 : 0, oy: y === 0 ? -1 : y === H - 1 ? 1 : 0 });
      }
    }
  }
  // Load a level: size, tiles and every per-tile buffer (occupancy, distance fields, A*) rebuilt from
  // scratch, so nothing is resized mid-level (PLAN §1a tech note).
  World.loadLevel = function (lv) {
    LV = World.level = lv; W = World.W = lv.w; H = World.H = lv.h;
    applyTuning(lv);
    World.tiles = new Uint8Array(W * H); World.shade = new Float32Array(W * H);
    allocSearch();
    fields = {}; World.version++;
    World.build();
    World.onLoad.forEach(function (fn) { fn(); });
  };

  function buildLegacy() {
    var r = rng(20261021), i, x, y;
    World.tiles.fill(T.GRASS);
    for (i = 0; i < W * H; i++) World.shade[i] = r();
    for (i = 0; i < H; i++) World.set(13, i, T.PATH);
    for (i = 0; i < W; i++) World.set(i, 14, T.PATH);
    for (i = 4; i <= 22; i++) { World.set(i, 6, T.PATH); World.set(i, 22, T.PATH); }
    for (i = 6; i <= 22; i++) { World.set(4, i, T.PATH); World.set(22, i, T.PATH); }
    for (y = 11; y <= 17; y++) for (x = 10; x <= 16; x++) if (World.get(x, y) !== T.PATH) World.set(x, y, T.PLAZA);
    findExits();
  }

  World.nearWalk = function (x, y, d) {
    for (var dy = -d; dy <= d; dy++) for (var dx = -d; dx <= d; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > d) continue;
      var t = World.get(x + dx, y + dy);
      if (t === T.PATH || t === T.PLAZA) return true;
    }
    return false;
  };

  // ---- Stand geometry ------------------------------------------------------
  // A 2x2 stand at (sx..sx+1, sy..sy+1). rot picks which faces carry the ORDER window and
  // the PICKUP hatch; they are always adjacent faces (the art has them on its two front faces).
  //   rot 0: order +y, pickup +x   rot 1: order +x, pickup +y
  //   rot 2: order -y, pickup +x   rot 3: order -x, pickup +y
  var ROTS = [
    { o: [0, 1], p: [1, 0] }, { o: [1, 0], p: [0, 1] },
    { o: [0, -1], p: [1, 0] }, { o: [-1, 0], p: [0, 1] }
  ];
  World.ROTS = ROTS;

  function frontTiles(sx, sy, n) {
    if (n[0] === 1) return [[sx + 2, sy], [sx + 2, sy + 1]];
    if (n[0] === -1) return [[sx - 1, sy], [sx - 1, sy + 1]];
    if (n[1] === 1) return [[sx, sy + 2], [sx + 1, sy + 2]];
    return [[sx, sy - 1], [sx + 1, sy - 1]];
  }

  World.standGeom = function (sx, sy, rot) {
    var R = ROTS[rot || 0], cx = sx + 1, cy = sy + 1;
    var of = frontTiles(sx, sy, R.o);
    // Order window: the front tile on the order face farthest from the pickup face.
    var dot = function (t) { return (t[0] + 0.5 - cx) * R.p[0] + (t[1] + 0.5 - cy) * R.p[1]; };
    var order = dot(of[0]) < dot(of[1]) ? of[0] : of[1];
    return {
      sx: sx, sy: sy, rot: rot || 0, n: R.o, np: R.p, cx: cx, cy: cy,
      tiles: [[sx, sy], [sx + 1, sy], [sx, sy + 1], [sx + 1, sy + 1]],
      order: order,
      pickup: frontTiles(sx, sy, R.p)
    };
  };

  var OBSTACLE = {};
  OBSTACLE[T.TREE] = 'A live oak'; OBSTACLE[T.BENCH] = 'A bench'; OBSTACLE[T.LAMP] = 'A lamp post'; OBSTACLE[T.PLANTER] = 'A planter';
  // ok, or the reason + the offending tile + a how-to-fix line for the player.
  World.validateStand = function (sx, sy, rot) {
    var g = World.standGeom(sx, sy, rot), i, t, tl;
    for (i = 0; i < 4; i++) {
      tl = g.tiles[i]; t = World.get(tl[0], tl[1]);
      if (t === -1) return { ok: false, reason: 'Off the map', tile: tl, fix: 'Move it inward: all 4 tiles must be on the quad.' };
      if (t === T.PATH) return { ok: false, reason: 'Can\u2019t build on a footpath', tile: tl, fix: 'Stands sit on grass or brick. Move it one tile off the walk.' };
      if (t !== T.GRASS && t !== T.PLAZA) return { ok: false, reason: 'Something is in the way', tile: tl, fix: (OBSTACLE[t] || 'Something') + ' is in the way. Try a clearer patch of lawn.' };
      if ((World.blockedForStand && World.blockedForStand(tl[0], tl[1])) || World.isStand(tl[0], tl[1]) || World.isPickup(tl[0], tl[1]) || World.isLine(tl[0], tl[1])) return { ok: false, reason: 'Something is in the way', tile: tl, fix: 'That spot is taken by the other stand or its line. Pick open ground.' };
    }
    tl = g.order; t = World.get(tl[0], tl[1]);
    if (World.isStand(tl[0], tl[1]) || World.isPickup(tl[0], tl[1]) || World.isLine(tl[0], tl[1])) return { ok: false, reason: 'Order window is blocked', tile: tl, fix: 'The other stand is in the way of the ORDER window. Press R or move.' };
    if (t !== T.GRASS && t !== T.PLAZA) return { ok: false, reason: 'Order window needs open ground in front', tile: tl, fix: 'The ORDER window needs grass or brick in front. Press R to turn the stand.' };
    for (i = 0; i < 2; i++) {
      tl = g.pickup[i]; t = World.get(tl[0], tl[1]);
      if (t !== T.GRASS && t !== T.PLAZA && t !== T.PATH || World.isStand(tl[0], tl[1]) || World.isLine(tl[0], tl[1])) return { ok: false, reason: 'Pickup hatch is blocked', tile: tl, fix: 'The pickup hatch needs open ground in front. Press R or move one tile.' };
    }
    return { ok: true, reason: '' };
  };
  // First rotation (starting from the preferred one) that is valid here, or null.
  World.bestRotation = function (sx, sy, pref) {
    for (var k = 0; k < 4; k++) { var r = ((pref || 0) + k) % 4; if (World.validateStand(sx, sy, r).ok) return r; }
    return null;
  };

  // Every placed stand (World.stands, kept by Sim). While a stand is being re-placed
  // (World.validating = its index) its own old footprint doesn't count.
  function eachStand(fn) {
    var list = World.stands || (World.stand ? [World.stand] : []);
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!s || (World.validating !== null && World.validating !== undefined && s.idx === World.validating)) continue;
      if (fn(s)) return true;
    }
    return !!World.planning && fn(World.planning);   // a not-yet-placed stand a line is planned for
  }
  World.isStand = function (x, y) {
    return eachStand(function (s) { return x >= s.sx && x <= s.sx + 1 && y >= s.sy && y <= s.sy + 1; });
  };
  World.isLine = function (x, y) { return World.lineSet[x + ',' + y] !== undefined; };
  World.isPickup = function (x, y) {
    return eachStand(function (s) {
      var g = World.standGeom(s.sx, s.sy, s.rot);
      return (g.pickup[0][0] === x && g.pickup[0][1] === y) || (g.pickup[1][0] === x && g.pickup[1][1] === y);
    });
  };

  // Line tiles go on grass or plaza (never on a footpath: the line must END at one).
  World.lineGround = function (x, y) {
    var t = World.get(x, y);
    return (t === T.GRASS || t === T.PLAZA) && !World.isStand(x, y) && !World.isPickup(x, y) && !(World.blockedForStand && World.blockedForStand(x, y));
  };

  // Footpaths and plaza that everyone may walk (line tiles and the stand are excluded).
  World.isWalkway = function (x, y) {
    var t = World.get(x, y);
    return (WALK[t] === 1 || t === T.PLAZA) && !World.isStand(x, y) && !World.isLine(x, y) && !(World.isObject && World.isObject(x, y));
  };

  World.walkable = function (x, y) {
    var t = World.get(x, y);
    return (t === T.GRASS || WALK[t] === 1 || t === T.PLAZA) && !World.isStand(x, y) && !(World.isObject && World.isObject(x, y));
  };

  // Guests keep to walks: grass is a last resort, line tiles are for queuers only.
  World.cost = function (x, y) {
    if (!World.walkable(x, y)) return Infinity;
    if (World.isLine(x, y)) return C.COST_LINE;
    var t = World.get(x, y);
    return t === T.GRASS ? C.COST_GRASS : C.COST_PATH;
  };

  // ---- A* on a 4-connected grid -----------------------------------------
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  World.DIRS = DIRS;
  var SB = {};
  function allocSearch() { SB = { g: new Float32Array(W * H), came: new Int32Array(W * H), closed: new Uint8Array(W * H) }; }
  allocSearch();
  World.astar = function (sx, sy, gx, gy) {
    if (!World.inside(sx, sy) || !World.inside(gx, gy)) return null;
    var N = W * H, start = sy * W + sx, goal = gy * W + gx;
    var g = SB.g, came = SB.came, closed = SB.closed;   // reused buffers (allocated per level load)
    g.fill(Infinity); came.fill(-1); closed.fill(0);
    var heap = [];
    function push(i, f) {
      heap.push([f, i]);
      var k = heap.length - 1;
      while (k > 0) { var p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; var tmp = heap[p]; heap[p] = heap[k]; heap[k] = tmp; k = p; }
    }
    function pop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last; var k = 0;
        for (;;) {
          var l = 2 * k + 1, r = l + 1, m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          var tmp = heap[m]; heap[m] = heap[k]; heap[k] = tmp; k = m;
        }
      }
      return top[1];
    }
    g[start] = 0;
    push(start, Math.abs(sx - gx) + Math.abs(sy - gy));
    while (heap.length) {
      var cur = pop();
      if (closed[cur]) continue;
      if (cur === goal) break;
      closed[cur] = 1;
      var cx = cur % W, cy = (cur / W) | 0;
      for (var d = 0; d < 4; d++) {
        var nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
        if (!World.inside(nx, ny)) continue;
        var ni = ny * W + nx;
        if (closed[ni]) continue;
        var c = World.cost(nx, ny);
        if (c === Infinity) continue;
        if (ni === goal) c = Math.min(c, 1);
        var ng = g[cur] + c;
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ni, ng + Math.abs(nx - gx) + Math.abs(ny - gy)); }
      }
    }
    if (g[goal] === Infinity) return null;
    var out = [], k = goal;
    while (k !== -1) { out.push({ x: k % W, y: (k / W) | 0 }); if (k === start) break; k = came[k]; }
    return out.reverse();
  };

  // ---- Exit distance fields ------------------------------------------------
  // One Dijkstra per exit over the same tile costs as A*, cached until the stand or its line
  // changes (World.version). Leaving guests just walk downhill: no per-guest A* in a crowd.
  World.version = 0;
  var fields = {};
  World.exitField = function (ex) {
    var key = ex.x + ',' + ex.y, f = fields[key];
    if (f && f.v === World.version) return f.d;
    var N = W * H, d = new Float32Array(N).fill(Infinity), heap = [[0, ex.y * W + ex.x]];
    d[ex.y * W + ex.x] = 0;
    while (heap.length) {
      var bi = 0;
      for (var h = 1; h < heap.length; h++) if (heap[h][0] < heap[bi][0]) bi = h;
      var top = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
      var u = top[1];
      if (top[0] > d[u]) continue;
      var ux = u % W, uy = (u / W) | 0, cu = World.cost(ux, uy);
      if (cu === Infinity) cu = 1;
      for (var k = 0; k < 4; k++) {
        var nx = ux + DIRS[k][0], ny = uy + DIRS[k][1];
        if (!World.inside(nx, ny) || World.cost(nx, ny) === Infinity) continue;
        var nd = d[u] + cu, ni = ny * W + nx;
        if (nd < d[ni]) { d[ni] = nd; heap.push([nd, ni]); }
      }
    }
    fields[key] = { v: World.version, d: d };
    return d;
  };
  // Tile path from (sx, sy) to the exit following the field (null if unreachable).
  World.exitPath = function (sx, sy, ex) {
    var d = World.exitField(ex), out = [{ x: sx, y: sy }], x = sx, y = sy, guard = 0;
    if (!World.inside(sx, sy) || d[sy * W + sx] === Infinity) return null;
    while ((x !== ex.x || y !== ex.y) && guard++ < 400) {
      var best = null, bd = d[y * W + x];
      for (var k = 0; k < 4; k++) {
        var nx = x + DIRS[k][0], ny = y + DIRS[k][1];
        if (!World.inside(nx, ny)) continue;
        var nd = d[ny * W + nx];
        if (nd < bd) { bd = nd; best = { x: nx, y: ny }; }
      }
      if (!best) return null;
      x = best.x; y = best.y; out.push(best);
    }
    return out;
  };
  World.exitDist = function (sx, sy, ex) { return World.inside(sx, sy) ? World.exitField(ex)[sy * W + sx] : Infinity; };

  World.nearestWalkway = function (x, y) {
    for (var r = 0; r < 12; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (World.isWalkway(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    }
    return null;
  };

  World.nearestWalkable = function (x, y) {
    for (var r = 0; r < 6; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (World.walkable(x + dx, y + dy) && !World.isLine(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    }
    return { x: x, y: y };
  };

  TF.World = World;
})(window.TF);
