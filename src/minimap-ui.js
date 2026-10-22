// The 6B minimap (src/minimap.js) on screen (Pass 6B B1): a transparent overlay canvas (pointer-events off;
// main.js hands it taps first), redrawn at 10 Hz: the level's tiles + stands (baked once per change), the
// background crowd's density, the crew (blue) and open breakdowns (red), and the camera's view. Tapping
// the map jumps the camera there; tapping it collapsed opens it. Collapsed by default on phones. The 🗺
// toggle (with Jump to stand / Jump to Matt) sits outside the canvas for keyboard users.
(function (TF) {
  var Sim = TF.Sim, World = TF.World, R = TF.Render;
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('minimapCanvas'), toggle = $('btnMinimap'), jumps = $('miniJumps');
  if (!cv || !TF.Minimap) return;
  var ctx = cv.getContext('2d');
  var MM = TF.Minimap.create({ createCanvas: function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }, hz: 10 });
  var UI = TF.Minimap6 = { mm: MM, rev: -1, adapter: null, density: null, crew: [{ x: 0, y: 0, active: false }, { x: 0, y: 0, active: false }], alerts: [], draws: 0 };

  function level() {
    UI.adapter = { W: World.W, H: World.H, tiles: World.tiles, stands: Sim.stands };
    var cols = Math.ceil(World.W / 8), rows = Math.ceil(World.H / 8);
    UI.density = { cols: cols, rows: rows, bucketTiles: 8, counts: new Uint16Array(cols * rows) };
    UI.rev = -1;
  }
  function layout() {
    var dpr = R.dpr || 1;
    cv.width = Math.round(R.vw * dpr); cv.height = Math.round(R.vh * dpr);
    cv.style.width = R.vw + 'px'; cv.style.height = R.vh + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    MM.layout(R.vw, R.vh, { top: (R.hudBottom || 60) + 4, bottom: 0, left: 0, right: 0 });
    MM.invalidate(); place();
  }
  function place() {   // the jump buttons sit just above the expanded map
    if (!jumps) return;
    var b = MM.box;
    jumps.hidden = b.collapsed;
    if (!b.collapsed) { jumps.style.left = b.x + 'px'; jumps.style.top = Math.max(0, b.y - 34) + 'px'; jumps.style.width = b.width + 'px'; }
    if (toggle) toggle.textContent = b.collapsed ? '🗺 Map' : '🗺 Hide map';
  }
  level();
  World.onLoad.push(function () { level(); layout(); });
  window.addEventListener('resize', function () { setTimeout(layout, 0); });

  UI.tap = function (x, y) {
    var cam = TF.ui && TF.ui.camera;
    if (!cam || !MM.tap(x, y, cam)) return false;
    MM.invalidate(); place();
    if (TF.Onboard) TF.Onboard.userPanned = true;
    return true;
  };
  UI.setCollapsed = function (v) { MM.setCollapsed(v); MM.invalidate(); place(); };
  if (toggle) toggle.addEventListener('click', function () { UI.setCollapsed(!MM.box.collapsed); });
  if ($('btnMiniStand')) $('btnMiniStand').addEventListener('click', function () { var st = Sim.selected(); if (st.placed && TF.ui.camera) TF.ui.camera.snapTo(st.geom.cx, st.geom.cy); });
  if ($('btnMiniMatt')) $('btnMiniMatt').addEventListener('click', function () {
    var H = TF.Handyman, p = H && (H.pos() || (H.on() && H.home)), cam = TF.ui.camera;
    if (p && cam) cam.snapTo(p.x, p.y);
  });

  var lastHud = -1;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!R.vw) return;
    if (cv.width !== Math.round(R.vw * (R.dpr || 1)) || R.hudBottom !== lastHud) { lastHud = R.hudBottom; layout(); }
    if (World.version !== UI.rev) { UI.rev = World.version; MM.loadLevel(UI.adapter, World.version); }
    var t = now / 1000, cam = TF.ui && TF.ui.camera;
    if (!cam || !MM.needsRedraw(t)) return;
    var CL = TF.CrowdLayer;
    if (CL && CL.sim) MM.countGrid(CL.sim.grid, UI.density); else UI.density.counts.fill(0);
    // the customers (walking, queueing, waiting at the window) count too: the busiest spot is often the line
    var D = UI.density, G = Sim.guests;
    for (var gi = 0; gi < G.length; gi++) {
      var g = G[gi], bx = Math.floor(g.x / D.bucketTiles), by = Math.floor(g.y / D.bucketTiles);
      if (bx >= 0 && by >= 0 && bx < D.cols && by < D.rows && D.counts[by * D.cols + bx] < 65535) D.counts[by * D.cols + bx]++;
    }
    var st = Sim.stand, c0 = UI.crew[0], c1 = UI.crew[1], H = TF.Handyman;
    c0.active = st.placed; if (st.placed) { c0.x = st.geom.cx; c0.y = st.geom.cy; }
    var mp = H && H.away() && H.pos(); c1.active = !!mp; if (mp) { c1.x = mp.x; c1.y = mp.y; }
    UI.alerts.length = 0;
    if (H && H.S && H.on()) H.S.faults.forEach(function (f) {   // every open breakdown: the stand's, or a placed can / cooler's
      var p = null;
      if (f.targetId === 'grill' || f.targetId === 'banner') p = st.geom && { x: st.geom.cx, y: st.geom.cy };
      else if (f.targetId.indexOf('obj:') === 0) { var o = TF.Objects && TF.Objects.list[+f.targetId.slice(4)]; if (o) p = { x: o.x + 0.5, y: o.y + 0.5 }; }
      if (p) UI.alerts.push({ x: p.x, y: p.y, active: true });
    });
    if (MM.draw(ctx, t, cam, UI.density, UI.crew, UI.alerts)) UI.draws++;
  }
  requestAnimationFrame(frame);
})(window.TF);
