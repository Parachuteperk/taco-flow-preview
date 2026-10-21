// Tile map, stand / queue-line rules and A* pathfinding.
(function (TF) {
  var C = TF.C;
  var W = C.MAP_W, H = C.MAP_H;
  var T = { GRASS: 0, PATH: 1, TREE: 2, BENCH: 3, LAMP: 4, PLAZA: 5, PLANTER: 6, BUILDING: 7 };

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
    exits: [],
    stand: null,          // {sx, sy, rot} when placed (set by Sim)
    lineSet: {},          // "x,y" -> chain index (set by Sim)
    lineOwner: {},        // "x,y" -> index of the stand whose line it is
    stands: [],           // placed stands {sx, sy, rot, idx} (set by Sim)
    validating: null,
    rng: rng
  };

  World.inside = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H; };
  World.get = function (x, y) { return World.inside(x, y) ? World.tiles[y * W + x] : -1; };
  World.set = function (x, y, t) { if (World.inside(x, y)) World.tiles[y * W + x] = t; };
  World.isPath = function (x, y) { return World.get(x, y) === T.PATH; };

  // ---- The TXST Quad ------------------------------------------------------
  // Old Main sits on its hill past the top edge; a red-brick plaza fills the middle, limestone
  // walks cross it and run out to the edges, with planters, live oaks and lamps around it.
  World.build = function () {
    var r = rng(20261021), i, x, y;
    World.tiles.fill(T.GRASS);
    for (i = 0; i < W * H; i++) World.shade[i] = r();
    // Limestone walks: the main north-south axis toward Old Main, an east-west cross walk,
    // a loop around the plaza and two diagonal-ish spurs out to the edges.
    for (i = 0; i < H; i++) World.set(13, i, T.PATH);
    for (i = 0; i < W; i++) World.set(i, 14, T.PATH);
    for (i = 4; i <= 22; i++) { World.set(i, 6, T.PATH); World.set(i, 22, T.PATH); }
    for (i = 6; i <= 22; i++) { World.set(4, i, T.PATH); World.set(22, i, T.PATH); }
    for (i = 22; i < W; i++) World.set(i, 9, T.PATH);
    for (i = 22; i < H; i++) World.set(7, i, T.PATH);
    // Red-brick plaza around the crossing.
    for (y = 11; y <= 17; y++) for (x = 10; x <= 16; x++) if (World.get(x, y) !== T.PATH) World.set(x, y, T.PLAZA);
    // Planters at the plaza corners (blocked, flowers).
    [[10, 11], [16, 11], [10, 17], [16, 17]].forEach(function (p) { World.set(p[0], p[1], T.PLANTER); });
    // Old Main's front steps area: a little plaza at the top of the axis.
    for (x = 11; x <= 15; x++) for (y = 0; y <= 1; y++) if (World.get(x, y) !== T.PATH) World.set(x, y, T.PLAZA);
    // Live oaks in the lawns, never touching a walk.
    for (i = 0; i < 500; i++) {
      x = Math.floor(r() * W); y = Math.floor(r() * H);
      if (World.get(x, y) !== T.GRASS || World.nearWalk(x, y, 1)) continue;
      if (r() < 0.4) World.set(x, y, T.TREE);
    }
    [[12, 8], [14, 20], [5, 13], [21, 15], [9, 5], [17, 23], [3, 9]].forEach(function (b) {
      if (World.get(b[0], b[1]) === T.GRASS) World.set(b[0], b[1], T.BENCH);
    });
    [[12, 5], [14, 23], [3, 15], [23, 13], [9, 13], [17, 15]].forEach(function (b) {
      if (World.get(b[0], b[1]) === T.GRASS || World.get(b[0], b[1]) === T.PLAZA) World.set(b[0], b[1], T.LAMP);
    });

    World.exits = [];
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      if (!World.isPath(x, y)) continue;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
        World.exits.push({ x: x, y: y, ox: x === 0 ? -1 : x === W - 1 ? 1 : 0, oy: y === 0 ? -1 : y === H - 1 ? 1 : 0 });
      }
    }
  };

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
    return (t === T.PATH || t === T.PLAZA) && !World.isStand(x, y) && !World.isLine(x, y) && !(World.isObject && World.isObject(x, y));
  };

  World.walkable = function (x, y) {
    var t = World.get(x, y);
    return (t === T.GRASS || t === T.PATH || t === T.PLAZA) && !World.isStand(x, y) && !(World.isObject && World.isObject(x, y));
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
  World.astar = function (sx, sy, gx, gy) {
    if (!World.inside(sx, sy) || !World.inside(gx, gy)) return null;
    var N = W * H, start = sy * W + sx, goal = gy * W + gx;
    var g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
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
