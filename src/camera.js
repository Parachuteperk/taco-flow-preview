(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Camera = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function positive(n) { return typeof n === 'number' && isFinite(n) && n > 0; }
  function limit(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function create(options) {
    var o = options || {}, W = o.W, H = o.H, vw = o.width, vh = o.height;
    var top = o.viewportTop === undefined ? 0 : o.viewportTop;
    var tw = o.tileWidth === undefined ? 64 : o.tileWidth, th = o.tileHeight === undefined ? 32 : o.tileHeight;
    var levels = o.zoomLevels || [0.5, 1, 2], damping = o.damping === undefined ? 8 : o.damping;
    if (!positive(W) || !positive(H) || !positive(vw) || !positive(vh) || !positive(tw) || !positive(th) || !positive(damping)) throw new RangeError('Invalid camera dimensions/damping');
    if (levels.length !== 3 || !positive(levels[0]) || !(levels[1] > levels[0]) || !(levels[2] > levels[1]) || !positive(levels[2])) throw new RangeError('Three increasing zoom levels required');
    if (typeof top !== 'number' || !isFinite(top) || top < 0 || top >= vh) throw new RangeError('Invalid viewport top');
    // Copy configuration once; all hot-path outputs and pointer slots are pooled.
    levels = [levels[0], levels[1], levels[2]];
    if (o.zoom !== undefined && !positive(o.zoom)) throw new RangeError('Invalid zoom');
    var cam = { x: 0, y: 0, z: limit(o.zoom === undefined ? levels[1] : o.zoom, levels[0], levels[2]) };
    if (!positive(cam.z)) throw new RangeError('Invalid zoom');
    var point = { x: 0, y: 0 }, rect = { x0: 0, y0: 0, x1: W, y1: H };
    var view = { x: 0, y: 0, zoom: cam.z, halfTileW: tw / 2, halfTileH: th / 2 };
    var slots = [{ id: null, x: 0, y: 0, ox: 0, oy: 0, time: 0 }, { id: null, x: 0, y: 0, ox: 0, oy: 0, time: 0 }];
    var vx = 0, vy = 0, target = null, moved = false;
    function toScreen(x, y, h, out) {
      out = out || point;
      out.x = (x - y) * tw / 2 * cam.z + cam.x;
      out.y = (x + y) * th / 2 * cam.z + cam.y - (h || 0) * cam.z;
      return out;
    }
    function toWorld(x, y, out) {
      out = out || point;
      var a = (x - cam.x) / (tw / 2 * cam.z), b = (y - cam.y) / (th / 2 * cam.z);
      out.x = (a + b) / 2; out.y = (b - a) / 2; return out;
    }
    // Projected AABB covers each large axis (small axes center). Additionally the
    // viewport center must lie on the ground diamond: AABB overlap alone can
    // otherwise leave the entire diamond off-screen after a diagonal phone pan.
    function clamp() {
      var hw = tw / 2 * cam.z, hh = th / 2 * cam.z;
      var rx = vw / (2 * hw), ry = (vh - top) / (2 * hh);
      var ax0 = W + H <= 2 * rx ? (W - H) / 2 : -H + rx;
      var ax1 = W + H <= 2 * rx ? ax0 : W - rx;
      var by0 = W + H <= 2 * ry ? (W + H) / 2 : ry;
      var by1 = W + H <= 2 * ry ? by0 : W + H - ry;
      // AABB bounds use the playable center; ground bounds use the full canvas
      // center, matching absolute projection/pointer coordinates. At whole-map
      // zoom a tall HUD can put the preferred map position entirely below that
      // center, so ground bounds take priority over small-axis centering.
      var inset = top / (2 * hh);
      // Stay microscopically inside the diamond so projection roundoff cannot
      // turn a boundary point into a negative world coordinate.
      var edge = Math.min(1, W, H) * 1e-9;
      var ground0 = Math.max(-ax1, ax0) + edge, ground1 = Math.min(2 * W - ax0, 2 * H + ax1) - edge;
      by0 = limit(by0 - inset, ground0, ground1);
      by1 = limit(by1 - inset, ground0, ground1);
      var cy = limit((vh / 2 - cam.y) / hh, by0, by1);
      var cx = limit((vw / 2 - cam.x) / hw, Math.max(ax0, -cy + edge, cy - 2 * H + edge), Math.min(ax1, 2 * W - cy - edge, cy - edge));
      var x = vw / 2 - cx * hw, y = vh / 2 - cy * hh;
      if (Math.abs(x - cam.x) > 1e-8) vx = 0;
      if (Math.abs(y - cam.y) > 1e-8) vy = 0;
      cam.x = x; cam.y = y;
      return cam;
    }
    function stop() { vx = vy = 0; target = null; }
    function snapTo(x, y) {
      stop(); cam.x = vw / 2 - (x - y) * tw / 2 * cam.z;
      cam.y = (vh + top) / 2 - (x + y) * th / 2 * cam.z; return clamp();
    }
    function zoomAt(z, x, y) {
      if (!positive(z)) throw new RangeError('Invalid zoom');
      if (x === undefined) { x = vw / 2; y = (vh + top) / 2; }
      toWorld(x, y, point); var wx = point.x, wy = point.y;
      stop(); cam.z = limit(z, levels[0], levels[2]);
      cam.x = x - (wx - wy) * tw / 2 * cam.z;
      cam.y = y - (wx + wy) * th / 2 * cam.z;
      return clamp(); // Bounds take priority over pointer invariance at map edges.
    }
    function wheel(delta, x, y) {
      if (!delta) return cam;
      var i;
      if (delta < 0) { for (i = 0; i < 2 && levels[i] <= cam.z + 1e-9; i++); }
      else { for (i = 2; i > 0 && levels[i] >= cam.z - 1e-9; i--); }
      return zoomAt(levels[i], x, y);
    }
    function resize(width, height) {
      if (!positive(width) || !positive(height)) throw new RangeError('Invalid viewport');
      toWorld(vw / 2, (vh + top) / 2, point); var x = point.x, y = point.y;
      vw = width; vh = height; top = Math.min(top, vh - 1); api.width = vw; api.height = vh;
      cancel(); return snapTo(x, y);
    }
    // Keep the same map focus as a wrapping/scrolling HUD changes the playable area.
    // Screen coordinates stay absolute for pointer input and renderer projection.
    function setViewportTop(y) {
      if (typeof y !== 'number' || !isFinite(y) || y < 0 || y >= vh) throw new RangeError('Invalid viewport top');
      if (y === top) return cam;
      cam.y += (y - top) / 2; top = y;
      return clamp();
    }
    function setLevel(w, h, x, y) {
      if (!positive(w) || !positive(h)) throw new RangeError('Invalid map');
      W = w; H = h; api.W = W; api.H = H; cancel();
      return snapTo(x === undefined ? W / 2 : x, y === undefined ? H / 2 : y);
    }
    // Conservative inverse-projected viewport AABB, inclusive edges for Grid.queryRect.
    // paddingPx includes sprite overhang; paddingTiles includes motion/interpolation.
    function visibleRect(paddingPx, paddingTiles, out) {
      var p = paddingPx || 0, t = paddingTiles || 0;
      out = out || rect;
      var a0 = (-p - cam.x) / (tw / 2 * cam.z), a1 = (vw + p - cam.x) / (tw / 2 * cam.z);
      var b0 = (-p - cam.y) / (th / 2 * cam.z), b1 = (vh + p - cam.y) / (th / 2 * cam.z);
      out.x0 = limit((a0 + b0) / 2 - t, 0, W); out.x1 = limit((a1 + b1) / 2 + t, 0, W);
      out.y0 = limit((b0 - a1) / 2 - t, 0, H); out.y1 = limit((b1 - a0) / 2 + t, 0, H);
      return out;
    }
    function renderView() { view.x = cam.x; view.y = cam.y; view.zoom = cam.z; return view; }
    function update(dt) {
      if (!(dt > 0) || !isFinite(dt)) return cam;
      if (target) {
        var f = 1 - Math.exp(-10 * dt);
        cam.x += (vw / 2 - (target.x - target.y) * tw / 2 * cam.z - cam.x) * f;
        cam.y += ((vh + top) / 2 - (target.x + target.y) * th / 2 * cam.z - cam.y) * f;
      } else if (slots[0].id === null && slots[1].id === null) {
        var decay = Math.exp(-damping * dt), distance = (1 - decay) / damping;
        cam.x += vx * distance; cam.y += vy * distance; vx *= decay; vy *= decay;
        if (Math.abs(vx) < 0.01) vx = 0;
        if (Math.abs(vy) < 0.01) vy = 0;
      }
      return clamp();
    }
    function cancel() { slots[0].id = slots[1].id = null; moved = false; stop(); }
    function pointerDown(id, x, y, time) {
      if (slots[0].id === id || slots[1].id === id) return false;
      var s = slots[0].id === null ? slots[0] : slots[1].id === null ? slots[1] : null;
      if (!s) return false;
      if (slots[0].id === null && slots[1].id === null) moved = false;
      else moved = true; // A pinch is never a placement tap.
      stop(); s.id = id; s.x = s.ox = x; s.y = s.oy = y; s.time = time; return true;
    }
    function pointerMove(id, x, y, time) {
      var a = slots[0], b = slots[1], s = a.id === id ? a : b.id === id ? b : null;
      if (!s) return false;
      if (a.id !== null && b.id !== null) {
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y);
        toWorld(mx, my, point); var wx = point.x, wy = point.y;
        s.x = x; s.y = y; s.time = time;
        cam.z = limit(cam.z * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, d), levels[0], levels[2]);
        cam.x = (a.x + b.x) / 2 - (wx - wy) * tw / 2 * cam.z;
        cam.y = (a.y + b.y) / 2 - (wx + wy) * th / 2 * cam.z;
        clamp(); return true;
      }
      if (!moved && Math.hypot(x - s.ox, y - s.oy) > 8) moved = true;
      var dx = x - s.x, dy = y - s.y, dt = (time - s.time) / 1000;
      if (moved) {
        cam.x += dx; cam.y += dy;
        vx = dt > 0 && dt < 0.15 ? dx / dt : 0; vy = dt > 0 && dt < 0.15 ? dy / dt : 0;
        clamp();
      }
      s.x = x; s.y = y; s.time = time; return moved;
    }
    function pointerUp(id, time, cancelled) {
      var s = slots[0].id === id ? slots[0] : slots[1].id === id ? slots[1] : null;
      if (!s) return false;
      var consumed = moved;
      if (cancelled || time - s.time > 100) vx = vy = 0;
      s.id = null;
      var other = slots[0].id !== null ? slots[0] : slots[1].id !== null ? slots[1] : null;
      if (other) { other.ox = other.x; other.oy = other.y; vx = vy = 0; }
      return consumed;
    }
    var api = { cam: cam, width: vw, height: vh, get viewportTop() { return top; }, W: W, H: H, toScreen: toScreen, toWorld: toWorld,
      setViewportTop: setViewportTop, clamp: clamp, snapTo: snapTo, centerOn: snapTo, zoomAt: zoomAt, wheel: wheel, resize: resize, setLevel: setLevel,
      visibleRect: visibleRect, renderView: renderView, update: update, stop: stop, cancel: cancel,
      zoomBucket: function () { return cam.z < Math.sqrt(levels[0] * levels[1]) ? 0 : cam.z < Math.sqrt(levels[1] * levels[2]) ? 1 : 2; },
      follow: function (t) { stop(); target = t; }, pointerDown: pointerDown, pointerMove: pointerMove, pointerUp: pointerUp };
    snapTo(o.targetX === undefined ? W / 2 : o.targetX, o.targetY === undefined ? H / 2 : o.targetY);
    return api;
  }
  return { create: create };
}));
