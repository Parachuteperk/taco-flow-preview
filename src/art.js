// RCT-style Gemini art (assets/gemini/*.png, embedded as data: URLs by tools/embed-art.mjs).
// Each sheet is sliced with a crop table and its magenta background chroma-keyed to transparent
// at load time. Anything missing falls back to the placeholder shapes in render.js.
(function (TF) {
  // Crop tables in sheet pixels. ax/ay = anchor inside the crop (people: feet, x = head centre).
  var RCT = {
    grass:    { x: 6,   y: 5, w: 246, h: 131 },
    concrete: { x: 261, y: 6, w: 246, h: 130 },
    brick:    { x: 516, y: 6, w: 247, h: 130 },
    flowers:  { x: 772, y: 6, w: 246, h: 130 },
    se: [
      { x: 300, y: 156, w: 43, h: 110, ax: 21.5, ay: 108 },
      { x: 420, y: 156, w: 57, h: 111, ax: 28.3, ay: 109 },
      { x: 550, y: 156, w: 52, h: 111, ax: 24.2, ay: 109 },
      { x: 679, y: 154, w: 43, h: 113, ax: 20.4, ay: 111 }
    ],
    ne: [
      { x: 554, y: 291, w: 51, h: 112, ax: 20.4, ay: 110 },
      { x: 678, y: 291, w: 53, h: 114, ax: 21.9, ay: 112 }
    ],
    seTaco: [
      { x: 296, y: 431, w: 71, h: 113, ax: 22.2, ay: 111 },
      { x: 424, y: 431, w: 74, h: 113, ax: 23.9, ay: 111 },
      { x: 545, y: 431, w: 77, h: 113, ax: 28.4, ay: 111 },
      { x: 671, y: 431, w: 75, h: 113, ax: 26.3, ay: 111 },
      { x: 798, y: 431, w: 72, h: 113, ax: 22.9, ay: 111 },
      { x: 928, y: 431, w: 72, h: 113, ax: 22.8, ay: 111 }
    ],
    taco: { x: 341, y: 460, w: 24, h: 22, ax: 4, ay: 11 }
  };
  // Whole-image sprites: base-diamond anchors measured from the pixels.
  //  stand_2x2_v1: base left (273,447) bottom (511,566) right (752,446); order window on the
  //  left (+y) face, pickup hatch on the right (+x) face.
  //  oldmain_iso_v1: bottom vertex (365,565); long entrance face on the right; mirrored in use.
  var WHOLE = {
    oldmain: { sheet: 'oldmain_iso_v1', bx: 365, by: 565, longW: 509 }
  };

  // stand_stages_v1: one piece per tier. The table and cooler (panel A) touch, so the cooler is
  // cut out with a polygon (it is carried on restock runs) and removed from the table-only crop.
  var COOLER_POLY = [[176, 131], [238, 100], [289, 118], [289, 165], [212, 207], [176, 180]];
  var STAGES = {
    tablecooler: { x: 49, y: 37, w: 242, h: 172 },
    table: { x: 49, y: 37, w: 242, h: 172, cut: COOLER_POLY },
    cooler: { x: 172, y: 98, w: 120, h: 112, keep: COOLER_POLY },
    grill: { x: 459, y: 20, w: 106, h: 177 },
    banner: { x: 806, y: 16, w: 83, h: 211 },
    counter: { x: 105, y: 323, w: 144, h: 152 },
    canopy: { x: 391, y: 276, w: 242, h: 254 }
  };

  // quad_tiles_v1: seamless flat ground tiles (row 1) and quad props (row 2). dw = width of the
  // tile diamond in sheet px, dcy = its centre below the crop top; props anchor at their foot.
  var QUAD = {
    qgrass: { x: 2, y: 87, w: 254, h: 137, dw: 254 },
    qbrick: { x: 258, y: 87, w: 252, h: 136, dw: 252 },
    qlime:  { x: 512, y: 88, w: 254, h: 135, dw: 254 },
    oak:     { x: 4, y: 286, w: 249, h: 193, ax: 125.5, ay: 190 },
    planter: { x: 288, y: 361, w: 192, h: 131, ax: 66, ay: 128 },
    lamp:    { x: 620, y: 294, w: 40, h: 186, ax: 19.5, ay: 183 },
    bench:   { x: 822, y: 353, w: 141, h: 135, ax: 70, ay: 125 }
  };
  var QUAD_TILE_W = 254;   // one world tile = 254 sheet px

  var Art = { ready: false, failed: false, mode: 'placeholder', img: {}, avg: {}, tileSrcW: 246, whole: WHOLE, sheets: {} };

  function mag(d, i) { return Math.min(d[i], d[i + 2]) - d[i + 1]; }

  // Key a crop: flood-fill the magenta background from the border (so magenta-ish paint inside
  // tiles survives), key enclosed magenta pockets in sprites, despill the pink JPEG fringe.
  function slice(sheet, c, isTile) {
    var cv = document.createElement('canvas');
    cv.width = c.w; cv.height = c.h;
    var x = cv.getContext('2d', { willReadFrequently: true });
    x.drawImage(sheet, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
    var id = x.getImageData(0, 0, c.w, c.h), d = id.data, W = c.w, H = c.h, n = W * H;
    var key = new Uint8Array(n), stack = [], i, p;
    for (i = 0; i < W; i++) stack.push(i, (H - 1) * W + i);
    for (i = 0; i < H; i++) stack.push(i * W, i * W + W - 1);
    while (stack.length) {
      p = stack.pop();
      if (key[p] || mag(d, p * 4) < 40) continue;
      key[p] = 1;
      var px = p % W, py = (p / W) | 0;
      if (px > 0) stack.push(p - 1);
      if (px < W - 1) stack.push(p + 1);
      if (py > 0) stack.push(p - W);
      if (py < H - 1) stack.push(p + W);
    }
    var sr = 0, sg = 0, sb = 0, cnt = 0;
    for (p = 0; p < n; p++) {
      var o = p * 4, m = mag(d, o);
      if (key[p] || (!isTile && m > 90)) { d[o + 3] = 0; continue; }
      if (m > 20) {
        var k = m - 20;
        d[o] = Math.max(0, d[o] - k); d[o + 2] = Math.max(0, d[o + 2] - k);
        if (m > 45) d[o + 3] = 150;
      }
      if (!(p % 7)) { sr += d[o]; sg += d[o + 1]; sb += d[o + 2]; cnt++; }
    }
    x.putImageData(id, 0, 0);
    cv.ax = c.ax || 0; cv.ay = c.ay || 0;
    cv.avg = cnt ? 'rgb(' + Math.round(sr / cnt) + ',' + Math.round(sg / cnt) + ',' + Math.round(sb / cnt) + ')' : '#000';
    return cv;
  }
  Art.slice = slice;

  // Slice, then keep only (keep) or erase (cut) a polygon given in sheet pixels.
  function masked(sheet, c) {
    var cv = slice(sheet, c, false);
    var poly = c.keep || c.cut;
    if (poly) {
      var x = cv.getContext('2d');
      x.save();
      x.globalCompositeOperation = c.keep ? 'destination-in' : 'destination-out';
      x.beginPath();
      poly.forEach(function (p, i) { if (i) x.lineTo(p[0] - c.x, p[1] - c.y); else x.moveTo(p[0] - c.x, p[1] - c.y); });
      x.closePath(); x.fill();
      x.restore();
    }
    cv.ax = cv.width / 2; cv.ay = cv.height;   // bottom-centre foot
    return cv;
  }

  function loadImage(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { if (TF.artTick) TF.artTick(); res(im); }; im.onerror = function (e) { if (TF.artTick) TF.artTick(); rej(e); }; im.src = src; });
  }

  Art.load = function (done) {
    (TF.artSources || Promise.resolve()).then(function () { loadSheets(done); });   // src/artload.js fills TF.ART_SRCS
  };
  function loadSheets(done) {
    var srcs = TF.ART_SRCS || {};
    var names = Object.keys(srcs);
    if (!names.length) { Art.failed = true; done(false); return; }
    Promise.all(names.map(function (n) { return loadImage(srcs[n]).then(function (im) { Art.sheets[n] = im; }, function () {}); }))
      .then(function () {
        try {
          var s = Art.sheets.rct_sheet_v1;
          if (s) {
            ['grass', 'concrete', 'brick', 'flowers'].forEach(function (k) { Art.img[k] = slice(s, RCT[k], true); Art.avg[k] = Art.img[k].avg; });
            Art.img.taco = slice(s, RCT.taco, false);
            ['se', 'ne', 'seTaco'].forEach(function (k) { Art.img[k] = RCT[k].map(function (c) { return slice(s, c, false); }); });
          }
          var qs = Art.sheets.quad_tiles_v1;
          if (qs && qs.width > 1) Object.keys(QUAD).forEach(function (k) {
            var c = QUAD[k], cv = slice(qs, c, !!c.dw);
            if (c.dw) { cv.dw = c.dw; cv.dcy = c.dw / 4; }
            Art.img[k] = cv;
          });
          Art.quadTileW = QUAD_TILE_W;
          var ss = Art.sheets.stand_stages_v1;
          if (ss) Object.keys(STAGES).forEach(function (k) { Art.img[k] = masked(ss, STAGES[k]); });
          Object.keys(WHOLE).forEach(function (k) {
            var im = Art.sheets[WHOLE[k].sheet];
            if (im) Art.img[k] = slice(im, { x: 0, y: 0, w: im.width, h: im.height }, false);
          });
          if (TF.ArtPeople) TF.ArtPeople.load(Art);
          Art.ready = !!(Art.img.grass || Art.img.tablecooler);
          if (Art.ready) Art.mode = 'painted';
        } catch (e) {
          Art.failed = true;   // e.g. a tainted canvas: stay on placeholders
        }
        done(Art.ready);
      });
  }

  Art.painted = function () { return Art.ready && Art.mode === 'painted'; };
  Art.has = function (k) { return Art.painted() && !!Art.img[k]; };

  TF.Art = Art;
})(window.TF);
