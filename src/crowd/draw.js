(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Crowd = root.TF.Crowd || {}; root.TF.Crowd.Draw = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var TAU = Math.PI * 2;
  function canvas(w, h) {
    var c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
    c.width = w; c.height = h; return c;
  }
  // Load-time only. Each look: {height, frames:[{image,x,y,w,h,ax,ay,key?}]}.
  // Already-keyed TF.ArtPeople.cust canvases can be supplied as {image: cropCanvas}.
  // Mirroring is baked too: draw() never needs save/scale/restore.
  function buildAtlas(looks, opts) {
    opts = opts || {};
    var make = opts.createCanvas || canvas, width = opts.width || 2048;
    var jobs = [], result = [], x = 1, y = 1, row = 0;
    function pack(image, ax, ay, dw, dh) {
      if (image.width + 2 > width) throw new RangeError('Frame wider than atlas');
      if (x + image.width + 1 > width) { x = 1; y += row + 2; row = 0; }
      var f = { sheet: null, sx: x, sy: y, sw: image.width, sh: image.height,
        ax: ax, ay: ay, width: dw, height: dh };
      jobs.push({ image: image, frame: f }); x += image.width + 2; row = Math.max(row, image.height); return f;
    }
    function bake(src) {
      var im = src.image, w = src.w === undefined ? im.width : src.w, h = src.h === undefined ? im.height : src.h;
      var c = make(w, h), ctx = c.getContext('2d');
      ctx.drawImage(im, src.x || 0, src.y || 0, w, h, 0, 0, w, h);
      var pixels = ctx.getImageData(0, 0, w, h), d = pixels.data, i, r, g, b;
      // Match Art.slice: flood border-connected moderate magenta, then key
      // strong enclosed pockets. All scratch buffers are load-time only.
      var keyed, stack, pixel, px, py;
      if (src.key !== false) {
        keyed = new Uint8Array(w * h); stack = [];
        for (i = 0; i < w; i++) stack.push(i, (h - 1) * w + i);
        for (i = 0; i < h; i++) stack.push(i * w, i * w + w - 1);
        while (stack.length) {
          pixel = stack.pop();
          if (keyed[pixel] || Math.min(d[pixel * 4], d[pixel * 4 + 2]) - d[pixel * 4 + 1] < 40) continue;
          keyed[pixel] = 1; px = pixel % w; py = Math.floor(pixel / w);
          if (px > 0) stack.push(pixel - 1);
          if (px < w - 1) stack.push(pixel + 1);
          if (py > 0) stack.push(pixel - w);
          if (py < h - 1) stack.push(pixel + w);
        }
      }
      if (src.key !== false) for (i = 0; i < d.length; i += 4) {
        r = d[i]; g = d[i + 1]; b = d[i + 2];
        var m = Math.min(r, b) - g;
        if (keyed[i / 4] || m > 90) d[i + 3] = 0;
        else if (m > 20) {
          d[i] = Math.max(0, r - (m - 20)); d[i + 2] = Math.max(0, b - (m - 20));
          if (m > 45) d[i + 3] = Math.min(d[i + 3], 150);
        }
      }
      ctx.putImageData(pixels, 0, 0);
      return c;
    }
    looks.forEach(function (look) {
      if (!look.frames || !look.frames.length) throw new RangeError('Look needs frames');
      var frames = [], mirrored = [], height = look.height || look.frames[0].h || look.frames[0].image.height;
      var scale = (opts.personHeight || 30) / height;
      look.frames.forEach(function (src) {
        var c = bake(src), ax = src.ax === undefined ? c.width / 2 : src.ax, ay = src.ay === undefined ? c.height : src.ay;
        frames.push(pack(c, ax * scale, ay * scale, c.width * scale, c.height * scale));
        var flipped = make(c.width, c.height), fc = flipped.getContext('2d');
        fc.translate(c.width, 0); fc.scale(-1, 1); fc.drawImage(c, 0, 0);
        mirrored.push(pack(flipped, (c.width - ax) * scale, ay * scale, c.width * scale, c.height * scale));
      });
      // One tiny, single-colour alpha silhouette per look, sampled once from its first frame.
      var first = jobs[jobs.length - frames.length * 2].image, low = make(6, 10), lc = low.getContext('2d');
      lc.imageSmoothingEnabled = false; lc.drawImage(first, 0, 0, 6, 10);
      var p = lc.getImageData(0, 0, 6, 10), color = look.lowColor || [65, 57, 68];
      for (var i = 0; i < p.data.length; i += 4) { p.data[i] = color[0]; p.data[i + 1] = color[1]; p.data[i + 2] = color[2]; p.data[i + 3] = p.data[i + 3] >= 128 ? 255 : 0; }
      lc.putImageData(p, 0, 0);
      var f = frames[0], lowFrame = pack(low, f.ax, f.ay, f.width, f.height);
      var lowMirror = make(6, 10), mc = lowMirror.getContext('2d');
      mc.translate(6, 0); mc.scale(-1, 1); mc.drawImage(low, 0, 0);
      var lowMirrored = pack(lowMirror, f.width - f.ax, f.ay, f.width, f.height);
      result.push({ frames: frames, mirrored: mirrored, low: lowFrame, lowMirrored: lowMirrored });
    });
    var atlas = make(width, y + row + 1), ac = atlas.getContext('2d');
    jobs.forEach(function (job) { job.frame.sheet = atlas; ac.drawImage(job.image, job.frame.sx, job.frame.sy); });
    return { sheet: atlas, looks: result };
  }
  // Fixed capacity: entries/batches/ids retain identity and length for the renderer's lifetime.
  // rect is tile-space {x0,y0,x1,y1}; view is {x,y,zoom,halfTileW,halfTileH}.
  // motionPadding must bound |current - previous| per axis when interpolating at camera edges.
  function create(looks, capacity, opts) {
    opts = opts || {}; capacity = capacity === undefined ? 350 : capacity;
    var pad = opts.motionPadding === undefined ? 0 : opts.motionPadding, sorted = opts.sort !== false;   // sort:false = the caller's scene sorts (6B B1)
    if (!Number.isFinite(pad) || pad < 0) throw new RangeError('Invalid motion padding');
    if (!Number.isInteger(capacity) || capacity < 1 || !looks.length) throw new RangeError('Invalid draw capacity/looks');
    var entries = new Array(capacity), batches = new Array(capacity), ids = new Int32Array(capacity), i;
    for (i = 0; i < capacity; i++) { entries[i] = {}; batches[i] = {}; }
    var list = { entries: entries, batches: batches, count: 0, batchCount: 0, capacity: capacity };
    function build(sim, rect, lods, alpha, time, view) {
      if (sim.walkers.length > capacity) throw new RangeError('Draw capacity smaller than sim capacity');
      var n = sim.grid.queryRect(rect.x0 - pad, rect.y0 - pad, rect.x1 + pad, rect.y1 + pad, ids);
      var a = Math.max(0, Math.min(1, alpha)), count = 0, j, w, e, f, look, frame, level, phase, wx, wy;
      var zoom = view.zoom, hw = view.halfTileW, hh = view.halfTileH;
      for (i = 0; i < n; i++) {
        w = sim.walkers[ids[i]]; if (!w || !w.active) continue;
        wx = w.prevX + (w.x - w.prevX) * a; wy = w.prevY + (w.y - w.prevY) * a;
        if (wx < rect.x0 || wx > rect.x1 || wy < rect.y0 || wy > rect.y1) continue;
        look = looks[w.look === undefined ? 0 : w.look];
        if (!look) throw new RangeError('Unknown walker look');
        level = lods[w.id]; frame = 0;
        if (level === 2) f = w.mirror && look.lowMirrored ? look.lowMirrored : look.low;
        else {
          var frames = w.mirror && look.mirrored ? look.mirrored : look.frames;
          // Phase is radians; time is seconds. FULL advances at 20 Hz, HALF at 10 Hz.
          phase = Math.floor(time * (level === 1 ? 10 : 20) + (w.phase || 0) / TAU * (level === 1 ? 2 : frames.length));
          frame = ((phase % (level === 1 ? 2 : frames.length)) + (level === 1 ? 2 : frames.length)) % (level === 1 ? 2 : frames.length);
          if (level === 1) frame = frame ? Math.floor(frames.length / 2) : 0;
          f = frames[frame];
        }
        e = entries[count++]; e.id = w.id; e.depth = wx + wy; e.worldY = wy; e.frame = frame; e.lod = level; e.sheet = f.sheet;
        e.sx = f.sx; e.sy = f.sy; e.sw = f.sw; e.sh = f.sh;
        e.dx = (wx - wy) * hw * zoom + view.x - f.ax * zoom;
        e.dy = (wx + wy) * hh * zoom + view.y - f.ay * zoom;
        e.dw = f.width * zoom; e.dh = f.height * zoom;
      }
      // Stable deterministic painter order at the interpolated foot point, after culling.
      list.count = count;
      if (!sorted) { list.batchCount = 0; return list; }
      for (i = 1; i < count; i++) {
        e = entries[i]; j = i - 1;
        while (j >= 0 && (entries[j].depth > e.depth || (entries[j].depth === e.depth &&
          (entries[j].worldY > e.worldY || (entries[j].worldY === e.worldY && entries[j].id > e.id))))) {
          entries[j + 1] = entries[j]; j--;
        }
        entries[j + 1] = e;
      }
      list.count = count; list.batchCount = 0;
      for (i = 0; i < count; i++) {
        if (!i || entries[i].sheet !== entries[i - 1].sheet) {
          var batch = batches[list.batchCount++]; batch.sheet = entries[i].sheet; batch.start = i; batch.count = 0;
        }
        batches[list.batchCount - 1].count++;
      }
      return list;
    }
    return { build: build, list: list };
  }
  // Canvas2D has no multi-sprite draw call: batches share a sheet while retaining painter order.
  // Optional range lets the scene interleave crowd entries with props/crew/stand pieces.
  function draw(ctx, list, start, count) {
    start = start === undefined ? 0 : start;
    var stop = count === undefined ? list.count : Math.min(list.count, start + count);
    for (var b = 0; b < list.batchCount; b++) {
      var batch = list.batches[b];
      for (var i = Math.max(start, batch.start), end = Math.min(stop, batch.start + batch.count); i < end; i++) {
        var e = list.entries[i]; ctx.drawImage(batch.sheet, e.sx, e.sy, e.sw, e.sh, e.dx, e.dy, e.dw, e.dh);
      }
    }
  }
  return { create: create, buildAtlas: buildAtlas, draw: draw };
}));
