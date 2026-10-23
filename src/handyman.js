// Matt's handyman job (Pass 6 C4): a thin adapter around TF.Matt (src/matt.js holds the rules: the
// seeded breakdown schedule, one job queue, trips, the hand-off fallback while he's away, save state).
// Here: what can break on this map (the grill, the banner, trash cans, the drink cooler), how far Matt
// walks (A* on the tile map), what an open fault does, his HUD chip, and drawing him on the move.
// Taco Week with the economy only; Free Play keeps the old always-at-the-counter Matt.
(function (TF) {
  var Sim = TF.Sim, World = TF.World, R = TF.Render;
  var $ = function (id) { return document.getElementById(id); };
  var OPEN_T = 180, PHASE = { prep: 'prep', open: 'open', close: 'close', report: 'report', ended: 'report' };
  var HM = { unreachable: 0, cancelled: {}, blocked: false, legV: -1, lastPos: null, M: null, S: null, day: 0, home: { x: 0, y: 0 }, prev: {}, fixes: 0, faultsSeen: 0, clankT: 0, sig: '', last: null, pos0: null };

  function week() { return !!(TF.Week && TF.Week.active() && TF.Econ && TF.Econ.on()); }
  HM.on = function () { return week() && !!TF.Crew.hiredSet.matt && Sim.stand.placed; };

  // Where Matt works on an object: the nearest walkable tile he can reach from the stand, else the nearest
  // walkable one, else the object's own tile. Never null while the object exists: an unreachable can is
  // still broken (its fault stays; he can't be sent until there's a way, C4 final review).
  function near(p) {
    var best = null, any = null;
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
      var x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy;
      if (!isFinite(World.cost(x, y)) || World.isStand(x, y)) continue;
      var d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y), c = { x: x + 0.5, y: y + 0.5, d: d };
      if (!any || d < any.d) any = c;
      if (path(HM.home, c) && (!best || d < best.d)) best = c;
    }
    var w = best || any;
    return w ? { x: w.x, y: w.y } : { x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5 };
  }
  var paths = {}, pathsV = -1;
  function path(a, b) {
    if (pathsV !== World.version) { paths = {}; pathsV = World.version; }
    var k = Math.floor(a.x) + ',' + Math.floor(a.y) + '>' + Math.floor(b.x) + ',' + Math.floor(b.y);
    if (!(k in paths)) paths[k] = World.astar(Math.floor(a.x), Math.floor(a.y), Math.floor(b.x), Math.floor(b.y));
    return paths[k];
  }
  // A route with exact ends: from a (not its tile centre) through the A* tile centres to b, so a re-routed
  // leg starts exactly where he stands (no snap, C4 final review). null when there's no way.
  function route(a, b) {
    if (Math.floor(a.x) === Math.floor(b.x) && Math.floor(a.y) === Math.floor(b.y)) return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
    var t = path(a, b);
    if (!t) return null;
    return [{ x: a.x, y: a.y }].concat(t.slice(1, -1).map(function (q) { return { x: q.x + 0.5, y: q.y + 0.5 }; }), [{ x: b.x, y: b.y }]);
  }
  function polyLen(pts) { var n = 0; for (var i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return n; }
  function along(pts, d) {   // the point d tiles along the polyline
    for (var i = 1; i < pts.length; i++) {
      var s = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (d <= s || i === pts.length - 1) { var u = s ? Math.min(1, d / s) : 1; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u }; }
      d -= s;
    }
    return { x: pts[0].x, y: pts[0].y };
  }
  // TF.Matt measures trips in tiles along those routes. With no route the length is only an estimate:
  // HM.step never lets him walk a leg that has no route (he waits and retries), so it never crosses walls.
  function pathLength(a, b) {
    var r = route(a, b);
    return r ? polyLen(r) : Math.hypot(a.x - b.x, a.y - b.y);
  }
  // Targets: 'grill' / 'banner' are fixed at the stand (he works from its side: no walk, but he's off
  // the counter); 'obj:N' is a placed trash can or drink cooler, fixed from the nearest walk tile.
  function objAt(id) { var o = TF.Objects && TF.Objects.list[+id.slice(4)]; return o && o.ready ? o : null; }
  function getTarget(id) {
    var st = Sim.stand;
    if (!st.placed) return null;
    if (id === 'grill') return st.tier >= 1 ? { x: HM.home.x, y: HM.home.y } : null;
    if (id === 'banner') return st.tier >= 2 ? { x: HM.home.x, y: HM.home.y } : null;
    var o = id.indexOf('obj:') === 0 && objAt(id);
    return o ? near({ x: o.x + 0.5, y: o.y + 0.5 }) : null;   // null only when the object is gone: TF.Matt cancels the job
  }
  function reachable(p) { return !!route(HM.home, p); }
  HM.faultedObj = function (o) {   // a tipped can / jammed cooler doesn't work until fixed
    if (!HM.S || !HM.on() || !TF.Objects) return false;
    var id = 'obj:' + TF.Objects.list.indexOf(o);
    return HM.S.faults.some(function (f) { return f.targetId === id; });
  };
  function getBreakdownTargets() {
    var out = [], st = Sim.stand;
    if (st.tier >= 1) out.push({ targetId: 'grill', breakdown: 'grill' });
    if (st.tier >= 2) out.push({ targetId: 'banner', breakdown: 'banner' });
    (TF.Objects ? TF.Objects.list : []).forEach(function (o, i) {
      if (!o.ready) return;
      if (o.kind === 'cornhole') out.push({ targetId: 'obj:' + i, breakdown: 'cornhole' });
      if (o.kind === 'stringLights') out.push({ targetId: 'obj:' + i, breakdown: 'lights' });
      if (o.kind === 'trash') out.push({ targetId: 'obj:' + i, breakdown: 'trash' });
      if (o.kind === 'drinks') out.push({ targetId: 'obj:' + i, breakdown: 'cooler' });
    });
    return out.filter(function (c) { var p = getTarget(c.targetId); return p && reachable(p); });   // new faults only where he can get to
  }
  // His counter-side spot follows the stand. If it moved: idle, the model's position moves with it (no
  // phantom walk from the old spot); walking home, the return leg is rebuilt from where he is now; on a
  // stand job (grill / banner), the work stops and he walks to the stand's new spot before resuming
  // (he used to finish the repair remotely, C4 final review).
  function updateHome() {
    var a = TF.Supply && TF.Supply.access(Sim.stand);
    if (!a || (a.x === HM.home.x && a.y === HM.home.y)) return;
    HM.home.x = a.x; HM.home.y = a.y;
    if (!HM.M) return;
    var S = HM.M.getState(), p = HM.pos() || S.position;
    var job = S.currentId && S.jobs.filter(function (j) { return j.id === S.currentId; })[0];
    if (S.mode === 'AT_STAND') { S.position = { x: a.x, y: a.y }; HM.M.setState(S); }
    else if (S.returning && S.leg) relegFrom(S, p, a);
    else if (job && (job.targetId === 'grill' || job.targetId === 'banner')) {
      job.status = 'walking'; S.mode = 'WALKING'; S.returning = false;
      relegFrom(S, p, a);
    }
  }
  // Replace the current leg with one from p (his drawn position) to `to`, measured on the map.
  function relegFrom(S, p, to) {
    var len = pathLength(p, to);
    S.position = { x: p.x, y: p.y };
    S.leg = { from: { x: p.x, y: p.y }, to: { x: to.x, y: to.y }, length: len, remaining: len };
    HM.M.setState(S);
    HM.legV = World.version;
  }
  function ensure() {
    if (!HM.M) {
      updateHome();
      HM.M = TF.Matt.create({ rng: TF.Rng.streams.matt, pathLength: pathLength, getTarget: getTarget, getBreakdownTargets: getBreakdownTargets,
        stand: HM.home, walkSpeed: 1.6, onWestMood: function () {} });
      HM.day = 0;
    }
    var d = TF.Econ.abs(TF.Week.day);
    if (HM.day !== d) { HM.M.startDay(d, Math.min(4, Sim.levelNo()), OPEN_T); HM.day = d; }
    return HM.M;
  }
  World.onLoad.push(function () { HM.M = null; HM.S = null; HM.day = 0; HM.prev = {}; HM.sig = ''; HM.cancelled = {}; });

  // ---- what the rest of the game asks --------------------------------------------------------------
  HM.away = function () { return HM.on() && !!HM.S && HM.S.mode !== 'AT_STAND'; };
  HM.coverHandT = function (base) { return HM.M ? HM.M.handoffTime(base, 'jared') : base; };   // Jared covers: base x 0.8
  HM.fault = function (kind) { return !!(HM.S && HM.on() && HM.S.faults.some(function (f) { return f.breakdown === kind; })); };
  HM.mods = function (st, m) {
    if (st.idx !== 0) return;
    if (HM.fault('grill')) m.cookT /= 0.7;           // grill sputters: -30% cook speed
    if (HM.fault('banner')) m.zoneR = Math.max(1, m.zoneR - 1);   // banner flickering: -1 tile of draw
  };
  HM.patienceDelta = function (g) {   // a tipped trash can: -3 s patience within 3 tiles
    if (!HM.S || !HM.on()) return 0;
    for (var i = 0; i < HM.S.faults.length; i++) {
      var f = HM.S.faults[i], p = f.breakdown === 'trash' && getTarget(f.targetId);
      if (p && Math.hypot(p.x - g.x, p.y - g.y) <= 3) return -3;
    }
    return 0;
  };

  // ---- the player's choice: send him now, or call him back -------------------------------------------
  HM.send = function () {
    if (!HM.on()) return false;
    var M = ensure(), q = M.getQueue()[0], tp = q && getTarget(q.targetId);
    if (tp && !reachable(tp)) {   // the fault stays; send him once there's a way (C4 final review)
      Sim.events.push({ type: 'toast', text: '🚧 Matt can’t get there from the stand. Clear a path, then send him.' });
      HM.unreachable++;
      return false;
    }
    var ok = M.dispatch();
    if (ok) { HM.S = M.getState(); Sim.events.push({ type: 'toast', text: '🔧 Matt’s on it. The counter loses its fast hand-off till he’s back.' }); }
    return ok;
  };
  // Call Matt back: TF.Matt measures the way home from his leg's origin; walk it from where he is instead
  // (he used to jump back to the origin, C4 review).
  HM.callBack = function () {
    if (!HM.M) return false;
    var p = HM.pos(), ok = HM.M.callBack(), S = HM.M.getState();
    if (ok && p && S.leg) relegFrom(S, p, S.leg.to);
    HM.S = HM.M.getState();
    return ok;
  };
  var chip = $('mattChip');
  if (chip) chip.addEventListener('click', function () {
    if (TF.Audio) TF.Audio.unlock();
    if (!HM.S || HM.S.mode === 'AT_STAND') HM.send(); else HM.callBack();
    HM.refresh();
  });

  HM.step = function (dt) {
    if (!HM.on()) return;
    var M = ensure(), W = TF.Week;
    updateHome();   // the stand may have moved
    var before = HM.S && HM.S.mode !== 'AT_STAND' ? HM.pos() : null;
    // A leg is walked only along a real route. The map changed (a build, a moved stand): re-route from where
    // he is. No route at all: he stands still and the game retries next step (C4 final review: he used to
    // walk through obstacles).
    var S0 = M.getState();
    HM.blocked = false;
    if (S0.leg && before) {
      if (HM.legV !== World.version) relegFrom(S0, before, S0.leg.to);
      if (!route(before, M.getState().leg.to)) HM.blocked = true;
    }
    M.step(HM.blocked ? 0 : dt, HM.day, PHASE[W.phase] || 'report');
    HM.S = M.getState();
    var after = HM.pos();
    if (before && after && (Math.abs(after.x - before.x) + Math.abs(after.y - before.y)) > 1e-4) HM.heading = { x: after.x - before.x, y: after.y - before.y };
    // new faults: tell the player; cleared faults: a check mark where he fixed it
    var cur = {};
    HM.S.faults.forEach(function (f) {
      cur[f.jobId] = f;
      if (!HM.prev[f.jobId]) {
        HM.faultsSeen++;
        if (f.breakdown === 'trash') spill(f);
        var name = (TF.Matt.breakdowns.filter(function (b) { return b.id === f.breakdown; })[0] || {}).name || f.breakdown;
        Sim.events.push({ type: 'toast', text: '⚠ ' + name + '! Tap MATT to send him (the counter slows while he’s away).' });
      }
    });
    Object.keys(HM.prev).forEach(function (id) {
      if (cur[id]) return;
      var job = HM.S.jobs.filter(function (j) { return j.id === id; })[0];
      if (job && job.status === 'completed') {
        HM.fixes++; HM.last = { breakdown: HM.prev[id].breakdown, t: Sim.t };
        var p = faultPos(HM.prev[id]);
        if (p) Sim.floaters.push({ x: p.x, y: p.y, text: '✔ fixed!', t: 0 });
      }
    });
    HM.prev = cur;
    // any job TF.Matt cancelled because its target became unreachable / was removed: say so (C4 review)
    HM.S.jobs.forEach(function (j) {
      if (j.status === 'cancelled' && !HM.cancelled[j.id]) {   // only when its object was removed
        HM.cancelled[j.id] = true;
        Sim.events.push({ type: 'toast', text: '🔧 That job’s off: the thing Matt was fixing is gone.' });
      }
    });
    if (HM.S.mode === 'FIXING') {
      HM.clankT -= dt;
      if (HM.clankT <= 0) { HM.clankT = 1; var q = HM.pos(); if (q) Sim.floaters.push({ x: q.x, y: q.y - 0.3, text: 'clank!', t: 0 }); }
    }
    var sig = HM.S.mode + '|' + HM.S.faults.map(function (f) { return f.breakdown; }).join(',');
    if (sig !== HM.sig) { HM.sig = sig; TF.Crew.applyMods(); }
    HM.refresh();
  };

  // ---- where Matt is: along the A* path of his current leg, or on the job ------------------------------
  HM.pos = function () {
    var S = HM.S;
    if (!S || S.mode === 'AT_STAND') return null;
    var L = S.leg;
    if (!L) return S.position;
    var pts = route(L.from, L.to), f = L.length ? 1 - L.remaining / L.length : 1;
    if (!pts) return HM.lastPos || { x: L.from.x, y: L.from.y };   // no route: he hasn't moved
    return (HM.lastPos = along(pts, f * polyLen(pts)));
  };
  // a tipped trash can spills: a few wrappers around it (they blow away like any litter)
  function spill(f) {
    var o = objAt(f.targetId), O = TF.Objects;
    if (!o || !O) return;
    [[-0.6, 0.9], [0.9, 0.5], [0.3, 1.4], [1.4, -0.2], [-0.2, -0.5]].forEach(function (d, i) {
      if (O.litter.length >= O.LITTER.max) O.litter.shift();
      O.litter.push({ x: o.x + 0.5 + d[0], y: o.y + 0.5 + d[1], t: 0, rot: i * 1.3, col: i % 2 ? '#ffd23a' : '#f4efe4' });
    });
  }
  function faultPos(f) {
    if (f.targetId === 'grill' || f.targetId === 'banner') { var g = Sim.stand.geom; return g ? { x: g.cx, y: g.cy } : null; }
    var o = objAt(f.targetId);
    return o ? { x: o.x + 1, y: o.y + 1 } : null;
  }

  // ---- HUD chip --------------------------------------------------------------------------------------
  HM.refresh = function () {
    if (!chip) return;
    var on = HM.on();
    chip.hidden = !on;
    if (!on) return;
    var S = HM.S, txt, cls = 'chip';
    var eta = HM.M && S && S.mode !== 'AT_STAND' ? Math.ceil(HM.M.eta()) : 0;
    var fault = S && S.faults[0], name = fault && ((TF.Matt.breakdowns.filter(function (b) { return b.id === fault.breakdown; })[0] || {}).name || fault.breakdown);
    var phone = window.innerWidth < 480;   // short forms so the chip shares a HUD row on a phone
    if (!S || S.mode === 'AT_STAND') {
      if (fault) { txt = phone ? '⚠ ' + fault.breakdown + ' · send Matt' : '⚠ ' + name + ' · tap: send Matt'; cls += ' alert'; }
      else txt = phone ? '🔧 Matt ⚡' : '🔧 MATT · AT STAND · ⚡';
    } else if (HM.blocked) txt = phone ? '🚧 Matt blocked' : '🚧 MATT · BLOCKED · finding a way';
    else if (S.returning || phone) txt = (phone ? '🔧 Matt' : '🔧 MATT ·') + ' back in ' + eta + 's';
    else txt = '🔧 MATT · ' + (S.mode === 'FIXING' ? 'FIXING ' + (name || '') : S.mode) + ' · back in ' + eta + 's';
    if (chip.textContent !== txt) chip.textContent = txt;
    if (chip.className !== cls) chip.className = cls;
  };

  // ---- drawing: a warning on what's broken ----------------------------------------------------------
  HM.items = function (items) {
    HM.refresh();   // also in PREP (the sim is paused, so step doesn't run)
    if (!HM.on() || !HM.S) return;
    HM.S.faults.forEach(function (f) {
      var p = faultPos(f);
      if (p) items.push({ kind: 'handyman', plugin: HM, x: p.x, y: p.y, k: p.x + p.y + 3, fault: f });
    });
  };
  HM.draw = function (ctx, it, z) {
    var p = R.toScreen(it.x, it.y, 48), pulse = 1 + 0.12 * Math.sin(performance.now() / 120);
    for (var i = 0; i < 3; i++) {   // a little puff of smoke
      var k = ((performance.now() / 900) + i / 3) % 1;
      ctx.fillStyle = 'rgba(90,90,90,' + (0.45 * (1 - k)).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(p.x + (i - 1) * 5 * z, p.y - k * 16 * z, (3 + k * 4) * z, 0, Math.PI * 2); ctx.fill();
    }
    R.text('⚠', p.x, p.y + 10 * z, 16 * z * pulse, '#ffd23a', 'rgba(120,20,20,0.95)');
  };

  TF.plugins.push(HM);
  TF.Handyman = HM;
})(window.TF);
