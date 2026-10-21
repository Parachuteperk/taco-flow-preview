// Ambient campus life: students biking along the walks and a few hanging out on benches and lawns.
// They are not guests: never buy, never queue, never enter the walker grid (so they can't block).
(function (TF) {
  var C = TF.C, World = TF.World, Sim = TF.Sim;

  var A = { bikers: [], sitters: [], nextBike: 3, nextSwap: 30, bikesPassed: 0 };
  var VARIANTS = 4;
  function rnd(a, b) { return a + (b - a) * Sim.rand(); }
  function pathExits() { return World.exits; }

  function spawnBiker() {
    var ex = pathExits(), a = ex[Math.floor(Sim.rand() * ex.length)], b = a;
    for (var i = 0; i < 6 && b === a; i++) b = ex[Math.floor(Sim.rand() * ex.length)];
    if (a === b) return;
    var tiles = World.exitPath(a.x, a.y, b);
    if (!tiles) return;
    var bk = {
      x: a.x + 0.5 + a.ox, y: a.y + 0.5 + a.oy, px: 0, py: 0, path: tiles.map(function (t) { return { x: t.x + 0.5, y: t.y + 0.5 }; }),
      speed: rnd(2.8, 3.6), hx: 0, hy: 1, facing: 0, moving: true, anim: 0, variant: Math.floor(Sim.rand() * 1000), offX: 0, offY: 0
    };
    bk.path.push({ x: b.x + 0.5 + b.ox, y: b.y + 0.5 + b.oy });
    bk.px = bk.x; bk.py = bk.y;
    A.bikers.push(bk);
  }

  // Hangout spots: benches, plus lawn tiles right next to a walk (not near the stand).
  function hangoutSpots() {
    var out = [];
    for (var y = 0; y < World.H; y++) for (var x = 0; x < World.W; x++) {
      var t = World.get(x, y);
      if (t === World.T.BENCH) out.push({ x: x + 0.5, y: y + 0.5, bench: true });
      else if (t === World.T.GRASS && World.nearWalk(x, y, 1) && (x * 7 + y * 13) % 11 === 0) out.push({ x: x + 0.5, y: y + 0.55, bench: false });
    }
    return out;
  }
  function freeHangout() {
    var spots = hangoutSpots(), st = Sim.stand;
    spots = spots.filter(function (s) {
      if (World.isLine(Math.floor(s.x), Math.floor(s.y)) || World.isStand(Math.floor(s.x), Math.floor(s.y))) return false;
      if (st.placed && Math.hypot(s.x - st.geom.cx, s.y - st.geom.cy) < 3.5) return false;
      return A.sitters.every(function (o) { return Math.hypot(o.x - s.x, o.y - s.y) > 0.8; });
    });
    return spots.length ? spots[Math.floor(Sim.rand() * spots.length)] : null;
  }

  A.step = function (dt) {
    // bikers
    A.nextBike -= dt;
    if (A.nextBike <= 0) { A.nextBike = rnd(5, 10); if (A.bikers.length < 3) spawnBiker(); }
    for (var i = A.bikers.length - 1; i >= 0; i--) {
      var b = A.bikers[i];
      b.px = b.x; b.py = b.y;
      if (Sim.walkEntity(b, dt, false)) { A.bikers.splice(i, 1); A.bikesPassed++; continue; }
      Sim.faceEntity(b, b.hx, b.hy);
      b.offX = -b.hy * 0.3; b.offY = b.hx * 0.3;   // ride on the right edge of the walk
    }
    // sitters: keep ~5, swap one now and then
    A.nextSwap -= dt;
    if (A.nextSwap <= 0 && A.sitters.length) { A.sitters.splice(Math.floor(Sim.rand() * A.sitters.length), 1); A.nextSwap = rnd(30, 60); }
    while (A.sitters.length < 5) {
      var s = freeHangout();
      if (!s) break;
      A.sitters.push({ x: s.x, y: s.y, bench: s.bench, variant: Math.floor(Sim.rand() * 1000), phase: Sim.rand() * 6, mirror: Sim.rand() < 0.5 });
    }
    // Moving the stand or building a line onto a hangout spot sends that sitter away.
    for (var j = A.sitters.length - 1; j >= 0; j--) {
      var q = A.sitters[j];
      if (World.isLine(Math.floor(q.x), Math.floor(q.y)) || World.isStand(Math.floor(q.x), Math.floor(q.y))) A.sitters.splice(j, 1);
    }
  };

  A.items = function (items, alpha) {
    A.bikers.forEach(function (b) {
      var x = b.px + (b.x - b.px) * alpha + b.offX, y = b.py + (b.y - b.py) * alpha + b.offY;
      items.push({ kind: 'ambient', what: 'bike', b: b, x: x, y: y, k: x + y });
    });
    A.sitters.forEach(function (s) { items.push({ kind: 'ambient', what: 'sit', s: s, x: s.x, y: s.y, k: s.x + s.y }); });
  };

  // Upper body of a student sprite (people sheet), clipped at the hips.
  function upperBody(ctx, g, sx, sy, z, mirror, front) {
    var P = TF.ArtPeople;
    if (!(TF.Art.painted() && P && P.ready)) {
      TF.Render.drawPerson({ facing: front ? (mirror ? 1 : 0) : (mirror ? 2 : 3), moving: false, anim: 0, shirt: ['#7a1e2c', '#c9a227', '#3d6fb4', '#5b8c5a'][g.variant % 4], skin: '#d9a77e', hair: '#3b2a20', pants: '#2d3a5a' }, sx, sy + 8 * z, z);
      return;
    }
    var set = P.cust[['hoodie', 'tank', 'capguy', 'sundress'][g.variant % VARIANTS]];
    var img = front ? set.stand : set.away[0], sc = 30 * z / 122, hip = img.ay * 0.55;
    ctx.save(); ctx.translate(sx, sy); if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, img.width, hip, -img.ax * sc, -hip * sc, img.width * sc, hip * sc);
    ctx.restore();
  }

  A.draw = function (ctx, it, z) {
    var R = TF.Render, p = R.toScreen(it.x, it.y);
    if (p.x < -40 || p.x > R.vw + 40 || p.y < -60 || p.y > R.vh + 40) return;   // cull
    if (it.what === 'bike') {
      var b = it.b, front = b.facing < 2, mirror = b.facing === 1 || b.facing === 3;
      var dx = (mirror ? -1 : 1) * 7 * z, spin = b.anim * 6;
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 10 * z, 2.5 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.3 * z;
      [-1, 1].forEach(function (w) { ctx.beginPath(); ctx.arc(p.x + w * dx, p.y - 4 * z, 4 * z, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x + w * dx, p.y - 4 * z); ctx.lineTo(p.x + w * dx + Math.cos(spin) * 4 * z, p.y - 4 * z + Math.sin(spin) * 4 * z); ctx.stroke(); });
      ctx.strokeStyle = ['#b8283a', '#3d6fb4', '#c9a227', '#2f6b3a'][b.variant % 4]; ctx.lineWidth = 1.8 * z;
      ctx.beginPath(); ctx.moveTo(p.x - dx, p.y - 4 * z); ctx.lineTo(p.x, p.y - 9 * z); ctx.lineTo(p.x + dx, p.y - 4 * z); ctx.moveTo(p.x, p.y - 9 * z); ctx.lineTo(p.x + dx * 0.8, p.y - 12 * z); ctx.stroke();
      upperBody(ctx, b, p.x, p.y - 10 * z, z, mirror, front);
    } else {
      var s = it.s, bob = Math.sin(Sim.t * 1.3 + s.phase) * 0.6 * z;
      if (!s.bench) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 7 * z, 2.5 * z, 0, 0, Math.PI * 2); ctx.fill(); }
      upperBody(ctx, s, p.x, p.y - (s.bench ? 7 : 1) * z + bob, z, s.mirror, true);
      if (!s.bench) { ctx.fillStyle = '#2d3a5a'; ctx.fillRect(p.x - 5 * z, p.y - 2 * z, 10 * z, 2.5 * z); }   // legs folded on the grass
    }
  };

  TF.Ambient = A;
})(window.TF);
