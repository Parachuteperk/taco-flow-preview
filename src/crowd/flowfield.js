(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Crowd = root.TF.Crowd || {}; root.TF.Crowd.FlowField = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function create(W, H) {
    if (W <= 0 || H <= 0 || W !== Math.floor(W) || H !== Math.floor(H)) throw new RangeError('Invalid dimensions');
    var N = W * H, dist = new Float32Array(N), next = new Int32Array(N);
    var exact = new Float64Array(N), heap = new Int32Array(N), pos = new Int32Array(N), count = 0;
    function less(a, b) { return exact[a] < exact[b] || (exact[a] === exact[b] && a < b); }
    function up(id) {
      var k = pos[id], p;
      if (k < 0) { k = count++; }
      while (k > 0) { p = (k - 1) >> 1; if (!less(id, heap[p])) break; heap[k] = heap[p]; pos[heap[k]] = k; k = p; }
      heap[k] = id; pos[id] = k;
    }
    function pop() {
      var id = heap[0], v = heap[--count], k = 0, c;
      pos[id] = -2;
      if (count) {
        while ((c = k * 2 + 1) < count) {
          if (c + 1 < count && less(heap[c + 1], heap[c])) c++;
          if (!less(heap[c], v)) break;
          heap[k] = heap[c]; pos[heap[k]] = k; k = c;
        }
        heap[k] = v; pos[v] = k;
      }
      return id;
    }
    function build(costs, targets, opts) {
      if (!costs || costs.length !== N) throw new RangeError('Incorrect costs length');
      opts = opts || {}; var stairs = opts.stairs, stepFree = opts.stepFree, i, u, v, d, x, y, k;
      if (stairs && stairs.length !== N) throw new RangeError('Incorrect stairs length');
      count = 0;
      for (i = 0; i < N; i++) { dist[i] = exact[i] = Infinity; next[i] = -1; pos[i] = -1; }
      for (i = 0; i < targets.length; i++) {
        u = targets[i];
        if (u >= 0 && u < N && u === Math.floor(u) && costs[u] > 0 && isFinite(costs[u]) && !(stepFree && stairs && stairs[u]) && exact[u] !== 0) {
          exact[u] = 0; up(u);
        }
      }
      while (count) {
        u = pop(); x = u % W; y = (u / W) | 0;
        // Reverse edges charge entry into u, matching World.exitField.
        d = exact[u] + costs[u];
        for (k = 0; k < 4; k++) {
          if (k === 0) { if (x + 1 >= W) continue; v = u + 1; }
          else if (k === 1) { if (!x) continue; v = u - 1; }
          else if (k === 2) { if (y + 1 >= H) continue; v = u + W; }
          else { if (!y) continue; v = u - W; }
          if (pos[v] === -2 || !(costs[v] > 0) || !isFinite(costs[v]) || (stepFree && stairs && stairs[v])) continue;
          if (d < exact[v]) { exact[v] = d; next[v] = u; up(v); }
        }
      }
      for (i = 0; i < N; i++) dist[i] = exact[i];
      return api;
    }
    var api = { dist: dist, next: next, build: build }; return api;
  }
  function createFieldSet(W, H) {
    var entries = Object.create(null), names = [], normalOpts = {}, freeOpts = { stepFree: true };
    return {
      define: function (name, targets) {
        if (!Object.prototype.hasOwnProperty.call(entries, name)) names.push(name);
        entries[name] = { targets: targets.slice(), normal: create(W, H), free: create(W, H) };
        return this;
      },
      rebuild: function (costs, stairs) {
        normalOpts.stairs = freeOpts.stairs = stairs;
        for (var i = 0; i < names.length; i++) {
          var e = entries[names[i]]; e.normal.build(costs, e.targets, normalOpts); e.free.build(costs, e.targets, freeOpts);
        }
        return this;
      },
      get: function (name, stepFree) { var e = entries[name]; return e ? (stepFree ? e.free : e.normal) : undefined; },
      definition: function () {
        return names.slice().sort().map(function (name) { return [name, entries[name].targets.slice()]; });
      }
    };
  }
  return { create: create, createFieldSet: createFieldSet, FieldSet: { create: createFieldSet } };
}));
