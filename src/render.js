// Canvas renderer. RCT-style: Gemini sprites when loaded (TF.Art), placeholder shapes otherwise.
// The sim never touches the canvas; everything is drawn from sim state here.
(function (TF) {
  var C = TF.C, World = TF.World, Sim = TF.Sim, T = TF.World.T;
  var R = { cam: { x: 0, y: 0, z: 1 }, vw: 0, vh: 0, dpr: 1, groundDirty: true };
  var ctx = null, mainCtx = null;

  R.setContext = function (c) { ctx = mainCtx = c; };

  // World (tile units) -> screen (CSS px). h lifts the point vertically in px at zoom 1.
  R.toScreen = function (wx, wy, h) {
    var z = R.cam.z;
    return { x: (wx - wy) * (C.TW / 2) * z + R.cam.x, y: (wx + wy) * (C.TH / 2) * z + R.cam.y - (h || 0) * z };
  };
  R.toWorld = function (sx, sy) {
    var z = R.cam.z, a = (sx - R.cam.x) / ((C.TW / 2) * z), b = (sy - R.cam.y) / ((C.TH / 2) * z);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  };
  R.centerOn = function (wx, wy) {
    R.cam.x = 0; R.cam.y = 0;
    var p = R.toScreen(wx, wy);
    R.cam.x = R.vw / 2 - p.x; R.cam.y = R.vh / 2 - p.y;
  };

  function poly(pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  R.poly = function (pts, fill, stroke, lw) { poly(pts, fill, stroke, lw); };
  function diamond(tx, ty) {
    return [R.toScreen(tx, ty), R.toScreen(tx + 1, ty), R.toScreen(tx + 1, ty + 1), R.toScreen(tx, ty + 1)];
  }
  function shadeHex(base, amt) {
    var n = parseInt(base.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.min(255, Math.round(r * amt)) + ',' + Math.min(255, Math.round(g * amt)) + ',' + Math.min(255, Math.round(b * amt)) + ')';
  }
  function text(str, x, y, size, color, stroke) {
    ctx.font = 'bold ' + Math.round(size) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  R.text = function (str, x, y, size, color, stroke) { text(str, x, y, size, color, stroke); };
  // A label on a solid rounded-ish plate (readable over trees and crowds).
  function pill(str, x, y, size, bg) {
    ctx.font = 'bold ' + Math.round(size) + 'px system-ui, sans-serif';
    var w = ctx.measureText(str).width + size * 1.2, h = size * 1.7;
    ctx.fillStyle = bg; ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    text(str, x, y, size, '#fff');
  }

  // ---- Ground ------------------------------------------------------------
  var PAINT_KEY = {};
  PAINT_KEY[T.GRASS] = 'grass'; PAINT_KEY[T.PATH] = 'concrete'; PAINT_KEY[T.PLAZA] = 'brick';
  PAINT_KEY[T.PLANTER] = 'flowers'; PAINT_KEY[T.TREE] = 'grass'; PAINT_KEY[T.BENCH] = 'grass'; PAINT_KEY[T.LAMP] = 'grass';

  // Ground under props: plaza-side lamps stand on brick, everything else on grass.
  function quadKey(t, tx, ty) {
    if (t === T.PATH) return 'qlime';
    if (t === T.PLAZA) return 'qbrick';
    if ((t === T.LAMP || t === T.PLANTER) && World.nearWalk(tx, ty, 0) === false && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return World.get(tx + d[0], ty + d[1]) === T.PLAZA; })) return 'qbrick';
    return 'qgrass';
  }

  R.drawTile = function (tx, ty) {
    var t = World.get(tx, ty), d = diamond(tx, ty), s = World.shade[ty * World.W + tx], z = R.cam.z;
    var qk = quadKey(t, tx, ty);
    if (TF.Art.has(qk)) {
      // Seamless quad tiles (one world scale: 254 sheet px = 1 tile), clipped to the diamond and
      // drawn 3% oversized so neighbours overlap without hairline seams.
      var qi = TF.Art.img[qk], qs = C.TW * z / qi.dw * 1.03;
      var qcx = (d[0].x + d[2].x) / 2, qcy = (d[0].y + d[2].y) / 2;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(d[0].x, d[0].y - 0.6); ctx.lineTo(d[1].x + 0.6, d[1].y); ctx.lineTo(d[2].x, d[2].y + 0.6); ctx.lineTo(d[3].x - 0.6, d[3].y); ctx.closePath();
      ctx.clip();
      ctx.drawImage(qi, qcx - qi.width * qs / 2, qcy - qi.dcy * qs, qi.width * qs, qi.height * qs);
      ctx.restore();
      return;
    }
    var key = PAINT_KEY[t];
    if (TF.Art.has(key)) {
      // Clip to the diamond and draw the painted tile slightly oversized so its dark border
      // falls outside the clip: no visible grid lines.
      var img = TF.Art.img[key], sc = C.TW * z / TF.Art.tileSrcW * 1.1;
      var cx = (d[0].x + d[2].x) / 2, cy = (d[0].y + d[2].y) / 2;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(d[0].x, d[0].y - 0.6); ctx.lineTo(d[1].x + 0.6, d[1].y); ctx.lineTo(d[2].x, d[2].y + 0.6); ctx.lineTo(d[3].x - 0.6, d[3].y); ctx.closePath();
      ctx.clip();
      // The painted diamond's centre sits ~62 px below the crop top (246 x 123 diamond).
      ctx.drawImage(img, cx - img.width * sc / 2, cy - 61.5 * sc, img.width * sc, img.height * sc);
      ctx.restore();
      return;
    }
    if (t === T.PATH) {
      poly(d, shadeHex('#e6d9b5', 0.97 + s * 0.05));
      ctx.strokeStyle = 'rgba(150,130,90,0.45)'; ctx.lineWidth = Math.max(1, z * 0.8);
      var edges = [[0, -1, 0, 1], [1, 0, 1, 2], [0, 1, 2, 3], [-1, 0, 3, 0]];
      for (var i = 0; i < 4; i++) {
        var nt = World.get(tx + edges[i][0], ty + edges[i][1]);
        if (nt === T.PATH || nt === T.PLAZA || nt === -1) continue;
        ctx.beginPath(); ctx.moveTo(d[edges[i][2]].x, d[edges[i][2]].y); ctx.lineTo(d[edges[i][3]].x, d[edges[i][3]].y); ctx.stroke();
      }
    } else if (t === T.PLAZA) {
      poly(d, shadeHex('#b9573f', 0.95 + s * 0.08));
      ctx.strokeStyle = 'rgba(90,30,20,0.35)'; ctx.lineWidth = Math.max(0.6, z * 0.6);
      for (var k = 1; k < 4; k++) {
        var a = R.toScreen(tx + k / 4, ty), b = R.toScreen(tx + k / 4, ty + 1);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    } else if (t === T.PLANTER) {
      poly(d, '#8c3b2a');
      poly([R.toScreen(tx + 0.12, ty + 0.12), R.toScreen(tx + 0.88, ty + 0.12), R.toScreen(tx + 0.88, ty + 0.88), R.toScreen(tx + 0.12, ty + 0.88)], '#4a6b2a');
      var cols = ['#e04545', '#f2d24b', '#f7f2e8', '#c84fa0'];
      for (var f = 0; f < 14; f++) {
        var p = R.toScreen(tx + 0.18 + ((f * 37) % 64) / 100, ty + 0.18 + ((f * 53) % 64) / 100);
        ctx.fillStyle = cols[f % 4]; ctx.fillRect(p.x - z, p.y - z, 2 * z, 2 * z);
      }
    } else {
      poly(d, shadeHex('#5f9e45', ((tx + ty) & 1 ? 1.0 : 0.96) * (0.95 + s * 0.08)));
    }
  };

  // The static ground is drawn once into an offscreen canvas and blitted each frame.
  var ground = { cv: null, ox: 0, oy: 0, key: '' };
  // Built once at a fixed 2x resolution (independent of zoom), so zooming never rebuilds it.
  var GROUND_F = 2;
  function buildGround() {
    var F = GROUND_F;
    var w = (World.W + World.H) * (C.TW / 2) * F + 4, h = (World.W + World.H) * (C.TH / 2) * F + 4;
    if (!ground.cv) ground.cv = document.createElement('canvas');
    ground.cv.width = Math.ceil(w); ground.cv.height = Math.ceil(h);
    var g = ground.cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    var saved = { x: R.cam.x, y: R.cam.y, z: R.cam.z };
    ground.ox = World.H * (C.TW / 2) * F + 2; ground.oy = 2;
    R.cam.x = ground.ox; R.cam.y = ground.oy; R.cam.z = F;
    ctx = g;
    for (var ty = 0; ty < World.H; ty++) for (var tx = 0; tx < World.W; tx++) R.drawTile(tx, ty);
    ctx = mainCtx;
    R.cam.x = saved.x; R.cam.y = saved.y; R.cam.z = saved.z;
    ground.key = TF.Art.mode;
    R.groundDirty = false;
  }

  // ---- Props -------------------------------------------------------------
  var PROP_ART = {};
  PROP_ART[T.TREE] = 'oak'; PROP_ART[T.PLANTER] = 'planter'; PROP_ART[T.LAMP] = 'lamp'; PROP_ART[T.BENCH] = 'bench';
  // Screen-space box (CSS px, relative to the foot) of each prop sprite, for fading/overlap tests.
  R.propBox = function (kind, z) {
    var im = TF.Art.has(PROP_ART[kind]) ? TF.Art.img[PROP_ART[kind]] : null, sc = C.TW * z / (TF.Art.quadTileW || 254);
    if (im) return { l: -im.ax * sc, r: (im.width - im.ax) * sc, t: -im.ay * sc, b: (im.height - im.ay) * sc };
    if (kind === T.TREE) return { l: -24 * z, r: 24 * z, t: -50 * z, b: 4 * z };
    if (kind === T.LAMP) return { l: -4 * z, r: 4 * z, t: -40 * z, b: 2 * z };
    return { l: -16 * z, r: 16 * z, t: -16 * z, b: 6 * z };
  };

  R.drawProp = function (kind, tx, ty, alpha) {
    var z = R.cam.z, p = R.toScreen(tx + 0.5, ty + 0.5), s = World.shade[ty * World.W + tx];
    var art = PROP_ART[kind];
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (TF.Art.has(art)) {
      var im = TF.Art.img[art], sc = C.TW * z / (TF.Art.quadTileW || 254);
      // The planter is a 1 x 1/2 tile box: its bottom corner sits on the tile's bottom-middle.
      if (kind === T.PLANTER) p = R.toScreen(tx + 0.75, ty + 1);
      if (kind === T.TREE) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 24 * z, 10 * z, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.drawImage(im, p.x - im.ax * sc, p.y - im.ay * sc, im.width * sc, im.height * sc);
      ctx.globalAlpha = 1;
      return;
    }
    if (kind === T.PLANTER) { ctx.globalAlpha = 1; return; }   // placeholder planters are drawn as ground
    if (kind === T.TREE) {   // live oak: short trunk, broad low canopy
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 22 * z, 10 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5e4630'; ctx.fillRect(p.x - 3 * z, p.y - 18 * z, 6 * z, 18 * z);
      ctx.strokeStyle = '#5e4630'; ctx.lineWidth = 3 * z;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 14 * z); ctx.lineTo(p.x - 11 * z, p.y - 24 * z); ctx.moveTo(p.x, p.y - 15 * z); ctx.lineTo(p.x + 12 * z, p.y - 25 * z); ctx.stroke();
      var base = shadeHex('#3b6a2c', 0.9 + s * 0.2), hi = shadeHex('#4f8a37', 0.9 + s * 0.2);
      [[-13, -27, 11], [12, -28, 11], [0, -32, 13], [-5, -36, 9], [7, -37, 8]].forEach(function (b, i) {
        ctx.fillStyle = i < 3 ? base : hi;
        ctx.beginPath(); ctx.ellipse(p.x + b[0] * z, p.y + b[1] * z, b[2] * z * 1.3, b[2] * z * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      });
    } else if (kind === T.BENCH) {
      var a = R.toScreen(tx + 0.2, ty + 0.5, 6), b = R.toScreen(tx + 0.8, ty + 0.5, 6);
      ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 1.5 * z;
      [0.25, 0.75].forEach(function (u) {
        var f = R.toScreen(tx + u, ty + 0.5); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x, f.y - 6 * z); ctx.stroke();
      });
      ctx.strokeStyle = '#8a5a32'; ctx.lineWidth = 4 * z;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.lineWidth = 2.5 * z;
      ctx.beginPath(); ctx.moveTo(a.x + 2 * z, a.y - 7 * z); ctx.lineTo(b.x + 2 * z, b.y - 7 * z); ctx.stroke();
    } else if (kind === T.LAMP) {
      ctx.fillStyle = '#22222a'; ctx.fillRect(p.x - 1.3 * z, p.y - 32 * z, 2.6 * z, 32 * z);
      ctx.fillRect(p.x - 3 * z, p.y - 3 * z, 6 * z, 3 * z);
      ctx.fillStyle = '#f6e7a1'; ctx.fillRect(p.x - 3 * z, p.y - 39 * z, 6 * z, 7 * z);
      ctx.fillStyle = '#22222a'; ctx.fillRect(p.x - 3.5 * z, p.y - 40 * z, 7 * z, 1.5 * z);
    }
    ctx.globalAlpha = 1;
  };

  // ---- Old Main (past the top-right edge, entrance facing the quad) ---------
  var OM = { x0: 9, x1: 19, y0: -5, y1: 0 };
  var OM_STAIRS = { x: 13.5, y: 0.1 };
  R.OM_STAIRS = OM_STAIRS;
  R.drawOldMain = function () {
    var z = R.cam.z;
    if (TF.Art.has('oldmain')) {
      var im = TF.Art.img.oldmain, w = TF.Art.whole.oldmain;
      var sc = (OM.x1 - OM.x0) * (C.TW / 2) * z / w.longW;
      // Pin the foot of the front stairs (art px 665,485) to the end of the main walk (x = 13).
      var a = R.toScreen(OM_STAIRS.x, OM_STAIRS.y);
      ctx.save(); ctx.translate(a.x, a.y); ctx.scale(-1, 1);   // mirrored: entrance faces the quad
      ctx.drawImage(im, -665 * sc, -485 * sc, im.width * sc, im.height * sc);
      ctx.restore();
      return;
    }
    var H = 110;
    function P(x, y, h) { return R.toScreen(x, y, h); }
    poly([P(OM.x0, OM.y1, 0), P(OM.x1, OM.y1, 0), P(OM.x1, OM.y1, H), P(OM.x0, OM.y1, H)], '#c47a52');
    poly([P(OM.x1, OM.y1, 0), P(OM.x1, OM.y0, 0), P(OM.x1, OM.y0, H), P(OM.x1, OM.y1, H)], '#9a5a3c');
    poly([P(OM.x0, OM.y0, H), P(OM.x1, OM.y0, H), P(OM.x1, OM.y1, H), P(OM.x0, OM.y1, H)], '#b5473e');
    for (var i = 0; i < 9; i++) for (var j = 0; j < 3; j++) {
      var u = OM.x0 + 0.6 + i * 1.05;
      poly([P(u, OM.y1, 20 + j * 30), P(u + 0.4, OM.y1, 20 + j * 30), P(u + 0.4, OM.y1, 38 + j * 30), P(u, OM.y1, 38 + j * 30)], '#2c3e50');
    }
    var lab = P(14, OM.y1, H + 20);
    text('OLD MAIN', lab.x, lab.y, 11 * z, '#fff5d6', 'rgba(0,0,0,0.6)');
  };

  // ---- Stand: pieces on the 2x2 footprint, one per tier ------------------
  // Tier 0 folding table + cooler, 1 grill, 2 banner, 3 serving counter, 4 canopy. Each piece is
  // its own depth-sorted item at a foot point in the stand's local frame (a: toward the pickup
  // side, b: toward the order side, from the footprint centre).
  var PIECE = {   // target size in screen px at zoom 1 (one world scale for every piece)
    table: { a: -0.35, b: 0.6, w: 60 }, tablecooler: { a: -0.35, b: 0.6, w: 60 }, cooler: { a: -1.0, b: 0.25, w: 24 },
    grill: { a: 0.5, b: 0.55, w: 30 }, banner: { a: -1.15, b: -0.4, h: 64 },
    counter: { a: 0.75, b: -0.45, w: 46 }, canopy: { w: 140 }
  };
  R.standPieces = function (sx, sy, rot, tier, away, st) {
    st = st || Sim.stand;
    var g = World.standGeom(sx, sy, rot), out = [];
    function at(name, extra) {
      var d = PIECE[name], x = g.cx + g.np[0] * d.a + g.n[0] * d.b, y = g.cy + g.np[1] * d.a + g.n[1] * d.b;
      out.push({ kind: 'piece', piece: name, x: x, y: y, k: x + y, geom: g, mirror: extra, st: st });
    }
    at(away ? 'table' : 'tablecooler', g.n[1] !== 0);
    if (TF.Crew && TF.Crew.extras.cooler2 && tier === 0 && st.idx === 0) at('cooler', g.n[1] !== 0);   // the second cooler
    if (tier >= 1) at('grill', false);
    if (tier >= 2) at('banner', g.n[1] !== 0);
    if (tier >= 3) at('counter', g.np[1] !== 0);
    // The canopy is drawn behind everything at the stand so the crew under it stay visible.
    if (tier >= 4) out.unshift({ kind: 'piece', piece: 'canopy', x: sx + 2, y: sy + 2, k: sx + sy + 0.2, geom: g, st: st });
    return out;
  };

  R.drawPiece = function (it, ghost) {
    var z = R.cam.z, p = R.toScreen(it.x, it.y), d = PIECE[it.piece];
    if (ghost) ctx.globalAlpha = 0.6;
    if (TF.Art.has(it.piece)) {
      var im = TF.Art.img[it.piece], sc = (d.w ? d.w / im.width : d.h / im.height) * z;
      if (it.piece === 'tablecooler' || it.piece === 'table') sc = d.w * z / TF.Art.img.tablecooler.width;
      ctx.save(); ctx.translate(p.x, p.y); if (it.mirror) ctx.scale(-1, 1);
      ctx.drawImage(im, -im.ax * sc, -im.ay * sc, im.width * sc, im.height * sc);
      ctx.restore();
    } else placeholderPiece(it, p, z);
    if (!ghost && it.piece === 'grill') {
      drawSteam(p, it.st);
      if (it.st === Sim.stand && TF.Events && TF.Events.grillStalled && TF.Events.grillStalled()) {
        var tt = performance.now() / 1000;
        for (var sp = 0; sp < 4; sp++) {
          var kk = (tt * 0.8 + sp * 0.25) % 1;
          ctx.fillStyle = 'rgba(80,80,80,' + (0.55 * (1 - kk)).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(p.x + (sp - 1.5) * 5 * z, p.y - 28 * z - kk * 26 * z, (4 + kk * 8) * z, 0, Math.PI * 2); ctx.fill();
        }
        var pul = 1 + 0.12 * Math.sin(tt * 9);
        ctx.fillStyle = '#ff8a1a'; ctx.fillRect(p.x - 38 * z * pul, p.y - 50 * z, 76 * z * pul, 16 * z);
        text('\u26A0 GRILL STALLED', p.x, p.y - 42 * z, 10 * z * pul, '#fff');
      }
    }
    if (!ghost && (it.piece === 'tablecooler' || it.piece === 'table')) drawStock(p, z, it.st);
    if (!ghost && it.piece === 'banner') { var b = R.toScreen(it.x, it.y, 40); text('TACOS', b.x, b.y, 9 * z, '#ffd23a', 'rgba(80,10,20,0.9)'); }
    ctx.globalAlpha = 1;
  };

  function placeholderPiece(it, p, z) {
    var g = it.geom, P = function (a, b, h) { return R.toScreen(it.x + g.np[0] * a + g.n[0] * b, it.y + g.np[1] * a + g.n[1] * b, h); };
    if (it.piece === 'table' || it.piece === 'tablecooler') {
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5 * z;
      [[-0.45, 0], [0.45, 0]].forEach(function (q) { var a = P(q[0], q[1], 0), b2 = P(q[0], q[1], 12); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.stroke(); });
      poly([P(-0.55, -0.18, 12), P(0.55, -0.18, 12), P(0.55, 0.18, 12), P(-0.55, 0.18, 12)], '#eef0f2', '#666', 1);
      if (it.piece === 'tablecooler') {
        poly([P(0.62, 0.05, 0), P(0.95, 0.05, 0), P(0.95, 0.05, 10), P(0.62, 0.05, 10)], '#c62f2f');
        poly([P(0.62, -0.2, 10), P(0.95, -0.2, 10), P(0.95, 0.05, 10), P(0.62, 0.05, 10)], '#f4f4f4');
      }
    } else if (it.piece === 'grill') {
      ctx.fillStyle = '#222'; ctx.fillRect(p.x - 10 * z, p.y - 16 * z, 20 * z, 7 * z);
      ctx.fillRect(p.x - 9 * z, p.y - 9 * z, 2 * z, 9 * z); ctx.fillRect(p.x + 7 * z, p.y - 9 * z, 2 * z, 9 * z);
    } else if (it.piece === 'banner') {
      var a1 = P(0, -0.3, 0), a2 = P(0, 0.3, 0);
      ctx.fillStyle = '#333'; ctx.fillRect(a1.x - z, a1.y - 64 * z, 2 * z, 64 * z); ctx.fillRect(a2.x - z, a2.y - 64 * z, 2 * z, 64 * z);
      poly([P(0, -0.3, 60), P(0, 0.3, 60), P(0, 0.3, 22), P(0, -0.3, 22)], '#7a1e2c', '#d9a62a', 2 * z);
    } else if (it.piece === 'counter') {
      poly([P(-0.1, 0.4, 0), P(-0.1, -0.4, 0), P(-0.1, -0.4, 16), P(-0.1, 0.4, 16)], '#8a6a44');
      poly([P(-0.3, 0.4, 16), P(-0.1, 0.4, 16), P(-0.1, -0.4, 16), P(-0.3, -0.4, 16)], '#b08a5a');
    } else if (it.piece === 'canopy') {
      var sx = (it.st || Sim.stand).sx, sy = (it.st || Sim.stand).sy;
      if (it.geom) { sx = it.geom.sx; sy = it.geom.sy; }
      ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5 * z;
      [[0, 0], [2, 0], [2, 2], [0, 2]].forEach(function (c) { var a = R.toScreen(sx + c[0], sy + c[1]), b2 = R.toScreen(sx + c[0], sy + c[1], 50); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.stroke(); });
      var top = R.toScreen(sx + 1, sy + 1, 74);
      var cs = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]].map(function (c) { return R.toScreen(sx + c[0], sy + c[1], 50); });
      for (var i = 0; i < 4; i++) poly([top, cs[i], cs[i + 1]], i % 2 ? '#d9a62a' : '#7a1e2c');
    }
  }

  function drawStock(p, z, st) {
    st = st || Sim.stand;
    if (!st.placed) return;
    var max = st.mods.stockMax, f = Math.max(0, st.stock) / max, y = p.y - 34 * z;
    var w = 26 * z;
    ctx.fillStyle = 'rgba(30,20,10,0.75)'; ctx.fillRect(p.x - w / 2 - z, y - z, w + 2 * z, 5 * z);
    ctx.fillStyle = f > 0.25 ? '#6cd06c' : f > 0 ? '#f0b030' : '#e04040';
    ctx.fillRect(p.x - w / 2, y, w * f, 3 * z);
    var label = st.trip ? 'RESTOCKING' : st.stock <= 0 ? 'SOLD OUT' : st.tier === 0 ? st.stock + '/' + max + ' tacos' : '';
    if (label) text(label, p.x, y - 6 * z, 7 * z, '#fff5d6', 'rgba(60,30,20,0.85)');
  }

  function drawSteam(p0, st) {
    var n = (st || Sim.stand).cook.grill.length, z = R.cam.z;
    for (var i = 0; i < n; i++) {
      var k = (Sim.t * 1.3 + i * 0.5) % 1;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - k)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p0.x + (i * 6 - 3) * z, p0.y - 30 * z - k * 12 * z, (2 + k * 3) * z, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---- Queue line + stand ground markings ------------------------------
  function ropeEdge(ax, ay, bx, by) {
    var z = R.cam.z, a = R.toScreen(ax, ay), b = R.toScreen(bx, by);
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.6 * z;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y - 8 * z); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y - 8 * z); ctx.stroke();
    ctx.strokeStyle = '#8a1e2c'; ctx.lineWidth = 1.4 * z;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 7 * z);
    ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 3 * z, b.x, b.y - 7 * z); ctx.stroke();
  }

  R.drawLine = function (st) {
    st = st || Sim.stand;
    var z = R.cam.z;
    if (!st.placed) return;
    var L = st.line, geom = st.geom;
    // pickup mats
    geom.pickup.forEach(function (p) {
      poly([R.toScreen(p[0] + 0.08, p[1] + 0.08), R.toScreen(p[0] + 0.92, p[1] + 0.08), R.toScreen(p[0] + 0.92, p[1] + 0.92), R.toScreen(p[0] + 0.08, p[1] + 0.92)], 'rgba(201,162,39,0.35)');
    });
    var pm = R.toScreen((geom.pickup[0][0] + geom.pickup[1][0]) / 2 + 0.5 + geom.np[0] * 0.45, (geom.pickup[0][1] + geom.pickup[1][1]) / 2 + 0.5 + geom.np[1] * 0.45);
    text('PICKUP', pm.x, pm.y, Math.max(7, 7 * z), 'rgba(60,30,20,0.8)');
    if (!L.length) poly(diamond(geom.order[0], geom.order[1]), 'rgba(255,220,90,0.35)', 'rgba(200,150,20,0.9)', 1.2);
    for (var i = 0; i < L.length; i++) {
      var t = L[i], prev = i ? L[i - 1] : { x: geom.order[0] - geom.n[0], y: geom.order[1] - geom.n[1] };
      var next = L[i + 1] || (i === L.length - 1 && st.link ? st.link : null);
      poly(diamond(t.x, t.y), 'rgba(214,196,150,0.95)', 'rgba(120,95,60,0.6)', 0.8);
      // ropes on every edge that isn't the way in or the way out
      [[0, -1, t.x, t.y, t.x + 1, t.y], [1, 0, t.x + 1, t.y, t.x + 1, t.y + 1], [0, 1, t.x, t.y + 1, t.x + 1, t.y + 1], [-1, 0, t.x, t.y, t.x, t.y + 1]].forEach(function (e) {
        var nx = t.x + e[0], ny = t.y + e[1];
        if ((prev.x === nx && prev.y === ny) || (next && next.x === nx && next.y === ny)) return;
        ropeEdge(e[2], e[3], e[4], e[5]);
      });
      // arrow pointing toward the window
      var dx = prev.x - t.x, dy = prev.y - t.y, cx = t.x + 0.5, cy = t.y + 0.5;
      var c = R.toScreen(cx + dx * 0.15, cy + dy * 0.15);
      var l = R.toScreen(cx - dx * 0.12 + dy * 0.14, cy - dy * 0.12 - dx * 0.14), r = R.toScreen(cx - dx * 0.12 - dy * 0.14, cy - dy * 0.12 + dx * 0.14);
      ctx.strokeStyle = 'rgba(122,30,44,0.75)'; ctx.lineWidth = 2 * z; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(c.x, c.y); ctx.lineTo(r.x, r.y); ctx.stroke();
    }
  };

  // In-world hints drawn over everything: no line yet / line not connected / queue entry.
  R.drawLineHints = function (ui, st) {
    st = st || Sim.stand;
    var z = R.cam.z;
    if (st === Sim.selected()) R.lastLineHint = !st.placed ? 'none' : !st.line.length ? 'noline' : st.connected ? 'connected' : 'disconnected';
    if (!st.placed || ui.placing) return;
    if (Sim.stands.length > 1) {   // which stand is which
      var tg = R.toScreen(st.sx + 1, st.sy + 1, 78);
      text('Stand ' + (st.idx + 1) + (st === Sim.selected() && (ui.building) ? ' \u270E' : ''), tg.x, tg.y, 9 * z, '#fff5d6', st === Sim.selected() ? 'rgba(122,30,44,0.95)' : 'rgba(60,30,20,0.7)');
    }
    // One bottleneck label per stand, and one grouped warning instead of a bubble per balk.
    var neck = TF.bottleneckOf(st);
    if (neck && neck !== 'SLOW KITCHEN' && !(neck === 'NO STOCK' && st.stock <= 0)) {
      var nk = R.toScreen(st.sx + 1, st.sy + 1, 96), np = 1 + 0.06 * Math.sin(performance.now() / 180);
      ctx.font = 'bold ' + Math.round(10 * z) + 'px system-ui, sans-serif';
      var nw = ctx.measureText('\u26A0 ' + neck).width + 12 * z;
      ctx.fillStyle = '#ff8a1a'; ctx.fillRect(nk.x - nw / 2 * np, nk.y - 8 * z, nw * np, 16 * z);
      text('\u26A0 ' + neck, nk.x, nk.y, 10 * z * np, '#fff');
      R.lastNeck = neck;
    }
    var nb = Sim.recentBalks(st, 'longline');
    if (nb >= 2 && st.poly.length) {
      var ent = st.poly[st.poly.length - 1], ep = R.toScreen(ent.x, ent.y, 34);
      text('\u26A0 ' + nb + ' walked away: line too long', ep.x, ep.y, 9 * z, '#fff', 'rgba(150,20,20,0.9)');
      R.lastGroupedBalk = nb;
    }
    if (st.stock <= 0) {   // SOLD OUT sign at the window
      var so = R.toScreen(st.geom.order[0] + 0.5, st.geom.order[1] + 0.5, 46), pz = 1 + 0.08 * Math.sin(performance.now() / 150);
      ctx.fillStyle = '#c62f2f'; ctx.fillRect(so.x - 34 * z * pz, so.y - 9 * z * pz, 68 * z * pz, 18 * z * pz);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * z; ctx.strokeRect(so.x - 34 * z * pz, so.y - 9 * z * pz, 68 * z * pz, 18 * z * pz);
      text('SOLD OUT', so.x, so.y, 11 * z * pz, '#fff');
    }
    var L = st.line;
    if (!L.length) {
      var o = R.toScreen(st.geom.order[0] + 0.5, st.geom.order[1] + 0.5, 20);
      text('ORDER — build a queue line from here', o.x, o.y, 10 * z, '#fff5d6', 'rgba(60,30,20,0.85)');
      return;
    }
    var end = L[L.length - 1];
    if (!st.connected) {
      var p = R.toScreen(end.x + 0.5, end.y + 0.5), bob = Math.sin(performance.now() / 250) * 2 * z;
      ctx.fillStyle = '#d62f2f';
      ctx.fillRect(p.x - 1.5 * z, p.y - 22 * z, 3 * z, 22 * z);
      ctx.beginPath(); ctx.arc(p.x, p.y - 26 * z + bob, 7 * z, 0, Math.PI * 2); ctx.fill();
      text('!', p.x, p.y - 26 * z + bob, 11 * z, '#fff');
      text('Line not connected to a path', p.x, p.y - 42 * z, 11 * z, '#fff', 'rgba(150,20,20,0.9)');
    } else {
      var e = st.poly[st.poly.length - 1], q = R.toScreen(e.x, e.y);
      // Skip the label when the entry is tucked behind the stand (it would sit on the roof).
      var behind = e.x < st.sx + 2.3 && e.y < st.sy + 2.3 && e.x > st.sx - 1.3 && e.y > st.sy - 1.3;
      if (!behind) text('QUEUE \u25B6', q.x, q.y - 12 * z, 8 * z, '#fff5d6', 'rgba(40,90,40,0.85)');
    }
  };

  R.drawZone = function (wx, wy, r, alpha, color) {
    var c = R.toScreen(wx, wy), z = R.cam.z, k = r * Math.SQRT2;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, k * (C.TW / 2) * z, k * (C.TH / 2) * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = color.replace('A', (alpha * 0.35).toFixed(3)); ctx.fill();
    ctx.strokeStyle = color.replace('A', alpha.toFixed(3));
    ctx.setLineDash([6 * z, 5 * z]); ctx.lineWidth = 1.5 * z; ctx.stroke(); ctx.setLineDash([]);
  };

  // ---- Guests ------------------------------------------------------------
  function drawTaco(x, y, z) {
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath(); ctx.arc(x, y, 4.2 * z, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#b98422'; ctx.lineWidth = 0.9 * z; ctx.stroke();
    ctx.fillStyle = '#4caf50'; ctx.fillRect(x - 3.4 * z, y - 1.6 * z, 6.8 * z, 1.4 * z);
    ctx.fillStyle = '#d6402c';
    ctx.fillRect(x - 2 * z, y - 2.4 * z, 1.4 * z, 1.2 * z); ctx.fillRect(x + 0.8 * z, y - 2.2 * z, 1.4 * z, 1.2 * z);
  }
  R.drawTaco = function (c, x, y, z) { var keep = ctx; ctx = c; drawTaco(x, y, z); ctx = keep; };

  // Placeholder RCT-style person: 4 facings, 4-frame walk cycle by distance.
  R.drawPerson = function (g, sx, sy, z) {
    var front = g.facing < 2, sd = (g.facing === 0 || g.facing === 3) ? 1 : -1;
    var fdx = sd * 0.89, fdy = front ? 0.45 : -0.45;
    var frame = g.moving ? Math.floor(g.anim / 0.16) % 4 : -1;
    z = z * (g.tall || 1);
    var stride = frame < 0 ? 0 : [1, 0, -1, 0][frame] * 2.6 * z;
    var liftL = frame === 3 ? 1.4 * z : 0, liftR = frame === 1 ? 1.4 * z : 0;
    var bob = frame === 1 || frame === 3 ? -0.7 * z : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 5.5 * z, 2.6 * z, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round'; ctx.strokeStyle = g.pants; ctx.lineWidth = 2.4 * z;
    var hipY = sy - 9 * z + bob;
    [{ hx: sx - 1.8 * z, s: stride, lift: liftL }, { hx: sx + 1.8 * z, s: -stride, lift: liftR }].forEach(function (l) {
      ctx.beginPath(); ctx.moveTo(l.hx, hipY); ctx.lineTo(l.hx + fdx * l.s, sy - 0.8 * z + fdy * l.s - l.lift); ctx.stroke();
    });
    function arm(side, isTaco) {
      var shx = sx + side * 4.2 * z, shy = sy - 17 * z + bob;
      var swing = isTaco ? 0 : (side === -1 ? -stride : stride) * 0.9;
      var hx = isTaco ? shx + fdx * 3 * z : shx + fdx * swing;
      var hy = isTaco ? shy + 5 * z + fdy * 3 * z : shy + 7.5 * z + fdy * swing;
      ctx.strokeStyle = g.shirt; ctx.lineWidth = 2.2 * z;
      ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = g.skin; ctx.beginPath(); ctx.arc(hx, hy, 1.3 * z, 0, Math.PI * 2); ctx.fill();
      if (isTaco) drawTaco(hx + fdx * 1.5 * z, hy - 0.5 * z, z);
    }
    if (!front && g.hasTaco) arm(sd, true);
    if (g.backpack && front) { ctx.fillStyle = g.pack; ctx.fillRect(sx - sd * 5.5 * z, sy - 18.5 * z + bob, 3 * z, 8 * z); }
    ctx.fillStyle = g.shirt;
    var tw = 8.5 * z, top = sy - 19.5 * z + bob;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(sx - tw / 2, top, tw, 11 * z, 2.5 * z); else ctx.rect(sx - tw / 2, top, tw, 11 * z);
    ctx.fill();
    if (g.backpack && !front) { ctx.fillStyle = g.pack; ctx.fillRect(sx - 3.5 * z, sy - 18.5 * z + bob, 7 * z, 8.5 * z); }
    arm(-sd, false);
    if (front || !g.hasTaco) arm(sd, front && g.hasTaco);
    var hy2 = sy - 24 * z + bob;
    ctx.fillStyle = g.skin;
    ctx.beginPath(); ctx.arc(sx, hy2, 4.6 * z, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = g.hair;
    ctx.beginPath();
    if (front) ctx.arc(sx, hy2 - 0.6 * z, 4.8 * z, Math.PI * 1.05, Math.PI * 1.95);
    else ctx.arc(sx, hy2 - 0.2 * z, 4.8 * z, Math.PI * 0.85, Math.PI * 2.15);
    ctx.fill();
    if (g.longHair) ctx.fillRect(sx - 4.6 * z, hy2 - 1 * z, 9.2 * z, (front ? 3 : 7) * z);
    if (g.cap) { ctx.fillStyle = '#7a1e2c'; ctx.fillRect(sx - 4.8 * z, hy2 - 5.2 * z, 9.6 * z, 2.6 * z); ctx.fillRect(sx + (sd > 0 ? 2 : -6.5) * z, hy2 - 3.4 * z, 4.5 * z, 1.4 * z); }
    if (front) {
      ctx.fillStyle = '#222';
      ctx.fillRect(sx + sd * 1.3 * z - 1.9 * z, hy2 - 0.4 * z, 1.1 * z, 1.3 * z);
      ctx.fillRect(sx + sd * 1.3 * z + 0.9 * z, hy2 - 0.4 * z, 1.1 * z, 1.3 * z);
    }
  };

  R.drawGuest = function (g, sx, sy, alpha) {
    var z = R.cam.z;
    ctx.globalAlpha = alpha;
    if (!(TF.ArtPeople && TF.Art.painted() && TF.ArtPeople.drawGuest(ctx, g, sx, sy, z))) R.drawPerson(g, sx, sy, z);
    drawGuestOverlay(g, sx, sy, z);
    ctx.globalAlpha = 1;
  };

  // Status icons over a guest's head (shared by both art modes).
  function drawGuestOverlay(g, sx, sy, z) {
    if (g.state === 'WAIT_PICKUP' && !g.hasTaco && g.order) {
      var ry = sy - 38 * z, rr = 4.5 * z, prog = g.order.ready ? 1 : g.order.progress;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(sx, ry, rr + 1.5 * z, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = g.order.ready ? '#e0a020' : '#3a9d4a'; ctx.lineWidth = 2.2 * z; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(sx, ry, rr - 0.6 * z, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, prog)); ctx.stroke();
    } else if (g.state === 'WAIT_PICKUP' && g.hasTaco) {
      text('✓', sx, sy - 36 * z, 10 * z, '#3a9d4a');
    } else if (g.thought === 'where') {
      ctx.font = 'bold ' + Math.round(8 * z) + 'px system-ui, sans-serif';
      var ww = ctx.measureText('Where\u2019s my taco?').width + 8 * z;
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(sx - ww / 2, sy - 46 * z, ww, 11 * z);
      text('Where\u2019s my taco?', sx, sy - 40.5 * z, 8 * z, '#b8283a');
    } else if (g.thought) {
      thoughtBubble(g.thought, sx, sy - 40 * z, z);
    } else if (g.emote) {
      var label = g.emote === 'full' ? 'FULL' : g.emote === 'noline' ? 'NO LINE?' : 'BYE';
      var w = (label.length * 4.5 + 6) * z;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(sx - w / 2, sy - 42 * z, w, 10 * z);
      text(label, sx, sy - 37 * z, 7 * z, '#b8283a');
    }
  }

  // RCT-style thought bubble: white cloud with a small icon.
  var THOUGHT = {
    longline: { icon: '\u2261', color: '#b8283a' },   // line too long
    tasty: { icon: '\u2665', color: '#e0406a' },      // tasty!
    pricey: { icon: '$', color: '#c47a00' },           // too pricey
    slow: { icon: '\u231B', color: '#5a5a7a' }        // waiting too long
  };
  function thoughtBubble(type, x, y, z) {
    var t = THOUGHT[type];
    if (!t) return;
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(60,40,30,0.6)'; ctx.lineWidth = 1 * z;
    ctx.beginPath(); ctx.ellipse(x, y, 7.5 * z, 6.5 * z, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 3 * z, y + 8 * z, 1.6 * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    text(t.icon, x, y + 0.5 * z, 9 * z, t.color);
    if (type === 'pricey' || type === 'longline') { ctx.strokeStyle = t.color; ctx.lineWidth = 1.2 * z; ctx.beginPath(); ctx.moveTo(x - 5 * z, y + 4 * z); ctx.lineTo(x + 5 * z, y - 4 * z); ctx.stroke(); }
  }

  // RCT-style see-through: a tree / lamp / bench / planter drawn in front of the stand or a crew
  // member and overlapping them on screen is faded, so it never hides the stand or the crew.
  R.propFade = 0.22;
  function fadeProps(items, z) {
    var shields = [];
    Sim.stands.forEach(function (st) {
      if (!st.placed) return;
      var c = [R.toScreen(st.sx, st.sy), R.toScreen(st.sx + 2, st.sy), R.toScreen(st.sx + 2, st.sy + 2), R.toScreen(st.sx, st.sy + 2)];
      shields.push({ l: Math.min(c[0].x, c[3].x) - 6 * z, r: Math.max(c[1].x, c[2].x) + 6 * z, t: c[0].y - 95 * z, b: c[2].y, k: st.sx + st.sy + 0.2 });
    });
    items.forEach(function (it) {
      if (it.kind !== 'crew') return;
      var p = R.toScreen(it.x, it.y);
      shields.push({ l: p.x - 12 * z, r: p.x + 12 * z, t: p.y - 36 * z, b: p.y + 2 * z, k: it.k });
    });
    if (!shields.length) return;
    items.forEach(function (it) {
      if (it.kind !== 'prop') return;
      var p = R.toScreen(it.x, it.y), b = R.propBox(it.t, z);
      var l = p.x + b.l, r = p.x + b.r, t = p.y + b.t, bt = p.y + b.b;
      for (var i = 0; i < shields.length; i++) {
        var s = shields[i];
        if (it.k > s.k && l < s.r && r > s.l && t < s.b && bt > s.t) { it.fade = R.propFade; return; }
      }
    });
  }

  // ---- Frame -------------------------------------------------------------
  // ui: placing/building/ghost/hover from main.js. Test-only flags (overdraw check): bare (no
  // ground or overlays, transparent), noPieces, noGuests, onlyCrew (draw just that crew member).
  R.draw = function (alpha, ui) {
    var z = R.cam.z, bare = ui.bare;
    ctx.setTransform(R.dpr || 1, 0, 0, R.dpr || 1, 0, 0);
    if (bare) ctx.clearRect(0, 0, R.vw, R.vh);
    else {
      ctx.fillStyle = '#3d6b31';
      ctx.fillRect(0, 0, R.vw, R.vh);
      if (R.groundDirty || ground.key !== TF.Art.mode) buildGround();
      var gs0 = z / GROUND_F;
      ctx.drawImage(ground.cv, R.cam.x - ground.ox * gs0, R.cam.y - ground.oy * gs0, ground.cv.width * gs0, ground.cv.height * gs0);
      R.drawOldMain();
    }

    var st = Sim.stand, ghost = ui.ghost, late = [];   // late: labels drawn over the props
    if (!bare) Sim.stands.forEach(function (s2) {
      if (s2.placed && !(ghost && ui.placing && s2 === Sim.selected())) R.drawZone(s2.geom.cx, s2.geom.cy, s2.mods.zoneR, 0.14, 'rgba(255,240,180,A)');
      R.drawLine(s2);
    });
    if (!bare && TF.Onboard) TF.Onboard.drawWorld(z);
    if (ghost && ui.placing) {
      var col = ghost.ok ? 'rgba(40,200,80,A)' : 'rgba(230,50,50,A)', gg = World.standGeom(ghost.sx, ghost.sy, ghost.rot);
      // Location tint (item 7): the draw zone shows how much foot traffic this spot gets.
      var LOC = { GOOD: 'rgba(40,200,80,A)', OKAY: 'rgba(240,200,40,A)', SLOW: 'rgba(240,120,40,A)' };
      R.drawZone(gg.cx, gg.cy, Sim.selected().mods.zoneR, 0.5, ghost.loc ? LOC[ghost.loc.grade] : col);
      if (ghost.loc) {
        var lp = R.toScreen(gg.cx, gg.cy, 70);
        var lmsg = ghost.loc.grade + (ghost.loc.grade === 'GOOD' ? ' spot: busy footpaths' : ghost.loc.grade === 'OKAY' ? ' spot: some foot traffic' : ' spot: quiet corner'), lbg = LOC[ghost.loc.grade].replace('A', '0.92');
        late.push(function () { pill(lmsg, lp.x, lp.y, 11 * z, lbg); });
        R.lastLocGrade = ghost.loc.grade;
      }
      gg.tiles.forEach(function (t) { if (World.inside(t[0], t[1])) poly(diamond(t[0], t[1]), col.replace('A', '0.45'), col.replace('A', '0.9'), 1); });
      poly(diamond(gg.order[0], gg.order[1]), 'rgba(255,220,90,0.45)', 'rgba(200,150,20,0.95)', 1.5);
      gg.pickup.forEach(function (t) { poly(diamond(t[0], t[1]), 'rgba(201,162,39,0.3)', 'rgba(201,162,39,0.9)', 1); });
      if (!ghost.ok && ghost.bad) {   // the tile that makes it invalid, with how to fix it
        var pb = 0.5 + 0.35 * Math.sin(performance.now() / 120);
        poly(diamond(ghost.bad[0], ghost.bad[1]), 'rgba(230,30,30,' + pb.toFixed(2) + ')', '#ff2b2b', 2.5);
        var bp = R.toScreen(ghost.bad[0] + 0.5, ghost.bad[1] + 0.5, 30);
        text(ghost.fix, bp.x, bp.y, 10 * z, '#fff', 'rgba(150,20,20,0.92)');
      }
    }
    // Line preview while building (item 7): capacity, crossing, pickup lane.
    var bst = Sim.selected();
    if (ui.building && bst.placed && bst.info) {
      bst.info.crossings.forEach(function (t) { poly(diamond(t.x, t.y), 'rgba(255,138,26,0.35)', '#ff8a1a', 2); });
      var inf = bst.info, pv = R.toScreen(bst.geom.cx, bst.geom.cy, 120);
      var msg = 'Capacity ' + inf.cap + ' / path blocked: ' + (inf.blocked ? 'YES' : 'no') + ' / pickup clear: ' + (inf.pickupClear ? 'yes' : 'NO');
      late.push(function () { pill(msg, pv.x, pv.y, 10 * z, inf.blocked || !inf.pickupClear ? 'rgba(180,70,10,0.95)' : 'rgba(30,110,50,0.95)'); });
      R.lastLinePreview = msg;
    }
    if (ui.building && ui.hover && World.inside(ui.hover.x, ui.hover.y)) {
      var hcol = ui.hover.del ? 'rgba(240,150,40,A)' : ui.hover.ok ? 'rgba(40,200,80,A)' : 'rgba(230,50,50,A)';
      poly(diamond(ui.hover.x, ui.hover.y), hcol.replace('A', '0.4'), hcol.replace('A', '0.95'), 1.5);
    }

    // Depth-sorted objects by foot point; near the stand, its 2x2 footprint decides front/behind.
    var items = [], tx, ty, only = ui.onlyCrew;
    if (!only) for (ty = 0; ty < World.H; ty++) for (tx = 0; tx < World.W; tx++) {
      var t = World.get(tx, ty);
      if (t !== T.TREE && t !== T.BENCH && t !== T.LAMP && t !== T.PLANTER) continue;
      if (ui.noProps) continue;
      var pp = R.toScreen(tx + 0.5, ty + 0.5);
      if (pp.x < -60 || pp.x > R.vw + 60 || pp.y < -20 || pp.y > R.vh + 90) continue;   // cull
      items.push({ k: tx + ty + 1, kind: 'prop', t: t, x: tx + 0.5, y: ty + 0.5 });
    }
    if (!ui.noPieces && !only) Sim.stands.forEach(function (s2) {
      if (s2.placed && !(ghost && ui.placing && s2 === Sim.selected())) R.standPieces(s2.sx, s2.sy, s2.rot, s2.tier, !!s2.trip, s2).forEach(function (it) { items.push(it); });
    });
    if (ghost && ui.placing) R.standPieces(ghost.sx, ghost.sy, ghost.rot, Sim.selected().tier, false, Sim.selected()).forEach(function (it) { it.ghost = true; items.push(it); });
    var gs = (ui.noGuests || only) ? [] : Sim.guests;
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      var wx = g.px + (g.x - g.px) * alpha + g.pOffX + (g.offX - g.pOffX) * alpha;
      var wy = g.py + (g.y - g.py) * alpha + g.pOffY + (g.offY - g.pOffY) * alpha;
      items.push({ k: wx + wy, kind: 'guest', g: g, x: wx, y: wy });
    }
    R.lastAlpha = alpha;
    if (TF.Crew) TF.Crew.items(items);
    if (TF.Events && !ui.noGuests && !only) TF.Events.items(items, alpha);
    if (TF.Ambient && !ui.noGuests && !only) TF.Ambient.items(items, alpha);
    if (TF.Supply && !only && !ui.onlyPieces) TF.Supply.items(items, alpha);
    if (only) items = items.filter(function (it) { return it.kind === 'crew' && it.id === only; });
    if (ui.onlyPieces) items = items.filter(function (it) { return it.kind === 'piece' && !it.ghost; });
    fadeProps(items, z);
    items.sort(function (a, b) { return a.k - b.k; });
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      if (it.kind === 'prop') R.drawProp(it.t, it.x - 0.5, it.y - 0.5, it.fade);
      else if (it.kind === 'piece') R.drawPiece(it, it.ghost);
      else if (it.kind === 'crew') TF.Crew.draw(ctx, it, z);
      else if (it.kind === 'event') TF.Events.draw(ctx, it, z);
      else if (it.kind === 'ambient') TF.Ambient.draw(ctx, it, z);
      else if (it.kind === 'supply') TF.Supply.draw(ctx, it, z);
      else {
        var p = R.toScreen(it.x, it.y);
        if (p.x < -40 || p.x > R.vw + 40 || p.y < -60 || p.y > R.vh + 40) continue;
        var out = Math.max(Math.max(-it.x, it.x - World.W), Math.max(-it.y, it.y - World.H), 0);
        R.drawGuest(it.g, p.x, p.y, Math.max(0, 1 - out * 1.6));
      }
    }

    if (bare) return;
    Sim.stands.forEach(function (s2) { R.drawLineHints(ui, s2); });
    late.forEach(function (f) { f(); });
    // Tortillas in flight: a quick arc from the cannon to the pickup spot.
    Sim.flyers.forEach(function (f) {
      var k = f.t / f.T, wx = f.x0 + (f.x1 - f.x0) * k, wy = f.y0 + (f.y1 - f.y0) * k;
      var p = R.toScreen(wx, wy, 18 + Math.sin(k * Math.PI) * 45), spin = k * 12;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(spin);
      drawTaco(0, 0, z * 1.1);
      ctx.restore();
    });
    Sim.floaters.forEach(function (f) {
      var p = R.toScreen(f.x, f.y, 34 + f.t * 30), a = Math.max(0, 1 - f.t / 1.3);
      ctx.globalAlpha = a;
      text(f.text, p.x, p.y, 14 * z, '#9dff7a', 'rgba(30,60,20,0.9)');
      ctx.globalAlpha = 1;
    });
  };

  // Render the current frame offscreen with test flags and return its pixels (overdraw check).
  var snap = null;
  R.snapshot = function (ui) {
    if (!snap) snap = document.createElement('canvas');
    snap.width = mainCtx.canvas.width; snap.height = mainCtx.canvas.height;
    var keep = mainCtx, sc = snap.getContext('2d', { willReadFrequently: true });
    ctx = mainCtx = sc;
    try { R.draw(1, ui); } finally { ctx = mainCtx = keep; }
    return sc.getImageData(0, 0, snap.width, snap.height);
  };

  TF.Render = R;
})(window.TF);
