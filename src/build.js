// Construction (Pass 5 item 2): a build bought while the stand is OPEN takes 6-12 game seconds.
// A freshman in a hard hat walks in carrying a crate, hammers a few times, and the new piece
// appears. Only the thing being built is offline; the stand keeps selling. Builds bought in PREP
// (or Free Play) are instant: the crew sets them up before the doors open.
(function (TF) {
  var Sim = TF.Sim, World = TF.World, R = TF.Render;
  var B = { jobs: [], started: 0, finished: 0, log: [] };
  B.SECS = { grill: 8, banner: 6, serving: 10, canopy: 12, stand2: 12, picnic: 9, drinks: 7, trash: 6, cornhole: 12, foodTruck: 25, neonMenu: 8, billboard: 12 };

  // Construction only happens on an open Taco Week day; everything else builds instantly.
  B.live = function () { return !!(TF.Week && TF.Week.active() && (TF.Week.phase === 'open' || TF.Week.phase === 'close')); };

  function door(st) {
    var g = st.geom;
    return { x: g.cx + (g.n[0] + g.np[0]) * 1.25, y: g.cy + (g.n[1] + g.np[1]) * 1.25 };
  }
  // A walkway tile 4-6 tiles from the site with a short path in: where the freshman comes from.
  function startPoint(to) {
    var tx = Math.floor(to.x), ty = Math.floor(to.y), best = null;
    for (var y = ty - 6; y <= ty + 6; y++) for (var x = tx - 6; x <= tx + 6; x++) {
      var d = Math.hypot(x - tx, y - ty);
      if (d < 4 || d > 6.5 || !World.isWalkway(x, y)) continue;
      var p = World.astar(x, y, tx, ty);
      if (p && p.length <= 10 && (!best || p.length < best.p.length)) best = { x: x, y: y, p: p };
    }
    return best;
  }

  // o: { st, id, name, apply, at: {x, y} (optional site; default the stand's door) }
  B.start = function (o) {
    if (!B.live()) { o.apply(); return null; }
    var site = o.at || door(o.st), from = startPoint(site);
    var secs = B.SECS[o.id] || 8;
    var j = { id: o.id, name: o.name, st: o.st, apply: o.apply, site: site, secs: secs, t: 0, phase: 'walk', hits: 0, speed: 1.8,
      x: from ? from.x + 0.5 : site.x, y: from ? from.y + 0.5 : site.y, hx: 1, hy: 0, facing: 0, moving: false, anim: 0, offX: 0, offY: 0 };
    j.px = j.x; j.py = j.y;
    j.path = from ? from.p.slice(1).map(function (p) { return { x: p.x + 0.5, y: p.y + 0.5 }; }).concat([{ x: site.x, y: site.y }]) : [];
    B.jobs.push(j); B.started++;
    Sim.events.push({ type: 'toast', text: '🔨 Building ' + o.name + ' (' + secs + ' s): a freshman is on it!' });
    return j;
  };
  B.busy = function (id) { return B.jobs.some(function (j) { return j.id === id && j.phase !== 'leave'; }); };

  function finish(j) {
    j.phase = 'leave'; j.t2 = 0; j.carry = false;
    j.apply();
    B.finished++;
    B.log.push({ id: j.id, secs: Math.round(j.t * 10) / 10, day: TF.Week ? TF.Week.day : 0 });
    Sim.floaters.push({ x: j.site.x, y: j.site.y, text: '✨ ' + j.name + ' built!', t: 0 });
    Sim.events.push({ type: 'handoff' });
  }
  // End of the day: anything still under way is finished on the spot.
  B.finishAll = function () { B.jobs.forEach(function (j) { if (j.phase !== 'leave') finish(j); }); B.jobs = []; };

  B.step = function (dt) {
    for (var i = B.jobs.length - 1; i >= 0; i--) {
      var j = B.jobs[i];
      j.px = j.x; j.py = j.y;
      if (j.phase === 'leave') { j.t2 += dt; if (j.t2 > 1.2) B.jobs.splice(i, 1); continue; }
      j.t += dt;
      if (j.phase === 'walk') {
        // keep the total at secs: if the walk runs long he jumps to the site and starts hammering
        if (Sim.walkEntity(j, dt, false) || j.t > j.secs - 3) { j.phase = 'hammer'; j.x = j.site.x; j.y = j.site.y; j.moving = false; j.hammerFrom = j.t; }
        else if (j.moving) Sim.faceEntity(j, j.hx, j.hy);
      }
      if (j.phase === 'hammer') {
        var k = Math.floor((j.t - j.hammerFrom) / 0.9);
        if (k > j.hits) { j.hits = k; j.bang = 0.25; }
        if (j.bang > 0) j.bang -= dt;
        if (j.t >= j.secs) finish(j);
      }
    }
  };

  B.items = function (items, alpha) {
    B.jobs.forEach(function (j) {
      var x = j.px + (j.x - j.px) * alpha, y = j.py + (j.y - j.py) * alpha;
      items.push({ kind: 'build', plugin: B, job: j, x: x, y: y, k: x + y + 0.3 });
    });
  };

  B.draw = function (ctx, it, z) {
    var j = it.job, p = R.toScreen(it.x, it.y), s = R.toScreen(j.site.x, j.site.y);
    // scaffold + progress at the site while it's under way
    if (j.phase !== 'leave') {
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2 * z;
      [-14, 14].forEach(function (dx) { ctx.beginPath(); ctx.moveTo(s.x + dx * z, s.y); ctx.lineTo(s.x + dx * z, s.y - 34 * z); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(s.x - 14 * z, s.y - 30 * z); ctx.lineTo(s.x + 14 * z, s.y - 30 * z); ctx.stroke();
      var f = Math.min(1, j.t / j.secs);
      ctx.fillStyle = 'rgba(40,20,10,0.85)'; ctx.fillRect(s.x - 26 * z, s.y - 50 * z, 52 * z, 7 * z);
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(s.x - 25 * z, s.y - 49 * z, 50 * z * f, 5 * z);
      R.text('🚧 ' + j.name, s.x, s.y - 58 * z, 9 * z, '#fff', 'rgba(60,30,20,0.9)');
    }
    // the freshman: a student sprite with a hard hat, a crate while walking, a hammer at the site
    var guest = { variant: 3, facing: j.facing, moving: j.moving, anim: j.anim, hasTaco: false, tall: 0.95, shirt: '#e07a1f', skin: '#c58b62', hair: '#2a1a12', pants: '#3a3a3a', cap: false, backpack: false, pack: '#222' };
    var P = TF.ArtPeople;
    if (!(TF.Art.painted() && P && P.drawGuest(ctx, guest, p.x, p.y, z))) R.drawPerson(guest, p.x, p.y, z);
    ctx.fillStyle = '#ffd23a';   // hard hat
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 31 * z, 6 * z, 3.5 * z, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(p.x - 7 * z, p.y - 31 * z, 14 * z, 1.6 * z);
    if (j.phase === 'walk') {
      ctx.fillStyle = '#9a6a3a'; ctx.fillRect(p.x - 7 * z, p.y - 21 * z, 14 * z, 9 * z);
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1 * z; ctx.strokeRect(p.x - 7 * z, p.y - 21 * z, 14 * z, 9 * z);
    } else if (j.phase === 'hammer') {
      var up = j.bang > 0 ? 0 : 1, ang = up ? -1.1 : 0.4;
      ctx.save(); ctx.translate(p.x + 6 * z, p.y - 20 * z); ctx.rotate(ang);
      ctx.fillStyle = '#7a5230'; ctx.fillRect(0, -1 * z, 10 * z, 2 * z);
      ctx.fillStyle = '#555'; ctx.fillRect(8 * z, -3 * z, 4 * z, 6 * z);
      ctx.restore();
      if (j.bang > 0) R.text('BANG!', p.x + 18 * z, p.y - 30 * z, 9 * z, '#fff', 'rgba(200,80,20,0.95)');
    }
  };

  TF.plugins.push(B);
  TF.Build = B;
})(window.TF);
