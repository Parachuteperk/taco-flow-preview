(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Crowd = root.TF.Crowd || {}; root.TF.Crowd.Grid = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function create(W, H, bucketTiles, capacity) {
    var size = bucketTiles === undefined ? 8 : bucketTiles;
    if (!(W > 0 && H > 0 && size > 0)) throw new RangeError('Invalid grid dimensions');
    var cols = Math.ceil(W / size), rows = Math.ceil(H / size);
    var head = new Int32Array(cols * rows), next, prev, bucket, xs, ys;
    var cap = 0, i;
    for (i = 0; i < head.length; i++) head[i] = -1;
    function reserve(n) {
      if (n <= cap) return;
      var c = Math.max(n, cap * 2, 64), a = new Int32Array(c), b = new Int32Array(c), d = new Int32Array(c);
      var x = new Float64Array(c), y = new Float64Array(c), j;
      for (j = 0; j < c; j++) { a[j] = -1; b[j] = -1; d[j] = -1; }
      if (cap) { a.set(next); b.set(prev); d.set(bucket); x.set(xs); y.set(ys); }
      next = a; prev = b; bucket = d; xs = x; ys = y; cap = c;
      api.head = head; api.next = next;
    }
    function remove(id) {
      if (id < 0 || id >= cap || bucket[id] < 0) return false;
      var b = bucket[id], p = prev[id], n = next[id];
      if (p < 0) head[b] = n; else next[p] = n;
      if (n >= 0) prev[n] = p;
      bucket[id] = next[id] = prev[id] = -1; return true;
    }
    function insert(id, x, y) {
      if (id < 0 || id !== Math.floor(id) || !isFinite(x) || !isFinite(y) || x < 0 || y < 0 || x >= W || y >= H) throw new RangeError('Invalid grid point');
      reserve(id + 1);
      var b = Math.floor(y / size) * cols + Math.floor(x / size);
      xs[id] = x; ys[id] = y;
      if (bucket[id] === b) return;
      remove(id); var n = head[b]; next[id] = n; prev[id] = -1;
      if (n >= 0) prev[n] = id;
      head[b] = id; bucket[id] = b;
    }
    // Rectangles include both edges. Only the first returned-count entries are valid.
    function queryRect(x0, y0, x1, y1, out) {
      if (x1 < x0 || y1 < y0 || x1 < 0 || y1 < 0 || x0 >= W || y0 >= H) return 0;
      var bx0 = Math.max(0, Math.floor(x0 / size)), by0 = Math.max(0, Math.floor(y0 / size));
      var bx1 = Math.min(cols - 1, Math.floor(x1 / size)), by1 = Math.min(rows - 1, Math.floor(y1 / size));
      var bx, by, id, count = 0;
      for (by = by0; by <= by1; by++) for (bx = bx0; bx <= bx1; bx++) {
        id = head[by * cols + bx];
        while (id >= 0) {
          if (xs[id] >= x0 && xs[id] <= x1 && ys[id] >= y0 && ys[id] <= y1) out[count++] = id;
          id = next[id];
        }
      }
      return count;
    }
    var depthFn = null;
    function compare(a, b) {
      var d = depthFn ? depthFn(a) - depthFn(b) : (xs[a] + ys[a]) - (xs[b] + ys[b]);
      return d || ys[a] - ys[b] || a - b;
    }
    function visibleSorted(x0, y0, x1, y1, out, depthOf) {
      var n = queryRect(x0, y0, x1, y1, out), k, j, id;
      depthFn = depthOf || null;
      // In-place insertion sort touches only visible ids, with no scratch storage.
      for (k = 1; k < n; k++) {
        id = out[k]; j = k - 1;
        while (j >= 0 && compare(out[j], id) > 0) { out[j + 1] = out[j]; j--; }
        out[j + 1] = id;
      }
      depthFn = null; return n;
    }
    var api = { insert: insert, move: insert, remove: remove, queryRect: queryRect, visibleSorted: visibleSorted, reserve: reserve };
    reserve(capacity || 64); return api;
  }
  return { create: create };
}));
