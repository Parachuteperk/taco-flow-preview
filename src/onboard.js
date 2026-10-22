// First-time flow: glowing starter spots (always valid), a suggested queue line with one-tap
// Accept, a big OPEN button once the line connects, and the camera following the first customer.
// Everything here is a real on-screen affordance (DOM buttons over the canvas).
(function (TF) {
  var World = TF.World, Sim = TF.Sim, R = TF.Render;
  var $ = function (id) { return document.getElementById(id); };

  var O = { spots: [], suggest: null, suggestKey: '', opened: false, follow: null, userPanned: false, firstSale: false, firstSaleT: 0, pins: [] };
  var pinBox = $('starterPins'), btnAccept = $('btnAcceptLine'), btnOpen = $('btnOpen');

  // Up to 3 guaranteed-valid spots: every one passes World.validateStand, has a short suggested
  // line to a walk, and plenty of walkway inside its draw zone. Spread out, nearest the map middle.
  O.computeSpots = function () {
    var cands = [];
    for (var y = 0; y < World.H; y++) for (var x = 0; x < World.W; x++) {
      var rot = World.bestRotation(x, y, 0);
      if (rot === null) continue;
      var line = TF.planLine(x, y, rot, 4);
      if (!line || line.length < 3 || line.length > 6) continue;
      var walk = 0;
      for (var wy = -4; wy <= 4; wy++) for (var wx = -4; wx <= 4; wx++) if (Math.hypot(wx, wy) <= 4 && World.isWalkway(x + 1 + wx, y + 1 + wy)) walk++;
      if (walk < 14) continue;
      var cq = (World.level && World.level.landmarks.quad && World.level.landmarks.quad.center) || { x: World.W / 2 - 0.5, y: World.H / 2 };
      cands.push({ sx: x, sy: y, rot: rot, line: line, score: Math.hypot(x + 1 - cq.x, y + 1 - cq.y) - walk * 0.05 });
    }
    cands.sort(function (a, b) { return a.score - b.score; });
    // the level's stand slots come first (when they pass the validator and get a line)
    var slots = World.standSlots && World.standSlots.length ? World.standSlots.map(function (s) { return { id: s.id, x: s.x, y: s.y, rot: 0 }; }) : ((World.level && World.level.landmarks.quad && World.level.landmarks.quad.slots) || []);
    slots.slice().reverse().forEach(function (sl) {
      var rot = World.validateStand(sl.x, sl.y, sl.rot).ok ? sl.rot : World.bestRotation(sl.x, sl.y, sl.rot);
      var line = rot === null ? null : TF.planLine(sl.x, sl.y, rot, 4);
      if (line) cands.unshift({ sx: sl.x, sy: sl.y, rot: rot, line: line, slot: sl.id });
    });
    // spots with no live oak on or right around the footprint first (the canopy hid the stand, C4 polish)
    function treeNear(c) {
      for (var y = c.sy - 1; y <= c.sy + 2; y++) for (var x = c.sx - 1; x <= c.sx + 2; x++) if (World.get(x, y) === World.T.TREE) return true;
      return false;
    }
    var out = [];
    [false, true].forEach(function (allowTrees) {
      cands.forEach(function (c) {
        if (out.length >= 3 || out.indexOf(c) >= 0 || (!allowTrees && treeNear(c))) return;
        if (out.every(function (o) { return Math.hypot(o.sx - c.sx, o.sy - c.sy) >= 6; }) && World.validateStand(c.sx, c.sy, c.rot).ok) out.push(c);
      });
    });
    // the first time the pins appear, open the camera on the first (main) slot
    if (out.length && !O.centered && !(TF.Week && TF.Week.day > 1)) { O.centered = true; R.centerOn(out[0].sx + 1, out[0].sy + 1.5); }
    O.spots = out;
    pinBox.innerHTML = '';
    O.pins = out.map(function (s, i) {
      var b = document.createElement('button');
      b.className = 'starter'; b.id = 'starter' + i;
      var loc = TF.locationGrade ? TF.locationGrade(s.sx, s.sy, s.rot).grade : '';
      b.innerHTML = '★ Set up here' + (loc ? ' <small>' + loc + '</small>' : '') + '<span class="arr"></span>';
      b.addEventListener('click', function () {
        if (b.dataset.edge === '1') { R.centerOn(s.sx + 1, s.sy + 1); O.userPanned = true; return; }   // pan first
        O.useSpot(i);
      });
      pinBox.appendChild(b);
      return b;
    });
  };

  O.useSpot = function (i) {
    var s = O.spots[i];
    if (!s) return false;
    TF.Audio.unlock();
    var r = Sim.placeStand(s.sx, s.sy, s.rot, Sim.selected());
    if (r.ok) { TF.ui.setMode('idle'); TF.ui.setHint('Jared’s set up! Tap “Use suggested line” (or Build line to draw your own).', 4); }
    return r.ok;
  };

  O.acceptLine = function () {
    var st = Sim.selected();
    if (!O.suggest || !st.placed || st.line.length) return false;
    O.suggest.forEach(function (t) { Sim.addLineTile(t.x, t.y, st); });
    TF.ui.setHint(st.connected ? 'Line connected! Press OPEN when you’re ready.' : 'Finish the line to a footpath with Build line.', 3);
    return st.connected;
  };

  // Every placed stand needs a connected line before the day can open.
  O.allConnected = function () { return Sim.stands.every(function (st) { return !st.placed || st.connected; }) && Sim.stand.connected; };
  O.open = function () {
    if (!O.allConnected()) return false;
    TF.Audio.unlock();
    O.opened = true;
    if (TF.Week && TF.Week.active()) TF.Week.openDay(); else TF.ui.api.play();
    TF.ui.setHint('Open for business! Watch for your first customer…', 4);
    return true;
  };

  btnAccept.addEventListener('click', O.acceptLine);
  btnOpen.addEventListener('click', O.open);
  O.computeSpots();

  function place(el, wx, wy, dy) {
    var p = R.toScreen(wx, wy);
    el.style.transform = 'translate(' + Math.round(p.x) + 'px,' + Math.round(p.y + (dy || 0)) + 'px) translate(-50%, -100%)';
  }

  // A pin whose spot is off-screen sticks to the screen edge with an arrow; tapping it pans there.
  function pin(el, s) {
    var p = R.toScreen(s.sx + 1, s.sy + 1), y = p.y - 40 * R.cam.z, m = 70;
    if (!el._hw) el._hw = el.offsetWidth / 2;   // the pin's own half-width (~80 px on a phone), measured once
    var mx = Math.max(m, (el._hw || 0) + 22);       // + room for the edge arrow, so the label never clips (C4 polish)
    var cx = Math.max(mx, Math.min(R.vw - mx, p.x)), cy = Math.max(Math.max(m + 60, (R.hudBottom || 0) + 56), Math.min(R.vh - 20, y));   // never over the HUD (it wraps on phones)
    var off = cx !== p.x || cy !== y;
    if (off !== (el.dataset.edge === '1')) {
      el.dataset.edge = off ? '1' : '';
      var arrow = !off ? '' : Math.abs(cx - p.x) > Math.abs(cy - y) ? (p.x > cx ? ' \u25B6' : ' \u25C0') : (y > cy ? ' \u25BC' : ' \u25B2');
      el.querySelector('.arr').textContent = arrow;
    }
    el.style.transform = 'translate(' + Math.round(cx) + 'px,' + Math.round(cy) + 'px) translate(-50%, -100%)';
  }

  O.frame = function (real) {
    var st = Sim.selected(), ui = TF.ui.state;
    // starter pins: only while the stand being set up isn't placed yet
    var showPins = !st.placed && ui.mode === 'idle';
    pinBox.hidden = !showPins;
    if (showPins) O.spots.forEach(function (s, i) { pin(O.pins[i], s); });
    // suggested line for the current stand (recomputed when the stand moves)
    var key = st.placed ? st.sx + ',' + st.sy + ',' + st.rot : '';
    if (key !== O.suggestKey) { O.suggestKey = key; O.suggest = st.placed ? TF.planLine(st.sx, st.sy, st.rot, 4) : null; }
    var showAccept = st.placed && !st.line.length && !!O.suggest;
    btnAccept.hidden = !showAccept;
    // OPEN once the line connects (in Taco Week, during PREP)
    var weekPrep = TF.Week && TF.Week.active() && TF.Week.phase === 'prep';
    btnOpen.hidden = !(O.allConnected() && (weekPrep || (!O.opened && !ui.running && !(TF.Week && TF.Week.active()))));
    if (!btnOpen.hidden) btnOpen.textContent = weekPrep ? 'OPEN — Day ' + TF.Week.day : 'OPEN';
    // follow the first customer until the first taco is sold
    if (O.opened && !O.firstSale) {
      if (!O.follow || O.follow.gone) O.follow = Sim.guests.filter(function (g) { return g.state === 'TO_QUEUE' || g.state === 'QUEUE' || g.state === 'ORDER' || g.state === 'WAIT_PICKUP'; })[0] || null;
      if (O.follow && !O.userPanned) centerSoft(O.follow.x, O.follow.y, real);
      if (Sim.stats.served >= 1) {
        O.firstSale = true; O.firstSaleT = 2;
        var goal = TF.Week && TF.Week.active() ? TF.Week.goal() : null;
        Sim.events.push({ type: 'toast', text: '🌮 First taco sold!' + (goal ? ' 1/' + goal + ' today' : '') });
      }
    } else if (O.firstSale && O.firstSaleT > 0) {
      O.firstSaleT -= real;
      if (O.follow && !O.userPanned) centerSoft(O.follow.x, O.follow.y, real);
    }
  };

  function centerSoft(wx, wy, real) {
    var p = R.toScreen(wx, wy), k = Math.min(1, real * 3);
    R.cam.x += (R.vw / 2 - p.x) * k; R.cam.y += (R.vh / 2 - p.y) * k;
  }

  // Ground glow: starter footprints and the suggested line (drawn by the renderer).
  O.drawWorld = function (z) {
    var st = Sim.selected(), t = performance.now() / 1000, pulse = 0.35 + 0.25 * Math.sin(t * 4);
    function dia(x, y, fill, stroke) { R.poly([R.toScreen(x, y), R.toScreen(x + 1, y), R.toScreen(x + 1, y + 1), R.toScreen(x, y + 1)], fill, stroke, 2); }
    if (!st.placed) O.spots.forEach(function (s) {
      var g = World.standGeom(s.sx, s.sy, s.rot);
      g.tiles.forEach(function (tl) { dia(tl[0], tl[1], 'rgba(60,230,110,' + pulse.toFixed(2) + ')', 'rgba(120,255,160,0.95)'); });
      dia(g.order[0], g.order[1], 'rgba(255,220,90,' + (pulse * 0.8).toFixed(2) + ')', 'rgba(255,230,120,0.9)');
    });
    if (st.placed && !st.line.length && O.suggest) O.suggest.forEach(function (tl, i) {
      dia(tl.x, tl.y, 'rgba(255,210,60,' + (0.25 + 0.2 * Math.sin(t * 5 - i)).toFixed(2) + ')', 'rgba(255,200,40,0.9)');
      var c = R.toScreen(tl.x + 0.5, tl.y + 0.5);
      R.text(String(i + 1), c.x, c.y, 10 * z, '#7a1e2c', 'rgba(255,255,255,0.8)');
    });
  };

  TF.Onboard = O;
})(window.TF);
