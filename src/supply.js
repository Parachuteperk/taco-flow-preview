// Supply: a TXST supply van parked at the west edge of the quad and the Freshman Runner hire.
// When a stand's stock drops to 25% the runner walks to the van, loads a crate ("Got the goods!"),
// carries it back and refills the stand while Jared keeps selling. Without a runner, Jared still
// makes his own restock walks (sales pause). Stock at 0 shows SOLD OUT at the window.
(function (TF) {
  var World = TF.World, Sim = TF.Sim, R = TF.Render;

  // Parked on the lawn just north of the west walk; the runner loads up standing on the walk,
  // in front of it from the camera's point of view.
  var VAN = { x0: 0.25, x1: 2.15, y0: 12.95, y1: 13.75, stop: { x: 1.5, y: 14.3 } };
  var S = { van: VAN, trip: null, trips: 0, tripsByStand: [0, 0], soldOutSeconds: 0, idleSpot: null };
  World.blockedForStand = function (x, y) { return y === 13 && x >= 0 && x <= 2; };   // van parking

  function hasRunner() { return TF.Crew && TF.Crew.hiredSet.runner; }
  S.active = function () { return hasRunner(); };

  function door(st) {
    var g = st.geom;
    return { x: g.cx + (g.n[0] + g.np[0]) * 1.25, y: g.cy + (g.n[1] + g.np[1]) * 1.25 };
  }
  function route(from, to) {
    var t = World.astar(Math.floor(from.x), Math.floor(from.y), Math.floor(to.x), Math.floor(to.y));
    var pts = (t || []).slice(1).map(function (p) { return { x: p.x + 0.5, y: p.y + 0.5 }; });
    pts.push({ x: to.x, y: to.y });
    return pts;
  }
  // The stand that will run out first (stock as a fraction of its max); the runner serves it.
  function neediest() {
    var list = Sim.stands || [Sim.stand], best = null;
    list.forEach(function (st) {
      if (!st.placed) return;
      var max = st.mods.stockMax, f = st.stock / max;
      if (f <= 0.25 && (!best || f < best.f)) best = { st: st, f: f };
    });
    return best && best.st;
  }

  S.step = function (dt) {
    var list = Sim.stands || [Sim.stand];
    list.forEach(function (st) {
      if (st.placed && st.stock <= 0 && (!TF.Week || !TF.Week.active() || TF.Week.phase === 'open' || TF.Week.phase === 'close')) S.soldOutSeconds += dt;
    });
    if (!hasRunner()) { S.trip = null; return; }
    var r = S.trip;
    if (!r) {
      var st = neediest();
      if (!st) return;
      var d = door(st);
      r = S.trip = { st: st, x: d.x, y: d.y, px: d.x, py: d.y, path: route(d, VAN.stop), speed: 2.2, hx: 1, hy: 0, facing: 0, moving: false, anim: 0, offX: 0, offY: 0, phase: 'out', t: 0, carry: false };
      st.needRestock = false;
      return;
    }
    r.px = r.x; r.py = r.y;
    if (r.phase === 'load') {
      r.moving = false; r.t -= dt;
      if (r.t <= 0) { r.phase = 'back'; r.carry = true; r.path = route({ x: r.x, y: r.y }, door(r.st)); }
    } else if (Sim.walkEntity(r, dt, false)) {
      if (r.phase === 'out') { r.phase = 'load'; r.t = 1.5; Sim.floaters.push({ x: r.x, y: r.y, text: 'Got the goods!', t: 0 }); }
      else {
        var max = r.st.mods.stockMax;
        r.st.stock = max; r.st.needRestock = false;
        S.trips++; S.tripsByStand[r.st.idx] = (S.tripsByStand[r.st.idx] || 0) + 1;
        Sim.floaters.push({ x: r.x, y: r.y, text: 'Restocked!', t: 0 });
        S.trip = null;
        return;
      }
    }
    if (r.moving) Sim.faceEntity(r, r.hx, r.hy);
  };

  // ---- Drawing ---------------------------------------------------------------------------
  S.items = function (items, alpha) {
    items.push({ kind: 'supply', what: 'van', x: VAN.x1, y: VAN.y1, k: VAN.x1 + VAN.y0 + 0.4 });
    if (!hasRunner()) return;
    var r = S.trip;
    if (r) {
      var x = r.px + (r.x - r.px) * alpha, y = r.py + (r.y - r.py) * alpha;
      items.push({ kind: 'supply', what: 'runner', x: x, y: y, k: x + y });
    } else if (Sim.stand.placed) {
      var d = door(Sim.stand), sx = d.x + 0.35, sy = d.y + 0.35;
      items.push({ kind: 'supply', what: 'runner', idle: true, x: sx, y: sy, k: sx + sy });
    }
  };

  S.draw = function (ctx, it, z) {
    if (it.what === 'van') { drawVan(ctx, z); return; }
    var r = S.trip, p = R.toScreen(it.x, it.y);
    var g = r && !it.idle ? r : { facing: 0, moving: false, anim: 0 };
    var guest = { variant: 2, facing: g.facing, moving: g.moving, anim: g.anim, hasTaco: false, tall: 0.95, shirt: '#c9a227', skin: '#d9a77e', hair: '#3b2a20', pants: '#2d3a5a', cap: true, backpack: false, pack: '#222' };
    var P = TF.ArtPeople;
    if (!(TF.Art.painted() && P && P.drawGuest(ctx, guest, p.x, p.y, z))) R.drawPerson(guest, p.x, p.y, z);
    // red "FRESHMAN" cap so he reads as crew, and the crate he carries back
    ctx.fillStyle = '#c62f2f'; ctx.fillRect(p.x - 4 * z, p.y - 31 * z, 8 * z, 3 * z);
    if (r && r.carry && !it.idle) {
      ctx.fillStyle = '#9a6a3a'; ctx.fillRect(p.x - 7 * z, p.y - 21 * z, 14 * z, 9 * z);
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1 * z; ctx.strokeRect(p.x - 7 * z, p.y - 21 * z, 14 * z, 9 * z);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(p.x - 5 * z, p.y - 23 * z, 10 * z, 2.5 * z);
    }
    if (r && !it.idle) R.text(r.phase === 'back' ? 'on the way!' : r.phase === 'load' ? 'loading…' : 'supply run', p.x, p.y - 40 * z, 7 * z, '#fff5d6', 'rgba(60,30,20,0.85)');
  };

  function drawVan(ctx, z) {
    var H = 30, P = function (x, y, h) { return R.toScreen(x, y, h); };
    R.poly([P(VAN.x0, VAN.y1, 0), P(VAN.x1, VAN.y1, 0), P(VAN.x1, VAN.y1, H), P(VAN.x0, VAN.y1, H)], '#7a1e2c');   // long side
    R.poly([P(VAN.x1, VAN.y1, 0), P(VAN.x1, VAN.y0, 0), P(VAN.x1, VAN.y0, H), P(VAN.x1, VAN.y1, H)], '#5e1420');   // back
    R.poly([P(VAN.x0, VAN.y0, H), P(VAN.x1, VAN.y0, H), P(VAN.x1, VAN.y1, H), P(VAN.x0, VAN.y1, H)], '#f4efe4');   // roof
    R.poly([P(VAN.x0 + 0.05, VAN.y1, 14), P(VAN.x0 + 0.5, VAN.y1, 14), P(VAN.x0 + 0.5, VAN.y1, 26), P(VAN.x0 + 0.05, VAN.y1, 26)], '#9ec4d8');   // windshield
    [VAN.x0 + 0.45, VAN.x1 - 0.35].forEach(function (wx) { var w = P(wx, VAN.y1, 0); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(w.x, w.y - 2 * z, 5 * z, 4 * z, 0, 0, Math.PI * 2); ctx.fill(); });
    var lab = P((VAN.x0 + VAN.x1) / 2 + 0.2, VAN.y1, 13);
    R.text('TXST SUPPLY', lab.x, lab.y, 7 * z, '#ffd23a');
  }

  TF.Supply = S;
})(window.TF);
