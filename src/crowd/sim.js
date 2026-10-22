(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./grid'), require('./flowfield'), require('./pool'));
  else {
    root.TF = root.TF || {}; root.TF.Crowd = root.TF.Crowd || {};
    root.TF.Crowd.Sim = factory(root.TF.Crowd.Grid, root.TF.Crowd.FlowField, root.TF.Crowd.Pool);
  }
}(typeof window !== 'undefined' ? window : this, function (Grid, FlowField, Pool) {
  'use strict';
  var STEP = 0.05;
  function mulberry32(seed) {
    var state = seed >>> 0;
    function random() {
      state = (state + 0x6D2B79F5) >>> 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    random.getState = function () { return state; };
    random.setState = function (value) { state = value >>> 0; };
    return random;
  }
  function create(opts) {
    var W = opts.W, H = opts.H, capacity = opts.capacity === undefined ? 350 : opts.capacity;
    if (capacity < 1 || capacity !== Math.floor(capacity)) throw new RangeError('Invalid capacity');
    var costs = opts.costs, stairs = opts.stairs, fields = FlowField.createFieldSet(W, H);
    var destinations = opts.destinations || {}, key, i, activeCount = 0;
    for (key in destinations) if (Object.prototype.hasOwnProperty.call(destinations, key)) fields.define(key, destinations[key]);
    fields.rebuild(costs, stairs);
    var grid = Grid.create(W, H, 8, capacity), walkers = new Array(capacity), neighbors = new Int32Array(capacity);
    var rng = mulberry32(opts.seed === undefined ? 1 : opts.seed), accumulator = 0, ticks = 0;
    var pool = Pool.create(function (id) {
      var w = { id: id, active: false, x: 0, y: 0, prevX: 0, prevY: 0, dest: '', speed: 1,
        stepFree: false, arrived: false, waypoint: -1, phase: 0, onArrive: null };
      walkers[id] = w; return w;
    }, function (w) { w.active = false; w.onArrive = null; }, capacity);
    function tileAt(x, y) { return Math.floor(y) * W + Math.floor(x); }
    function allowed(x, y, free) {
      if (!(x >= 0 && y >= 0 && x < W && y < H)) return false;
      var t = tileAt(x, y);
      return costs[t] > 0 && isFinite(costs[t]) && !(free && stairs && stairs[t]);
    }
    // Axis sweeps prevent tunnelling, including at corners and high speeds.
    function moveTo(w, x, y) {
      var dx = x - w.x, dy = y - w.y, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.1)), k, nx, ny;
      dx /= n; dy /= n;
      for (k = 0; k < n; k++) {
        nx = w.x + dx; if (allowed(nx, w.y, w.stepFree)) w.x = nx;
        ny = w.y + dy; if (allowed(w.x, ny, w.stepFree)) w.y = ny;
      }
      grid.move(w.id, w.x, w.y);
    }
    function arrive(w) {
      if (w.arrived) return;
      w.arrived = true; w.waypoint = -1;
      if (w.onArrive) w.onArrive(w.id, w);
      if (api.onArrive) api.onArrive(w.id, w);
    }
    function advance(w) {
      var field = fields.get(w.dest, w.stepFree), budget = w.speed * STEP;
      var t, next, tx, ty, dx, dy, length, travel, guard = 0;
      while (budget > 1e-12 && guard++ < W * H + 1 && w.active) {
        t = tileAt(w.x, w.y);
        if (field.dist[t] === 0) { arrive(w); break; }
        if (field.next[t] < 0) { w.waypoint = -1; break; }
        next = w.waypoint;
        if (next < 0) next = w.waypoint = field.next[t];
        // optional per-walker lane offset inside the tile (w.ox / w.oy, |.| < 0.5): people heading opposite ways
        // on one line pass each other instead of meeting head-on at the tile centres (6B B1)
        tx = next % W + 0.5 + (w.ox || 0); ty = ((next / W) | 0) + 0.5 + (w.oy || 0);
        dx = tx - w.x; dy = ty - w.y; length = Math.sqrt(dx * dx + dy * dy);
        if (length < 1e-10) { w.waypoint = -1; continue; }
        travel = Math.min(budget, length);
        moveTo(w, w.x + dx / length * travel, w.y + dy / length * travel);
        budget -= travel;
        if (travel === length) w.waypoint = -1;
      }
      if (w.active && field.dist[tileAt(w.x, w.y)] === 0) arrive(w);
    }
    function separate() {
      var pass, id, j, count, other, w, v, dx, dy, d2, d, push, angle;
      // Fixed work bound: six solver passes, at most 128 candidate pairs per walker.
      for (pass = 0; pass < 6; pass++) for (id = 0; id < capacity; id++) {
        w = walkers[id]; if (!w.active || w.arrived) continue;
        count = grid.queryRect(w.x - 0.35, w.y - 0.35, w.x + 0.35, w.y + 0.35, neighbors);
        for (j = 0; j < count && j < 128; j++) {
          other = neighbors[j]; if (other <= id) continue;
          v = walkers[other]; if (!v.active || v.arrived) continue;
          dx = v.x - w.x; dy = v.y - w.y; d2 = dx * dx + dy * dy;
          if (d2 >= 0.1225) continue;
          if (d2 < 1e-16) {
            angle = w.phase + v.phase + id * 2.399963229728653;
            dx = Math.cos(angle); dy = Math.sin(angle); d = 0;
          } else { d = Math.sqrt(d2); dx /= d; dy /= d; }
          push = (0.35 - d) * 0.5;
          moveTo(w, w.x - dx * push, w.y - dy * push);
          moveTo(v, v.x + dx * push, v.y + dy * push);
        }
      }
    }
    function tick() {
      var id, w;
      for (id = 0; id < capacity; id++) {
        w = walkers[id]; if (!w.active) continue;
        w.prevX = w.x; w.prevY = w.y;
        if (!w.arrived) advance(w);
      }
      separate(); ticks++;
    }
    function addWalker(spec) {
      if (!fields.get(spec.dest, spec.stepFree)) throw new Error('Unknown destination');
      if (!allowed(spec.x, spec.y, spec.stepFree)) throw new RangeError('Blocked spawn');
      if (spec.speed !== undefined && (!(spec.speed >= 0) || !isFinite(spec.speed))) throw new RangeError('Invalid speed');
      if (activeCount >= capacity) return -1;
      var w = pool.acquire(); w.active = true; w.x = w.prevX = spec.x; w.y = w.prevY = spec.y;
      w.dest = spec.dest; w.speed = spec.speed === undefined ? 1 : spec.speed; w.stepFree = !!spec.stepFree;
      w.arrived = false; w.waypoint = -1; w.phase = rng() * Math.PI * 2; w.onArrive = spec.onArrive || null;
      activeCount++; grid.insert(w.id, w.x, w.y); return w.id;
    }
    function removeWalker(id) {
      var w = walkers[id]; if (!w || !w.active) return false;
      grid.remove(id); pool.release(w); activeCount--; return true;
    }
    function update(dt) {
      if (!(dt >= 0) || !isFinite(dt)) throw new RangeError('Invalid dt');
      accumulator += dt; var steps = 0;
      while (accumulator + 1e-12 >= STEP && steps < 5) { accumulator = Math.max(0, accumulator - STEP); tick(); steps++; }
      // Retain backlog after the cap; interpolation clamps while catching up.
      return steps;
    }
    function setCosts(newCosts, newStairs) {
      // A footprint can cover an occupied tile: relocate to the closest legal centre.
      fields.rebuild(newCosts, newStairs); costs = newCosts; stairs = newStairs;
      var id, w, t, x, y, d, best, bestD;
      for (id = 0; id < capacity; id++) {
        w = walkers[id]; if (!w.active) continue;
        w.waypoint = -1;
        if (!allowed(w.x, w.y, w.stepFree)) {
          best = -1; bestD = Infinity;
          for (t = 0; t < W * H; t++) {
            x = t % W + 0.5; y = ((t / W) | 0) + 0.5;
            if (!allowed(x, y, w.stepFree)) continue;
            d = (x - w.x) * (x - w.x) + (y - w.y) * (y - w.y);
            if (d < bestD) { bestD = d; best = t; }
          }
          if (best < 0) { removeWalker(id); continue; }
          w.x = w.prevX = best % W + 0.5; w.y = w.prevY = ((best / W) | 0) + 0.5;
          grid.move(id, w.x, w.y);
        }
        w.arrived = fields.get(w.dest, w.stepFree).dist[tileAt(w.x, w.y)] === 0;
      }
    }
    // Compare complete level definitions, without a hash collision or JSON's Infinity -> null loss.
    function levelSignature() {
      var terrain = [], steps = [], t;
      for (t = 0; t < W * H; t++) { terrain.push(String(costs[t])); steps.push(stairs && stairs[t] ? 1 : 0); }
      return JSON.stringify([W, H, terrain, steps, fields.definition()]);
    }
    function snapshot() {
      var state = { version: 1, level: levelSignature(), capacity: capacity,
        tick: ticks, accumulator: accumulator, rng: rng.getState(), walkers: [],
        free: pool.snapshot(), grid: [] }, id, w, b;
      // Separation is order-dependent: retain linked bucket order, not just positions.
      for (b = 0; b < grid.head.length; b++) {
        for (id = grid.head[b]; id >= 0; id = grid.next[id]) state.grid.push(id);
      }
      for (id = 0; id < capacity; id++) {
        w = walkers[id]; if (!w.active) continue;
        state.walkers.push({ id: id, x: w.x, y: w.y, prevX: w.prevX, prevY: w.prevY, dest: w.dest,
          speed: w.speed, stepFree: w.stepFree, arrived: w.arrived, waypoint: w.waypoint, phase: w.phase });
      }
      return state;
    }
    // Callbacks are application code, not save data; rebind per-walker callbacks after loading.
    function restore(snap) {
      function invalid() { throw new Error('Invalid crowd snapshot'); }
      function finite(value) { return typeof value === 'number' && isFinite(value); }
      if (!snap || snap.version !== 1) invalid();
      if (snap.level !== levelSignature()) throw new Error('Crowd snapshot level mismatch');
      if (snap.capacity !== capacity) throw new Error('Crowd snapshot capacity mismatch');
      if (!Number.isSafeInteger(snap.tick) || snap.tick < 0 || !finite(snap.accumulator) || snap.accumulator < 0 ||
          !Number.isInteger(snap.rng) || snap.rng < 0 || snap.rng > 0xFFFFFFFF ||
          !Array.isArray(snap.walkers) || !Array.isArray(snap.free) || !Array.isArray(snap.grid) ||
          snap.walkers.length + snap.free.length !== capacity || snap.grid.length !== snap.walkers.length) invalid();
      var seen = new Set(), indexed = new Set(), j, id, w, saved;
      // Validate everything before mutating the live simulation.
      for (j = 0; j < snap.walkers.length; j++) {
        saved = snap.walkers[j];
        if (!saved) invalid();
        id = saved.id;
        if (!Number.isInteger(id) || id < 0 || id >= capacity || seen.has(id) ||
            !finite(saved.x) || !finite(saved.y) || !allowed(saved.x, saved.y, saved.stepFree) ||
            !finite(saved.prevX) || !finite(saved.prevY) || !finite(saved.speed) || saved.speed < 0 ||
            typeof saved.dest !== 'string' || !fields.get(saved.dest, saved.stepFree) ||
            typeof saved.stepFree !== 'boolean' || typeof saved.arrived !== 'boolean' ||
            !Number.isInteger(saved.waypoint) || saved.waypoint < -1 || saved.waypoint >= W * H || !finite(saved.phase)) invalid();
        seen.add(id);
      }
      for (j = 0; j < snap.grid.length; j++) {
        id = snap.grid[j];
        if (!seen.has(id) || indexed.has(id)) invalid();
        indexed.add(id);
      }
      for (j = 0; j < snap.free.length; j++) {
        id = snap.free[j];
        if (!Number.isInteger(id) || id < 0 || id >= capacity || seen.has(id)) invalid();
        seen.add(id);
      }
      for (id = 0; id < capacity; id++) grid.remove(id);
      pool.restore(snap.free);
      for (j = 0; j < snap.walkers.length; j++) {
        saved = snap.walkers[j]; w = walkers[saved.id];
        w.active = true; w.x = saved.x; w.y = saved.y; w.prevX = saved.prevX; w.prevY = saved.prevY;
        w.dest = saved.dest; w.speed = saved.speed; w.stepFree = saved.stepFree; w.arrived = saved.arrived;
        w.waypoint = saved.waypoint; w.phase = saved.phase;
      }
      for (j = snap.grid.length - 1; j >= 0; j--) {
        w = walkers[snap.grid[j]]; grid.insert(w.id, w.x, w.y);
      }
      activeCount = snap.walkers.length; ticks = snap.tick; accumulator = snap.accumulator; rng.setState(snap.rng);
      return api;
    }
    var api = { STEP: STEP, walkers: walkers, grid: grid, fields: fields, pool: pool, rng: rng, onArrive: opts.onArrive || null,
      addWalker: addWalker, removeWalker: removeWalker, update: update, tick: tick, setCosts: setCosts,
      alpha: function () { return Math.min(1, accumulator / STEP); },
      getRenderPos: function (id, out) {
        var w = walkers[id]; if (!w || !w.active) return null;
        var a = Math.min(1, accumulator / STEP); out.x = w.prevX + (w.x - w.prevX) * a; out.y = w.prevY + (w.y - w.prevY) * a; return out;
      },
      getState: rng.getState, setState: rng.setState, snapshot: snapshot, restore: restore };
    return api;
  }
  return { create: create, STEP: STEP, mulberry32: mulberry32 };
}));
