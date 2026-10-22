(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Minimap = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  // World tile enum colors from world.js; no dependency on its browser singleton.
  var colors = ['#638348', '#cbb995', '#355737', '#936c47', '#eadb97', '#bda783', '#507443', '#64565c', '#9e9281', '#adab91', '#54724b', '#717550'];
  function positive(n) { return typeof n === 'number' && isFinite(n) && n > 0; }
  function create(options) {
    var o = options || {}, make = o.createCanvas, hz = o.hz === undefined ? 10 : o.hz;
    if (typeof make !== 'function' || !positive(hz) || hz > 10) throw new RangeError('createCanvas and 0 < hz <= 10 required');
    var cache = new Map(), base = null, level = null, W = 0, H = 0, nextTime = -Infinity;
    var box = { x: 0, y: 0, width: 0, height: 0, collapsed: false };
    var map = { x: 0, y: 0, width: 0, height: 0, scale: 1 };
    var point = { x: 0, y: 0 }, viewport = { x0: 0, y0: 0, x1: 0, y1: 0 };
    var phone = false, initialized = false, pad = 6;
    var previous = { x: 0, y: 0, width: 0, height: 0 };
    function geometry() {
      map.scale = Math.min((box.width - pad * 2) / W, (box.height - pad * 2) / H);
      map.width = W * map.scale; map.height = H * map.scale;
      map.x = box.x + (box.width - map.width) / 2; map.y = box.y + (box.height - map.height) / 2;
      nextTime = -Infinity;
    }
    // Level object: {W,H,tiles,stands?}; call again with new revision after edits.
    // Cache construction/replacement is a level/build-time operation, never per frame.
    function loadLevel(data, revision) {
      if (!data || !Number.isInteger(data.W) || !Number.isInteger(data.H) || data.W <= 0 || data.H <= 0 || !data.tiles || data.tiles.length !== data.W * data.H) throw new RangeError('Invalid minimap level');
      level = data; W = data.W; H = data.H;
      var entry = cache.get(data);
      if (!entry || entry.revision !== revision) {
        var canvas = entry ? entry.canvas : make(W * 4, H * 4);
        canvas.width = W * 4; canvas.height = H * 4;
        var ctx = canvas.getContext('2d'), x, y, i, s;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
          ctx.fillStyle = colors[data.tiles[y * W + x]] || colors[0]; ctx.fillRect(x * 4, y * 4, 4, 4);
        }
        if (data.stands) for (i = 0; i < data.stands.length; i++) {
          s = data.stands[i]; if (s.placed === false) continue;
          ctx.fillStyle = '#ffd65a'; ctx.fillRect(s.sx * 4, s.sy * 4, 8, 8);
        }
        entry = { canvas: canvas, revision: revision }; cache.set(data, entry);
      }
      base = entry.canvas;
      if (initialized) geometry(); nextTime = -Infinity;
      return base;
    }
    // Optional safe insets: reserve HUD/controls before calling. CSS pixel geometry.
    function layout(width, height, insets) {
      if (!positive(width) || !positive(height)) throw new RangeError('Invalid minimap viewport');
      var left = insets ? insets.left || 0 : 0, right = insets ? insets.right || 0 : 0;
      var top = insets ? insets.top || 0 : 0, bottom = insets ? insets.bottom || 0 : 0;
      var availableW = width - left - right - 16, availableH = height - top - bottom - 16;
      if (availableW < 32 || availableH < 32) throw new RangeError('Minimap safe area too small');
      var wasPhone = phone; phone = width < 600;
      if (!initialized || wasPhone !== phone) box.collapsed = phone;
      initialized = true;
      box.width = box.collapsed ? 44 : Math.min(phone ? 144 : 208, availableW, availableH);
      box.height = box.collapsed ? 44 : box.width;
      if (box.collapsed) box.width = box.height = Math.min(44, availableW, availableH);
      box.x = width - right - box.width - 8; box.y = height - bottom - box.height - 8;
      api.width = width; api.height = height; savedInsets.left = left; savedInsets.right = right; savedInsets.top = top; savedInsets.bottom = bottom;
      if (base) geometry(); return box;
    }
    var savedInsets = { left: 0, right: 0, top: 0, bottom: 0 };
    function setCollapsed(value) { box.collapsed = !!value; return layout(api.width, api.height, savedInsets); }
    function toMap(x, y, out) { out = out || point; out.x = map.x + x * map.scale; out.y = map.y + y * map.scale; return out; }
    function toWorld(x, y, out) { out = out || point; out.x = (x - map.x) / map.scale; out.y = (y - map.y) / map.scale; return out; }
    function tap(x, y, camera) {
      if (!base || x < box.x || y < box.y || x >= box.x + box.width || y >= box.y + box.height) return false;
      if (box.collapsed) { setCollapsed(false); return true; }
      // Letterbox padding is consumed but cannot jump outside the map.
      if (x >= map.x && y >= map.y && x < map.x + map.width && y < map.y + map.height) {
        toWorld(x, y, point); camera.snapTo(point.x, point.y);
      }
      return true;
    }
    function dot(ctx, x, y, size, color) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      ctx.fillStyle = color; ctx.fillRect(map.x + x * map.scale - size / 2, map.y + y * map.scale - size / 2, size, size);
    }
    // Density contract: {cols,rows,bucketTiles,counts}; no walker array accepted.
    // draw uses seconds; clear/repaint this dedicated canvas only when true is returned.
    function draw(ctx, now, camera, density, crew, alerts) {
      if (!base || !initialized || now < nextTime) return false;
      nextTime = now + 1 / hz;
      ctx.clearRect(previous.x, previous.y, previous.width, previous.height);
      ctx.clearRect(box.x, box.y, box.width, box.height);
      previous.x = box.x; previous.y = box.y; previous.width = box.width; previous.height = box.height;
      ctx.fillStyle = '#162229'; ctx.fillRect(box.x, box.y, box.width, box.height);
      if (box.collapsed) {
        ctx.fillStyle = '#ffd65a'; ctx.fillRect(box.x + box.width / 4, box.y + box.height / 4, box.width / 2, box.height / 2); return true;
      }
      ctx.drawImage(base, map.x, map.y, map.width, map.height);
      ctx.save(); ctx.beginPath(); ctx.rect(map.x, map.y, map.width, map.height); ctx.clip();
      var i, count, x, y, s;
      if (density) {
        for (i = 0; i < density.cols * density.rows; i++) {
          count = density.counts[i]; if (!count) continue;
          x = Math.min(W, (i % density.cols + 1) * density.bucketTiles);
          y = Math.min(H, (Math.floor(i / density.cols) + 1) * density.bucketTiles);
          x = (i % density.cols * density.bucketTiles + x) / 2;
          y = (Math.floor(i / density.cols) * density.bucketTiles + y) / 2;
          dot(ctx, x, y, Math.min(10, 2 + Math.sqrt(count)), count >= 16 ? '#ff6347' : '#f2aa63');
        }
      }
      if (crew) for (i = 0; i < crew.length; i++) { s = crew[i]; if (s.active !== false) dot(ctx, s.x, s.y, 4, '#75dcff'); }
      if (alerts) for (i = 0; i < alerts.length; i++) { s = alerts[i]; if (s.active !== false) dot(ctx, s.x, s.y, 5, '#ff405e'); }
      camera.visibleRect(0, 0, viewport);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.strokeRect(map.x + viewport.x0 * map.scale, map.y + viewport.y0 * map.scale,
        (viewport.x1 - viewport.x0) * map.scale, (viewport.y1 - viewport.y0) * map.scale);
      // Actual iso viewport is a parallelogram on a north-up tile map.
      ctx.beginPath();
      for (i = 0; i < 4; i++) {
        camera.toWorld(i === 1 || i === 2 ? camera.width : 0, i >= 2 ? camera.height : 0, point);
        x = map.x + point.x * map.scale; y = map.y + point.y * map.scale;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke(); ctx.restore(); return true;
    }
    // Grid's public head/next are linked lists, so aggregation is O(buckets + walkers)
    // at 10 Hz, not one minimap draw per walker. Caller owns/preallocates counts.
    function countGrid(grid, density) {
      if (density.counts.length !== grid.head.length || density.cols * density.rows !== grid.head.length) throw new RangeError('Density/grid dimensions differ');
      var i, id, count;
      for (i = 0; i < grid.head.length; i++) {
        count = 0; id = grid.head[i];
        while (id >= 0) { count++; id = grid.next[id]; }
        density.counts[i] = count;
      }
      return density;
    }
    var api = { box: box, map: map, width: 0, height: 0, loadLevel: loadLevel, layout: layout,
      setCollapsed: setCollapsed, toMap: toMap, toWorld: toWorld, tap: tap, draw: draw, countGrid: countGrid,
      needsRedraw: function (now) { return !!base && initialized && now >= nextTime; },
      invalidate: function () { nextTime = -Infinity; },
      dispose: function () { cache.clear(); base = level = null; } };
    return api;
  }
  return { create: create };
}));
