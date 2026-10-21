// Boot, fixed-timestep loop, pointer input (mouse + touch), HUD and the window.__flow debug hook.
(function (TF) {
  var C = TF.C, World = TF.World, Sim = TF.Sim, R = TF.Render, Audio = TF.Audio;

  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    place: $('btnPlace'), rotate: $('btnRotate'), line: $('btnLine'), crowd: $('btnCrowd'), hack: $('btnHack'),
    raid: $('btnRaid'), zin: $('btnZoomIn'), zout: $('btnZoomOut'), toast: $('toast'), popup: $('hackPopup'),
    play: $('btnPlay'), speed: $('btnSpeed'), art: $('btnArt'),
    money: $('money'), served: $('served'), hint: $('hint')
  };

  // mode: 'idle' | 'place' | 'build'
  var state = {
    running: false, speed: 1, mode: 'idle', rot: 0, ghost: null, hover: null,
    acc: 0, last: 0, fps: 60, frames: 0, fpsT: 0, shownMoney: 0, errors: 0, hintT: 0
  };

  window.addEventListener('error', function () { state.errors++; });
  window.addEventListener('unhandledrejection', function () { state.errors++; });

  World.build();
  R.setContext(ctx);

  // ---- Layout ------------------------------------------------------------
  var dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    R.dpr = dpr;
    R.vw = window.innerWidth; R.vh = window.innerHeight;
    canvas.width = Math.round(R.vw * dpr); canvas.height = Math.round(R.vh * dpr);
    canvas.style.width = R.vw + 'px'; canvas.style.height = R.vh + 'px';
    var oldCenter = R.vw0 ? R.toWorld(R.vw0 / 2, R.vh0 / 2) : { x: World.W / 2, y: World.H / 2 - 2 };
    // Start zoomed in enough that a 2x2 stand and its line read clearly; +/-, wheel and pinch zoom.
    if (!R.vw0) R.cam.z = Math.max(1.1, Math.min(2.0, Math.min(R.vw, R.vh) / 520));
    R.centerOn(oldCenter.x, oldCenter.y);
    R.vw0 = R.vw; R.vh0 = R.vh;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- HUD ---------------------------------------------------------------
  function defaultHint() {
    if (!Sim.stand.placed) return 'Tap “Place stand”, then tap open ground. R rotates.';
    if (!Sim.stand.line.length) return 'Tap “Build line” and paint a queue from the ORDER window to a path.';
    if (!Sim.stand.connected) return 'Keep painting: the line’s end must touch a footpath.';
    return '';
  }
  function setHint(text, secs) { el.hint.textContent = text; el.hint.style.opacity = text ? 1 : 0; state.hintT = secs || 0; }
  function refreshButtons() {
    el.place.textContent = state.mode === 'place' ? 'Cancel' : (Sim.stand.placed ? 'Move stand' : 'Place stand');
    el.place.classList.toggle('active', state.mode === 'place');
    el.rotate.style.display = state.mode === 'place' ? '' : 'none';
    el.line.textContent = state.mode === 'build' ? 'Done' : 'Build line';
    el.line.classList.toggle('active', state.mode === 'build');
    el.line.disabled = !Sim.stand.placed;
    el.play.textContent = state.running ? '❚❚ Pause' : '▶ Play';
    el.speed.textContent = state.speed + '×';
    el.art.textContent = 'Art: ' + TF.Art.mode;
    el.art.disabled = !TF.Art.ready;
    if (TF.Crew) TF.Crew.refresh();
  }
  function setMode(m) {
    state.mode = m;
    state.ghost = null; state.hover = null;
    if (m === 'place') setHint('Tap open ground to place the stand. R / ↻ rotates. Green = OK.');
    else if (m === 'build') setHint('Tap or drag tile by tile from the ORDER window to a footpath. Tap a line tile to remove it and the rest.');
    else setHint(defaultHint());
    refreshButtons();
  }
  el.place.addEventListener('click', function () { Audio.unlock(); setMode(state.mode === 'place' ? 'idle' : 'place'); });
  el.rotate.addEventListener('click', function () { api.rotate(); });
  el.line.addEventListener('click', function () { Audio.unlock(); setMode(state.mode === 'build' ? 'idle' : 'build'); });
  el.play.addEventListener('click', function () { Audio.unlock(); state.running ? api.pause() : api.play(); });
  el.speed.addEventListener('click', function () { Audio.unlock(); api.setSpeed(state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1); });
  el.art.addEventListener('click', function () { api.setArt(TF.Art.mode === 'painted' ? 'placeholder' : 'painted'); });

  // ---- Pointer input -----------------------------------------------------
  var drag = null;
  function tileAt(cx, cy) { var w = R.toWorld(cx, cy); return { x: Math.floor(w.x), y: Math.floor(w.y) }; }
  // The tapped / hovered tile is the stand's anchor (its back tile), for mouse and touch alike.
  function standAt(cx, cy) { return tileAt(cx, cy); }

  function setZoom(nz, cx, cy) {
    nz = Math.max(0.6, Math.min(2.6, nz));
    if (cx === undefined) { cx = R.vw / 2; cy = R.vh / 2; }
    var w = R.toWorld(cx, cy);
    R.cam.z = nz;
    var p = R.toScreen(w.x, w.y);
    R.cam.x += cx - p.x; R.cam.y += cy - p.y;
  }
  el.zin.addEventListener('click', function () { setZoom(R.cam.z * 1.25); });
  el.zout.addEventListener('click', function () { setZoom(R.cam.z / 1.25); });
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); setZoom(R.cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY); }, { passive: false });
  el.crowd.addEventListener('click', function () { api.setCrowd(Sim.crowd === 'normal' ? 'high' : Sim.crowd === 'high' ? 'low' : 'normal'); });
  el.hack.addEventListener('click', function () { Audio.unlock(); api.hack(); });
  el.raid.addEventListener('click', function () { Audio.unlock(); api.raid(); });

  var toastTimer = null;
  function toast(text) {
    el.toast.textContent = text; el.toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.toast.hidden = true; }, 2600);
  }
  var popupTimer = null;
  function showHackPopup() {
    el.popup.hidden = false;
    el.popup.classList.remove('glitch'); void el.popup.offsetWidth; el.popup.classList.add('glitch');
    clearTimeout(popupTimer); popupTimer = setTimeout(function () { el.popup.hidden = true; }, 3000);
  }
  function updateGhost(cx, cy) {
    var t = standAt(cx, cy), v = World.validateStand(t.x, t.y, state.rot);
    state.ghost = { sx: t.x, sy: t.y, rot: state.rot, ok: v.ok, reason: v.reason };
  }
  function tryPlace(cx, cy) {
    updateGhost(cx, cy);
    var g = state.ghost, res = Sim.placeStand(g.sx, g.sy, g.rot);
    if (res.ok) { setMode('idle'); setHint('Stand placed. Now tap “Build line” to paint its queue.', 3); }
    else setHint(res.reason + ' — try another spot.', 2.5);
  }
  function updateHover(cx, cy) {
    var t = tileAt(cx, cy);
    if (World.isLine(t.x, t.y)) state.hover = { x: t.x, y: t.y, del: true };
    else state.hover = { x: t.x, y: t.y, ok: Sim.canAddLine(t.x, t.y).ok };
  }
  function lineAt(cx, cy) {
    var t = tileAt(cx, cy), r = Sim.addLineTile(t.x, t.y);
    if (!r.ok) setHint(r.reason, 2);
    else setHint(Sim.stand.connected ? 'Connected! Guests can queue now.' : 'Line not connected to a path yet.', 2);
    return r.ok;
  }

  var touches = {}, pinch = null;
  canvas.addEventListener('pointerdown', function (e) {
    Audio.unlock();
    canvas.setPointerCapture(e.pointerId);
    touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(touches);
    if (ids.length === 2) {   // second finger: pinch zoom, cancel whatever the first was doing
      var a = touches[ids[0]], b = touches[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: R.cam.z };
      drag = null;
      return;
    }
    var t = tileAt(e.clientX, e.clientY);
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, type: e.pointerType, tile: t, del: null };
    if (state.mode === 'place') updateGhost(e.clientX, e.clientY);
    else if (state.mode === 'build') {
      if (World.isLine(t.x, t.y)) drag.del = t;
      else lineAt(e.clientX, e.clientY);
      updateHover(e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (touches[e.pointerId]) touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pinch) {
      var ids = Object.keys(touches);
      if (ids.length === 2) {
        var a = touches[ids[0]], b = touches[ids[1]];
        setZoom(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d), (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      return;
    }
    if (state.mode === 'place' && (!drag || drag.type !== 'mouse' || !drag.moved)) updateGhost(e.clientX, e.clientY);
    if (state.mode === 'build') updateHover(e.clientX, e.clientY);
    if (!drag || drag.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) drag.moved = true;
    if (state.mode === 'build') {
      // Dragging paints tile to tile; it never pans.
      var t = tileAt(e.clientX, e.clientY);
      if (t.x !== drag.tile.x || t.y !== drag.tile.y) {
        drag.tile = t; drag.del = null;
        if (!World.isLine(t.x, t.y)) lineAt(e.clientX, e.clientY);
      }
    } else if (drag.moved && !(state.mode === 'place' && drag.type !== 'mouse')) {
      R.cam.x += e.clientX - drag.lx; R.cam.y += e.clientY - drag.ly;
    }
    drag.lx = e.clientX; drag.ly = e.clientY;
  });
  function endPointer(e, cancelled) {
    delete touches[e.pointerId];
    if (pinch) { if (!Object.keys(touches).length) pinch = null; return; }
    if (!drag || drag.id !== e.pointerId) return;
    var d = drag; drag = null;
    if (cancelled) return;
    if (state.mode === 'place' && (!d.moved || d.type !== 'mouse')) tryPlace(e.clientX, e.clientY);
    if (state.mode === 'build' && d.del) {
      Sim.removeLineFrom(d.del.x, d.del.y);
      setHint(Sim.stand.line.length ? 'Line shortened — not connected to a path.' : 'Line removed.', 2);
      updateHover(e.clientX, e.clientY);
    }
  }
  canvas.addEventListener('pointerup', function (e) { endPointer(e, false); });
  canvas.addEventListener('pointercancel', function (e) { endPointer(e, true); });
  canvas.addEventListener('pointerleave', function () { if (!drag) { if (state.mode === 'place') state.ghost = null; state.hover = null; } });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.mode !== 'idle') setMode('idle');
    if ((e.key === 'r' || e.key === 'R') && state.mode === 'place') api.rotate();
    if (e.key === ' ') { e.preventDefault(); state.running ? api.pause() : api.play(); }
  });

  // ---- Loop --------------------------------------------------------------
  function handleEvents() {
    for (var i = 0; i < Sim.events.length; i++) {
      var ev = Sim.events[i];
      if (ev.type === 'cash') Audio.chaChing();
      else if (ev.type === 'handoff') Audio.pop();
      else if (ev.type === 'toast') toast(ev.text);
      else if (ev.type === 'hack') { showHackPopup(); toast('Classes dismissed early!'); }
    }
    Sim.events.length = 0;
  }

  function frame(now) {
    var real = Math.min(0.25, (now - (state.last || now)) / 1000);
    state.last = now;
    if (state.running) {
      state.acc += real * state.speed;
      var steps = 0;
      while (state.acc >= C.DT && steps < 40) { Sim.step(C.DT); state.acc -= C.DT; steps++; }
      if (steps >= 40) state.acc = 0;
      handleEvents();
    }
    R.draw(state.running ? state.acc / C.DT : 1, { placing: state.mode === 'place', building: state.mode === 'build', ghost: state.ghost, hover: state.hover });

    var target = Sim.stats.money;
    state.shownMoney += (target - state.shownMoney) * Math.min(1, real * 8);
    if (Math.abs(target - state.shownMoney) < 0.5) state.shownMoney = target;
    var m = '$' + Math.round(state.shownMoney);
    if (el.money.textContent !== m) el.money.textContent = m;
    var s = Sim.stats.served + ' served';
    if (el.served.textContent !== s) el.served.textContent = s;
    var hasAnt = TF.Crew && TF.Crew.hiredSet.antonio, h = TF.Events.hack;
    el.hack.hidden = !hasAnt;
    if (hasAnt) {
      var ht = h.phase !== 'idle' ? 'Hacking\u2026' : h.cooldown > 0 ? 'Hack agenda (' + Math.ceil(h.cooldown) + 's)' : 'Hack agenda';
      if (el.hack.textContent !== ht) el.hack.textContent = ht;
      el.hack.disabled = !TF.Events.canHack();
    }
    el.raid.hidden = !hasAnt;
    if (hasAnt) {
      var r = TF.Events.raid, rt = r.phase !== 'idle' ? 'Raid incoming\u2026' : r.cooldown > 0 ? 'Twitch raid (' + Math.ceil(r.cooldown) + 's)' : 'Twitch raid';
      if (el.raid.textContent !== rt) el.raid.textContent = rt;
      el.raid.disabled = !TF.Events.canRaid();
    }
    var ct = 'Crowd: ' + Sim.crowd[0].toUpperCase() + Sim.crowd.slice(1) + (Sim.rushT > 0 ? ' \u2022 RUSH' : '');
    if (el.crowd.textContent !== ct) el.crowd.textContent = ct;
    if (state.hintT > 0) { state.hintT -= real; if (state.hintT <= 0 && state.mode === 'idle') setHint(defaultHint()); }
    else if (state.mode === 'idle' && el.hint.textContent !== defaultHint()) setHint(defaultHint());

    state.frames++; state.fpsT += real;
    if (state.fpsT >= 1) { state.fps = state.frames / state.fpsT; state.frames = 0; state.fpsT = 0; }
    requestAnimationFrame(frame);
  }

  // BFS over line-able ground from the order tile to the first tile touching a walkway.
  function planLine(sx, sy, rot) {
    var g = World.standGeom(sx, sy, rot), start = { x: g.order[0], y: g.order[1] };
    var saved = World.stand; World.stand = { sx: sx, sy: sy, rot: rot };
    var seen = {}, q = [[start]], out = null;
    seen[start.x + ',' + start.y] = 1;
    while (q.length) {
      var path = q.shift(), t = path[path.length - 1];
      if (World.DIRS.some(function (d) { return World.isWalkway(t.x + d[0], t.y + d[1]); })) { out = path; break; }
      if (path.length > 7) continue;
      World.DIRS.forEach(function (d) {
        var n = { x: t.x + d[0], y: t.y + d[1] }, k = n.x + ',' + n.y;
        if (seen[k] || !World.lineGround(n.x, n.y)) return;
        seen[k] = 1; q.push(path.concat([n]));
      });
    }
    World.stand = saved;
    return out;
  }

  // ---- Debug hook --------------------------------------------------------
  var api = {
    placeStand: function (tx, ty, rot) { var r = Sim.placeStand(tx, ty, rot || 0); if (r.ok) setMode('idle'); return r.ok; },
    addLine: function (tx, ty) { return Sim.addLineTile(tx, ty).ok; },
    removeLine: function (tx, ty) { return Sim.removeLineFrom(tx, ty); },
    rotate: function () {
      state.rot = (state.rot + 1) % 4;
      if (state.ghost) { state.ghost.rot = state.rot; state.ghost.ok = World.validateStand(state.ghost.sx, state.ghost.sy, state.rot).ok; }
      return state.rot;
    },
    mode: function () { return state.mode; },
    play: function () { state.running = true; state.last = 0; refreshButtons(); },
    pause: function () { state.running = false; refreshButtons(); },
    setSpeed: function (n) { state.speed = n === 2 || n === 4 ? n : 1; refreshButtons(); },
    stats: function () {
      var c = Sim.counts(), st = Sim.stand;
      return {
        spawned: Sim.stats.spawned, served: Sim.stats.served, completedLoop: Sim.stats.completedLoop,
        money: Sim.stats.money, errors: state.errors, fps: Math.round(state.fps * 10) / 10,
        queue: c.queue, enroute: c.enroute, atPickup: c.atPickup, leavingWithTaco: c.leavingWithTaco, alive: c.alive,
        balked: Sim.stats.balked, art: TF.Art.mode, simTime: Math.round(Sim.t * 10) / 10,
        standPlaced: st.placed, stand: st.placed ? { sx: st.sx, sy: st.sy, rot: st.rot } : null,
        lineTiles: st.line.length, connected: st.connected, capacity: st.cap,
        avgWait: Math.round(Sim.avgWait() * 100) / 100, hint: el.hint.textContent,
        crew: TF.Crew ? TF.Crew.hired() : [],
        tier: st.tier, stock: st.stock, restocks: st.restocks, restocking: !!Sim.runner, gaveUp: Sim.stats.gaveUp,
        zoom: Math.round(R.cam.z * 100) / 100, crowd: Sim.crowd, rush: Sim.rushT > 0, grillWork: Math.round(Sim.stats.grillWork * 100) / 100,
        westVisits: TF.Events.westVisits, westActive: !!TF.Events.west && TF.Events.west.phase === 'chat', westPhase: TF.Events.west ? TF.Events.west.phase : null,
        aliPausedSeconds: Math.round(TF.Events.aliPausedSeconds * 10) / 10, aiAli: !!TF.Crew.extras.aiali, aiAliChatSeconds: Math.round(TF.Events.aiAliChats * 10) / 10,
        thoughts: Object.assign({}, Sim.thoughts),
        ambientBikers: TF.Ambient.bikers.length, ambientSitters: TF.Ambient.sitters.length, bikesPassed: TF.Ambient.bikesPassed,
        day: TF.Bets.day, dayEarn: TF.Bets.dayEarn, bets: Object.assign({}, TF.Bets.bets), flips: Object.assign({}, TF.Bets.flips), flipPolicy: TF.Bets.policy, betCard: TF.Bets.card,
        tortillaShots: Sim.stats.tortillaShots, cannon: !!Sim.mods.cannon, handT: Math.round(Sim.mods.handT * 100) / 100,
        grackleEvents: TF.Events.grackle.events, grackleSlowSeconds: Math.round(TF.Events.grackle.slowSeconds * 10) / 10, grackleShooed: TF.Events.grackle.shooed, grackles: TF.Events.grackle.phase,
        raids: TF.Events.raid.raids, raidPhase: TF.Events.raid.phase, lastRaidSpawned: TF.Events.raid.lastSpawned, raidFromEdges: TF.Events.raid.fromEdges,
        hacks: TF.Events.hack.hacks, hackPhase: TF.Events.hack.phase, lastHackSpawned: TF.Events.hack.lastSpawned,
        fromHackAlive: Sim.guests.filter(function (g) { return g.fromHack; }).length
      };
    },
    // Test helpers (client pixels).
    tileToClient: function (tx, ty) { return R.toScreen(tx + 0.5, ty + 0.5); },
    standToClient: function (sx, sy) { return R.toScreen(sx + 0.5, sy + 0.5); },   // centre of the anchor tile
    // A valid on-screen stand spot whose shortest possible queue line to a walkway is 3-6 tiles,
    // plus that line. Lets tests build a disconnected line first, then connect it.
    // A good stand spot (enough walkway inside its zone, shortest possible queue line 3-6 tiles),
    // plus that line. Prefers spots already on screen; otherwise centres the camera on the best one.
    suggestStand: function (rot, relaxed) {
      rot = rot || 0;
      function search(onScreenOnly) {
        var best = null;
        for (var y = 0; y < World.H; y++) for (var x = 0; x < World.W; x++) {
          if (!World.validateStand(x, y, rot).ok) continue;
          var c = R.toScreen(x + 1, y + 1);
          if (onScreenOnly && (c.x < 70 || c.y < 150 || c.x > R.vw - 70 || c.y > R.vh - 120)) continue;
          var walk = 0, zr = Sim.mods.zoneR * 0.8;
          for (var wy = -6; wy <= 6; wy++) for (var wx = -6; wx <= 6; wx++) if (Math.hypot(wx, wy) <= zr && World.isWalkway(x + 1 + wx, y + 1 + wy)) walk++;
          if (walk < (relaxed ? 6 : 14)) continue;
          var line = planLine(x, y, rot);
          if (!line || line.length > 6 || line.length < (relaxed ? 1 : 3)) continue;
          if (onScreenOnly && !line.every(function (t) { var p = R.toScreen(t.x + 0.5, t.y + 0.5); return p.x > 20 && p.y > 110 && p.x < R.vw - 20 && p.y < R.vh - 70; })) continue;
          var d = onScreenOnly ? Math.hypot(c.x - R.vw / 2, c.y - R.vh / 2) : Math.hypot(x - World.W / 2, y - World.H / 2);
          if (!best || d < best.d) best = { sx: x, sy: y, rot: rot, line: line, d: d };
        }
        return best;
      }
      var b = search(true);
      if (!b) { b = search(false); if (b) R.centerOn(b.sx + 1, b.sy + 1.5); }
      return b;
    },
    setArt: function (mode) {
      if (mode === 'painted' && !TF.Art.ready) return false;
      TF.Art.mode = mode === 'painted' ? 'painted' : 'placeholder';
      if (TF.Crew) TF.Crew.drawPortraits();
      refreshButtons();
      return true;
    },
    hire: function (id) { return TF.Crew.hire(id); },
    buyTier: function (id) { return TF.Crew.buyTier(id); },
    grantMoney: function (n) { Sim.stats.money += n; },   // test helper only
    setCrowd: function (c) {
      Sim.crowd = C.CROWD[c] ? c : 'normal';
      el.crowd.textContent = 'Crowd: ' + Sim.crowd[0].toUpperCase() + Sim.crowd.slice(1);
      return Sim.crowd;
    },
    hack: function () { return TF.Events.startHack(false); },
    raid: function () { return TF.Events.startRaid(); },
    offerBet: function () { return TF.Bets.offerBet(); },   // test hooks: the card / closing / a flip offer also happen on their own
    endDay: function () { TF.Bets.endDay(); },
    offerFlip: function () { return TF.Bets.offerFlip(); },
    grackles: function () { return TF.Events.startGrackles(); },   // test hook (they also come on their own)
    zoom: function (z) { if (z) setZoom(z); return R.cam.z; },
    // For each crew member on screen: how many of their opaque sprite pixels change when the
    // stand pieces are removed (i.e. are drawn over by a piece). frac ~0 means fully visible.
    crewOverdraw: function () {
      var A = R.snapshot({ noGuests: true }), B = R.snapshot({ noGuests: true, noPieces: true, noProps: true }), out = {};
      TF.Crew.lastDrawn.slice().forEach(function (id) {
        var M = R.snapshot({ bare: true, onlyCrew: id }), n = 0, over = 0;
        for (var i = 0; i < M.data.length; i += 4) {
          if (M.data[i + 3] < 200) continue;
          n++;
          var d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
          if (d > 40) over++;
        }
        out[id] = { px: n, over: over, frac: n ? Math.round(over / n * 1000) / 1000 : 1 };
      });
      return out;
    },
    // Same idea for the stand itself: how much of the stand pieces' pixels a tree / lamp / bench /
    // planter visibly changes (faded see-through props stay under the threshold).
    standOverdraw: function () {
      if (!Sim.stand.placed) return null;
      var A = R.snapshot({ noGuests: true }), B = R.snapshot({ noGuests: true, noProps: true }), M = R.snapshot({ bare: true, onlyPieces: true });
      var n = 0, over = 0;
      for (var i = 0; i < M.data.length; i += 4) {
        if (M.data[i + 3] < 200) continue;
        n++;
        var d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
        if (d > 70) over++;
      }
      return { px: n, over: over, frac: n ? Math.round(over / n * 1000) / 1000 : 1 };
    },
    art: function () { return { mode: TF.Art.mode, ready: TF.Art.ready, failed: TF.Art.failed }; },
    centerOn: function (tx, ty) { R.centerOn(tx, ty); },
    // Reads back the canvas pixel on the stand's front wall (checks DPR/projection).
    standWallPixel: function () {
      var st = Sim.stand; if (!st.placed) return null;
      var t = R.standPieces(st.sx, st.sy, st.rot, st.tier, false)[0], p = R.toScreen(t.x, t.y, 10);
      var d = ctx.getImageData(Math.round(p.x * dpr), Math.round(p.y * dpr), 1, 1).data;
      return [d[0], d[1], d[2]];
    }
  };
  window.__flow = api;
  TF.ui = { refresh: refreshButtons, setHint: setHint, state: state };

  setMode('idle');
  TF.Art.load(function (ok) {
    if (ok && /[?&]art=placeholder/.test(location.search)) TF.Art.mode = 'placeholder';
    R.groundDirty = true;
    if (TF.Crew) TF.Crew.drawPortraits();
    refreshButtons();
  });
  requestAnimationFrame(frame);
})(window.TF);
