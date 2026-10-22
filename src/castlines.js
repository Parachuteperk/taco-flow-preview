// Campus cast spawn + lines (Pass 6D). Uses Calendar.castFor + data/cast-lines.js.
// Art from TF.CAST (src/data/cast.js). Plugin drawer; no render.js edits.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      (function () { try { return require('../data/cast-lines'); } catch (e) { return null; } })()
    );
  } else { root.TF = root.TF || {}; root.TF.CastLines = factory({ CAST_LINES: root.TF.CAST_LINES, REGULAR_MEMORY: root.TF.REGULAR_MEMORY }); }
}(typeof window !== 'undefined' ? window : this, function (Data) {
  'use strict';
  var CL = { active: [], day: 0, memory: {}, sheets: null };
  var CORE = ['boko', 'maroonfield', 'sage', 'bigorder', 'brendan', 'biggreg'];
  var ALIAS = { bigGreg: 'biggreg', BigGreg: 'biggreg' };
  function canon(id) { return ALIAS[id] || id; }
  function lines() {
    if (Data && Data.CAST_LINES) return Data;
    if (typeof TF !== 'undefined') return { CAST_LINES: TF.CAST_LINES, REGULAR_MEMORY: TF.REGULAR_MEMORY };
    return null;
  }
  CL.coreIds = CORE.slice();
  CL.normalizeId = canon;
  CL.linesFor = function (id) {
    var d = lines(); if (!d || !d.CAST_LINES) return null;
    return d.CAST_LINES[canon(id)] || null;
  };
  CL.memoryLine = function (kind, rng) {
    var d = lines(), bag = d && d.REGULAR_MEMORY && d.REGULAR_MEMORY[kind];
    if (!bag || !bag.length) return '';
    var r = rng && typeof rng.next === 'function' ? rng.next() : Math.random();
    return bag[Math.floor(r * bag.length) % bag.length];
  };
  CL.bark = function (id, rng) {
    var L = CL.linesFor(id); if (!L || !L.barks || !L.barks.length) return '';
    var r = rng && typeof rng.next === 'function' ? rng.next() : Math.random();
    return L.barks[Math.floor(r * L.barks.length) % L.barks.length];
  };
  CL.hasCoreLines = function () {
    return CORE.every(function (id) {
      var L = CL.linesFor(id);
      return !!(L && L.intro && L.barks && L.barks.length >= 1);
    });
  };
  function loadSheets(TF) {
    if (CL.sheets || !TF.Art || !TF.Art.painted() || !TF.CAST || !TF.CAST.chars) return CL.sheets;
    var out = {};
    CORE.forEach(function (id) {
      var meta = TF.CAST.chars[id]; if (!meta) return;
      var sh = TF.Art.sheets[meta.sheet]; if (!sh) return;
      var fr = meta.frames || {};
      function slice(c) { return TF.Art.slice(sh, c, false); }
      out[id] = {
        toward: (fr.toward || []).map(slice),
        away: (fr.away || []).map(slice),
        poses: fr.poses || {},
        h: meta.h || 200,
        drawPx: meta.drawPx || 31
      };
    });
    CL.sheets = out;
    return out;
  }
  CL.spawnForDay = function (TF, day, rng, opts) {
    if (!TF || !TF.Calendar || !TF.Sim) return [];
    opts = opts || {};
    var ids = TF.Calendar.castFor(day, rng || { next: function () { return 0.5; } }, opts)
      .map(canon)
      .filter(function (id) { return CORE.indexOf(id) >= 0; });
    CL.day = day;
    CL.active = [];
    var Sim = TF.Sim, World = TF.World;
    ids.forEach(function (id, i) {
      var ex = World.exits[(i + day) % Math.max(1, World.exits.length)] || World.exits[0];
      if (!ex) return;
      var L = CL.linesFor(id) || {};
      var memKind = null;
      if (CL.memory[id] === 'soldOut') memKind = 'soldOut';
      else if (CL.memory[id] === 'longWait') memKind = 'longWait';
      else if (CL.memory[id] === 'fastService') memKind = 'fastService';
      else if (CL.memory[id] === 'iou') memKind = 'iou';
      var line = memKind ? CL.memoryLine(memKind, rng) : (L.intro || CL.bark(id, rng));
      var actor = {
        id: 'cast:' + id + ':' + day, castId: id, kind: 'cast',
        x: ex.x + 0.5, y: ex.y + 0.5, px: ex.x + 0.5, py: ex.y + 0.5,
        offX: 0, offY: 0, pOffX: 0, pOffY: 0,
        hx: 0, hy: 1, facing: 0, moving: true, anim: 0, speed: 1.35,
        state: 'CAST_WANDER', path: [], budget: 40 + i * 8, gone: false,
        speech: line, speechT: 4.5, barkT: 8 + i * 3
      };
      CL.active.push(actor);
      if (line && Sim.events) Sim.events.push({ type: 'toast', text: line });
    });
    return CL.active.slice();
  };
  CL.remember = function (id, kind) { CL.memory[canon(id)] = kind; };
  CL.resetLevel = function () { CL.active = []; CL.day = 0; };
  CL.step = function (dt) {
    if (typeof TF === 'undefined' || !TF.Sim) return;
    var World = TF.World, Sim = TF.Sim;
    CL.active.forEach(function (a) {
      if (a.gone) return;
      a.px = a.x; a.py = a.y;
      a.anim += dt;
      if (a.speechT > 0) a.speechT -= dt;
      a.barkT -= dt;
      if (a.barkT <= 0) {
        a.barkT = 10 + (a.castId.length % 5);
        a.speech = CL.bark(a.castId); a.speechT = 3.2;
        if (TF.Arcs && a.speech) {
          /* bubbles pushed in items */
        }
      }
      a.budget -= dt * a.speed;
      if (a.budget <= 0) { a.gone = true; return; }
      // Drift along nearby path tiles.
      if (!a.path.length) {
        var tx = Math.floor(a.x), ty = Math.floor(a.y);
        var opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (d) {
          return World.isWalkway(tx + d[0], ty + d[1]) || World.isPath(tx + d[0], ty + d[1]);
        });
        if (opts.length) {
          var pick = opts[Math.floor((a.anim * 7) % opts.length)];
          a.path.push({ x: tx + pick[0] + 0.5, y: ty + pick[1] + 0.5 });
        } else a.budget = 0;
      }
      if (a.path.length) {
        var t = a.path[0], dx = t.x - a.x, dy = t.y - a.y, dist = Math.hypot(dx, dy);
        if (dist < 0.05) { a.path.shift(); a.moving = false; }
        else {
          var step = Math.min(dist, a.speed * dt);
          a.x += dx / dist * step; a.y += dy / dist * step;
          a.hx = dx; a.hy = dy; a.moving = true;
          if (Sim.faceEntity) Sim.faceEntity(a, a.hx, a.hy);
        }
      }
    });
    CL.active = CL.active.filter(function (a) { return !a.gone; });
  };
  var POOL = [];
  for (var i = 0; i < 6; i++) POOL.push({ kind: 'cast', plugin: CL, a: null, x: 0, y: 0, k: 0 });
  CL.items = function (items, alpha, ui) {
    if (ui && (ui.noGuests || ui.onlyPieces || ui.bare)) return;
    loadSheets(typeof TF !== 'undefined' ? TF : null);
    for (var i = 0; i < CL.active.length; i++) {
      var a = CL.active[i], it = POOL[i];
      it.a = a; it.x = a.x; it.y = a.y; it.k = a.x + a.y;
      items.push(it);
      if (a.speech && a.speechT > 0 && typeof TF !== 'undefined' && TF.Arcs && TF.Render) {
        var p = TF.Render.toScreen(a.x, a.y);
        TF.Arcs.bubbles.push({ text: a.speech, x: p.x, y: p.y - 48 * TF.Render.cam.z, bg: 'rgba(80,18,20,0.92)' });
      }
    }
  };
  CL.draw = function (ctx, it, z) {
    var a = it.a, TF = typeof window !== 'undefined' ? window.TF : null;
    if (!a || !TF) return;
    var sheets = loadSheets(TF);
    var set = sheets && sheets[a.castId];
    var p = TF.Render.toScreen(a.x, a.y);
    if (set && set.toward.length) {
      var front = a.facing < 2, mirror = a.facing === 1 || a.facing === 3;
      var row = front ? set.toward : set.away;
      var img = a.moving ? row[Math.floor(a.anim / 0.16) % row.length] : row[0];
      var sc = (set.drawPx || 31) * z / (set.h || 200);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 7 * z, 3 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(p.x, p.y); if (mirror) ctx.scale(-1, 1);
      ctx.drawImage(img, -img.ax * sc, -img.ay * sc, img.width * sc, img.height * sc);
      ctx.restore();
    } else if (TF.Render.drawPerson) {
      TF.Render.drawPerson({ facing: a.facing, moving: a.moving, anim: a.anim, shirt: '#7a1e2c', skin: '#d9a77e', hair: '#3b2a20', pants: '#2d3a5a' }, p.x, p.y, z);
    }
  };
  CL.mountCard = function (host, id) {
    if (!host || !host.ownerDocument) throw new TypeError('Host required');
    var L = CL.linesFor(id); if (!L) throw new Error('Unknown cast ' + id);
    var doc = host.ownerDocument, card = doc.createElement('section');
    card.id = 'castCard';
    card.style.cssText = 'position:fixed;left:50%;top:20%;transform:translateX(-50%);z-index:1050;width:min(360px,calc(100% - 24px));box-sizing:border-box;background:#fff5d6;border:3px solid #501214;border-radius:12px;padding:12px;color:#2a1810;overflow-wrap:anywhere;word-break:break-word';
    var h = doc.createElement('h2'); h.textContent = (id + '').toUpperCase(); h.style.margin = '0 0 6px';
    var p = doc.createElement('p'); p.textContent = L.intro; p.style.cssText = 'margin:0 0 8px;overflow-wrap:anywhere';
    var b = doc.createElement('p'); b.textContent = L.barks[0]; b.style.cssText = 'margin:0;font-weight:700;overflow-wrap:anywhere';
    var x = doc.createElement('button'); x.type = 'button'; x.textContent = 'OK';
    x.style.cssText = 'margin-top:10px;width:100%;min-height:44px';
    x.onclick = function () { card.remove(); };
    card.appendChild(h); card.appendChild(p); card.appendChild(b); card.appendChild(x);
    host.appendChild(card); return { element: card, destroy: function () { card.remove(); } };
  };
  CL.install = function (TF) {
    if (!TF || CL._installed) return CL;
    CL._installed = true;
    TF.plugins.push(CL);
    var stream = null;
    function rng() {
      if (!stream) {
        var seed = (TF.Rng && TF.Rng.seed ? TF.Rng.seed : 7) ^ 0xCA57;
        stream = { s: seed >>> 0, next: function () {
          this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
          return this.s / 4294967296;
        } };
      }
      return stream;
    }
    function onOpen() {
      if (!(TF.Week && TF.Week.active() && TF.Calendar)) return;
      var abs = TF.Econ && typeof TF.Econ.abs === 'function' ? TF.Econ.abs(TF.Week.day) : TF.Week.day;
      if (abs === CL.day && CL.active.length) return;
      CL.spawnForDay(TF, abs, rng());
    }
    var prev = TF.Week && TF.Week.openDay;
    if (typeof prev === 'function') {
      TF.Week.openDay = function () {
        var r = prev.apply(this, arguments);
        try { onOpen(); } catch (e) { /* cast spawn is best-effort */ }
        return r;
      };
    }
    return CL;
  };
  return CL;
}));
