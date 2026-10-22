// Bounded cosmetic effects. Lifetimes use real frame seconds, never simulation speed.
// Projection writes scalar scratch variables: no objects/arrays allocated in frame/draw loops.
(function (TF) {
  var Sim = TF.Sim, R = TF.Render, pool = [], CAP = 48, cursor = 0, clock = 0;
  var sx = 0, sy = 0, font = 'bold 11px monospace', lastZ = -1, lastWest = null, westPhase = '', aliUntil = 0, bumpUntil = 0, bumped = false;
  var money = document.getElementById('money');
  for (var i = 0; i < CAP; i++) pool.push({ type: '', age: 0, life: 0, x: 0, y: 0, x1: 0, y1: 0, guest: null, stand: null });
  function emit(type, life, x, y, guest, st) {
    // Reuse an expired slot first. Saturation drops the new effect; active effects keep their minimum duration.
    for (var n = 0; n < CAP; n++) {
      var k = (cursor + n) % CAP, p = pool[k];
      if (p.age < p.life) continue;
      cursor = (k + 1) % CAP;
      p.type = type; p.age = 0; p.life = life; p.x = x; p.y = y; p.guest = guest || null; p.stand = st || null;
      p.x1 = guest ? guest.x : x; p.y1 = guest ? guest.y : y;
      return p;
    }
    return null;
  }
  function project(x, y, h) { var z = R.cam.z; sx = (x - y) * TF.C.TW * 0.5 * z + R.cam.x; sy = (x + y) * TF.C.TH * 0.5 * z + R.cam.y - h * z; }
  function label(ctx, text, x, y, color) {
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#40241c'; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  var F = TF.FX = { capacity: CAP, pool: pool };
  F.cash = function (g, st) {
    var w = Sim.windowPos(st); emit('cash', 1.2, w.x, w.y, null, st); bumpUntil = clock + 0.3;
  };
  F.handoff = function (g, st) {
    var source = st === Sim.stand && TF.Crew ? TF.Crew.spotOf(st.mods.serving ? 'matt' : 'jared') : null;
    emit('taco', 1.35, source ? source.x : st.geom.cx, source ? source.y : st.geom.cy, g, st);
  };
  F.premium = function (g, st) { var w = Sim.windowPos(st); emit('premium', 1.6, w.x, w.y, null, st); };
  F.balk = function (g, st, why) {
    if (why === 'line full' || why === 'gave up waiting') emit('balk', 1.7, g.x, g.y, g, st);
  };
  F.frame = function (real, running) {
    clock += real;
    if (R.cam.z !== lastZ) { lastZ = R.cam.z; font = 'bold ' + Math.max(10, Math.round(11*lastZ)) + 'px monospace'; }
    for (var i = 0; i < CAP; i++) { var p = pool[i]; if (p.age < p.life) { p.age += real; if (p.age >= p.life) { p.guest = null; p.stand = null; } } }
    var bump = clock < bumpUntil;
    if (bump !== bumped) { bumped = bump; money.style.transform = bump ? 'scale(1.15)' : ''; money.style.backgroundColor = bump ? '#497039' : ''; }
    var w = TF.Events && TF.Events.west;
    if (w && (w !== lastWest || w.phase === 'chat' && westPhase !== 'chat')) {
      emit('west', 2.4, w.x, w.y, w, null); aliUntil = clock + 2.4;
    }
    lastWest = w; westPhase = w ? w.phase : '';
    for (var j = 0; j < Sim.guests.length; j++) {
      var g = Sim.guests[j], waiting = !g.hasTaco && (g.state === 'QUEUE' || g.state === 'WAIT_PICKUP');
      if (!waiting) { g._fxWait = 0; g._fxStage = 0; continue; }
      if (running) g._fxWait = (g._fxWait || 0) + real;
      var wait = Math.max(g.closedT || 0, g.waitT || 0, g._fxWait || 0), desired = wait >= 17 ? 2 : wait >= 7 ? 1 : 0;
      // At least 0.9 real seconds to read each stage, even if the simulation runs at 4x.
      if (desired > (g._fxStage || 0) && clock >= (g._fxStageUntil || 0)) { g._fxStage = (g._fxStage || 0) + 1; g._fxStageUntil = clock + 0.9; }
    }
    for (var s = 0; s < Sim.stands.length; s++) {
      var st = Sim.stands[s]; if (!st.placed) continue;
      var demand = st.cap ? st.queue.length / st.cap : 0;
      demand = Math.max(demand, Math.min(1, st.cook.pending.length / 4));
      if (Sim.cookRate === 0 && st === Sim.stand && st.cook.grill.length) demand = 1;
      if (running) st._fxPressure = Math.max(0, Math.min(1, (st._fxPressure || 0) + (demand > 0.5 ? real * 0.3 : -real * 0.25)));
    }
  };
  F.drawGuest = function (ctx, g, x, y, z) {
    var stage = g._fxStage || 0; if (!stage || g.hasTaco) return;
    ctx.save(); ctx.lineWidth = 2 * z;
    if (stage === 1) {
      // Bent forearm + white watch face, clearly separate from the normal idle pose.
      ctx.strokeStyle = g.skin; ctx.beginPath(); ctx.moveTo(x - 5*z, y - 14*z); ctx.lineTo(x - 8*z, y - 19*z); ctx.lineTo(x - 2*z, y - 20*z); ctx.stroke();
      ctx.fillStyle = '#fff4d6'; ctx.fillRect(x - 5*z, y - 22*z, 4*z, 4*z); ctx.strokeStyle = '#412a20'; ctx.strokeRect(x - 5*z, y - 22*z, 4*z, 4*z);
      project(g.x, g.y, 41); label(ctx, 'WATCH', sx, sy, '#ffe3a2');
    } else {
      var tap = Math.sin(clock * 18) > 0 ? 2*z : 0;
      ctx.fillStyle = '#43271d'; ctx.fillRect(x + 2*z, y - tap, 6*z, 2*z);
      ctx.strokeStyle = '#ef573c'; ctx.beginPath(); ctx.moveTo(x+9*z,y-2*z); ctx.lineTo(x+12*z,y-5*z); ctx.moveTo(x+10*z,y+2*z); ctx.lineTo(x+14*z,y+2*z); ctx.stroke();
      label(ctx, '!', x, y - 53*z, '#ff6545');
    }
    ctx.restore();
  };
  F.drawCrew = function (ctx, it, z) {
    if (it.id !== 'ali' || clock > aliUntil) return;
    project(it.x, it.y, 58); label(ctx, '!', sx, sy - Math.sin(clock * 10) * 2*z, '#ffe78a');
  };
  F.draw = function (ctx) {
    var z = R.cam.z;
    if (z !== lastZ) { lastZ = z; font = 'bold ' + Math.max(10, Math.round(11*z)) + 'px monospace'; }
    ctx.save();
    for (var s = 0; s < Sim.stands.length; s++) {
      var st = Sim.stands[s]; if (!st.placed) continue;
      var pressure = st._fxPressure || 0, pending = st.cook.pending.length, ready = 0;
      for (var q = 0; q < st.pickup.length; q++) if (st.pickup[q] && st.pickup[q].order && st.pickup[q].order.ready && !st.pickup[q].hasTaco) ready++;
      if (st.window && st.window.order && st.window.order.ready && !st.window.hasTaco) ready++;
      // A growing stack of outlined trays follows the real pickup backlog.
      if (ready || pending) {
        var pk = st.geom.pickup[0]; project(pk[0]+0.5, pk[1]+0.5, 16);
        ctx.strokeStyle = '#53321c'; ctx.lineWidth = z;
        for (var t = 0, total = Math.min(5, ready + Math.floor(pending / 2)); t < total; t++) {
          ctx.fillStyle = '#eab94f'; ctx.fillRect(sx-8*z,sy-t*4*z,16*z,3*z); ctx.strokeRect(sx-8*z,sy-t*4*z,16*z,3*z);
          ctx.fillStyle = '#639747'; ctx.fillRect(sx-6*z,sy-(t*4+1)*z,12*z,z);
        }
      }
      if (st.tier >= 1 && (st.cook.grill.length || pending)) {
        project(st.geom.cx, st.geom.cy, 63); var smokeX = sx, smokeY = sy;
        for (var n = 0, count = 2 + Math.floor(pressure*4); n < count; n++) {
          var rise = (clock*13+n*9)%40, size = (3+pressure*4+rise*0.06)*z;
          ctx.globalAlpha = (1-rise/45)*(0.22+pressure*0.25); ctx.fillStyle = pressure > 0.75 ? '#594f48' : '#e1d3b5';
          ctx.fillRect(smokeX+Math.sin(clock+n)*5*z-size/2,smokeY-rise*z,size,size);
        }
        ctx.globalAlpha = 1;
      }
      if (pressure > 0.25) {
        project(st.geom.cx, st.geom.cy, 116);
        var hot = pressure > 0.75; ctx.fillStyle = hot ? '#a83228' : '#a56a24';
        ctx.fillRect(sx-20*z,sy-8*z,40*z,16*z); ctx.strokeStyle = '#fff0ac'; ctx.lineWidth = (hot ? 2 : 1)*z; ctx.strokeRect(sx-20*z,sy-8*z,40*z,16*z);
        label(ctx, hot ? '!!' : '!', sx, sy, hot ? '#fff0ac' : '#ffdb82');
      }
    }
    for (var i = 0; i < CAP; i++) {
      var p = pool[i]; if (p.age >= p.life) continue;
      var k = p.age / p.life;
      ctx.globalAlpha = Math.min(1, (1-k)*5);
      if (p.type === 'cash') {
        project(p.x,p.y,22); var x = sx, y = sy, slide = Math.sin(Math.min(1,k*2)*Math.PI)*6*z;
        ctx.fillStyle = '#402a22'; ctx.fillRect(x-8*z,y-4*z,16*z,8*z); ctx.fillStyle = '#aa9470'; ctx.fillRect(x-7*z,y+slide,14*z,4*z); ctx.strokeStyle = '#36251f'; ctx.lineWidth = z; ctx.strokeRect(x-7*z,y+slide,14*z,4*z);
        ctx.fillStyle = '#ffd14c'; ctx.strokeStyle = '#8e551d'; ctx.beginPath(); ctx.ellipse(x,y-12*z-Math.sin(k*Math.PI)*17*z,4*z,6*z,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
        label(ctx,'CHA-CHING',x,y-42*z-k*8*z,'#ffdf71');
      } else if (p.type === 'premium') {
        project(p.x,p.y,49+k*20); label(ctx,'+$1 PREMIUM',sx,sy,'#ffd44e');
      } else if (p.type === 'taco') {
        var travel = Math.min(1,p.age/0.75), gx = p.guest ? p.guest.x : p.x1, gy = p.guest ? p.guest.y : p.y1;
        project(p.x+(gx-p.x)*travel,p.y+(gy-p.y)*travel,19+Math.sin(travel*Math.PI)*30+(travel === 1 ? Math.sin((p.age-0.75)/0.6*Math.PI)*10 : 0));
        if (travel === 1 && p.guest) { ctx.strokeStyle = p.guest.skin; ctx.lineWidth = 3*z; ctx.beginPath(); ctx.moveTo(sx+5*z,sy+8*z); ctx.lineTo(sx,sy); ctx.stroke(); }
        TF.Render.drawTaco(ctx,sx,sy,1.7*z);
      } else if (p.type === 'balk') {
        project(p.guest ? p.guest.x : p.x,p.guest ? p.guest.y : p.y,48+k*6); label(ctx,'! WALKED OUT',sx,sy,'#ff8564');
      } else if (p.type === 'west') {
        project(p.guest ? p.guest.x : p.x,p.guest ? p.guest.y : p.y,18); var wx = sx, wy = sy;
        // Purse opens then snaps shut; the clasp gets a sharp white flash.
        var open = p.age < 0.6 ? (1-p.age/0.6)*5*z : 0;
        ctx.fillStyle = '#8b3145'; ctx.strokeStyle = '#3b2026'; ctx.lineWidth = 2*z; ctx.fillRect(wx+5*z,wy-7*z,11*z,9*z); ctx.strokeRect(wx+5*z,wy-7*z,11*z,9*z);
        ctx.beginPath(); ctx.moveTo(wx+6*z,wy-8*z); ctx.lineTo(wx+10*z,wy-12*z-open); ctx.lineTo(wx+15*z,wy-8*z); ctx.stroke();
        ctx.fillStyle = '#ffe5a3'; ctx.fillRect(wx+9*z,wy-8*z,3*z,2*z);
        for (var a = 0; a < 5; a++) { var angle = a*Math.PI*0.4+clock*0.8, xx = wx+Math.cos(angle)*22*z, yy = wy-18*z+Math.sin(angle)*22*z; ctx.fillStyle = '#fff0a0'; ctx.fillRect(xx-3*z,yy,7*z,z); ctx.fillRect(xx,yy-3*z,z,7*z); }
        label(ctx,p.age < 0.6 ? 'MRS. WEST' : 'SNAP!',wx,wy-53*z,'#ffe68f');
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };
})(window.TF);
