// The Campus Cast in the game (Pass 6 chunk 3A): the core six (src/data/cast.js) plus the 14 extras
// (src/data/cast-extra.js, sheets in assets/cast-extra) merged into TF.CAST.chars; each OPEN day's cast comes
// from the 20-day calendar (TF.Calendar.castFor on its own seeded stream); up to 3 walk the map at once,
// drawn from per-character keyed atlases. Gameplay effects, all through the ledger in integer cents:
// President Maroonfield's inspection (pass = $40 grant; fail = $25 beautification fee; a President Pass favor
// auto-passes), Prof. Bigorder's bulk order (8 tacos, cuts the line politely), Brendan's IOU (no wallet: with
// Aaron hired he runs a tab, repaid on Day 20; without, a lost sale). The pure parts are exported for tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else { root.TF = root.TF || {}; root.TF.CastExtra = factory(root.TF); }
}(typeof window !== 'undefined' ? window : this, function (TF) {
  'use strict';
  // PLAN_PASS6 §7b for the 14 (behavior / effect / when / joke)
  var INFO = {
    tourGuide: ['Leads 6-8 walkers past the stand', 'Parents buy a taco 50% of the time; visible trash costs West mood', 'Wk1 & Wk2', 'And to your left: the taco guys. We don’t talk about them.'],
    marchingBand: ['Marches across the parade route', 'Blocks a walk for 8 s, then 2x crowd for 30 s', 'Day 10 Spirit Parade, Gala', 'The sousaphone player orders through the bell.'],
    strutters: ['Precision kick line through the Quad', '+25% draw for 15 s; Ali’s rant ends instantly', 'Day 10, Gala', 'Ali starts a slow clap and forgets the grill.'],
    raDana: ['Escorts a herd of freshmen', 'Group order of 6 on move-in Mondays; confiscates the cannon for a day', 'Wk1, Day 16', 'This is a community-building moment.'],
    chadAndChad: ['Arrive in pairs, loud', 'Order 4 each on game day; 20% chance they tip a trash can', 'Wk2', 'Bro. BRO. Tacos.'],
    sororityWave: ['Wave of 10 walkers in matching tees', '+10 customers in 20 s; photos with the banner', 'Wk1 Day 4', 'Chants your menu back to you.'],
    flyerKevin: ['Hands flyers to everyone', 'Litter +3 unless trash cans are near; Day 12 flyers for SIFE free', 'Wk1-3', 'President of 11 clubs, member of none.'],
    theaterKid: ['Performs a monologue at the Stallions', 'Draws a crowd of 5 that may buy', 'Wk2', 'Orders “a taco, but make it Chekhov.”'],
    gymBro: ['Speed-walks the loop twice', 'Orders double protein; complains if the grill sputters', 'Daily cameo', 'Asks for the macros on a tortilla.'],
    scooterSpeeder: ['Zips across paths fast', '10% chance of knocking a customer out of line', 'Wk2-4', 'Didn’t stop. Yelled “SORRY” in Doppler.'],
    officerRhonda: ['Patrols the food truck pad', 'Tickets an unpermitted food truck $15', 'Wk4', 'Gives a ticket to a grackle. The grackle pays.'],
    taNoSleep: ['Wanders slowly, stops at random', 'Buys 1 taco + 1 drink; NAPZ +5 Rise % tomorrow', 'Wk3-4', 'I’ve been grading since Tuesday. What day is it?'],
    lukas: ['Photographs everything', 'First visit buys one of everything; becomes a regular', 'Wk1 -> Day 19', 'Thinks the grackles are a protected species “because they act like it.”'],
    moveInParents: ['Linger, ask directions', 'Big tippers (+$3) but slow orders', 'Days 1-2', 'Is this a meal plan thing?']
  };
  // the calendar's short ids -> TF.CAST.chars ids
  var ALIAS = { dana: 'raDana', kevin: 'flyerKevin', chads: 'chadAndChad', sorority: 'sororityWave', scooter: 'scooterSpeeder', band: 'marchingBand', ta: 'taNoSleep', rhonda: 'officerRhonda', bigGreg: 'biggreg' };
  function id(x) { return ALIAS[x] || x; }

  // TF.CAST.chars += the 14 extras (with their behavior / effect / when / joke); the later6E stubs go
  function merge(cast, extra) {
    if (!cast || !extra) return cast;
    extra.extra14.forEach(function (k) {
      var c = extra.chars[k], i = INFO[k] || [];
      if (!c) return;
      cast.chars[k] = Object.assign({}, c, { behavior: i[0] || '', effect: { text: i[1] || '' }, when: i[2] || '', joke: i[3] || '', stage: '6E', regular: k === 'lukas' || k === 'flyerKevin' });
    });
    cast.later6E = [];
    return cast;
  }

  // ---- effects (pure; money as {cat, cents} rows) -----------------------------------------------------
  // Inspection: 100 points less trash, open breakdowns, a full / overflowing line and an empty stand; pass >= 60.
  function inspect(o) {
    if (o.presidentPass) return { score: 100, pass: true, auto: true, row: { cat: 'grant', cents: 4000, ref: 'President’s inspection (President Pass)' } };
    var score = 100 - Math.min(40, (o.litter || 0) * 5) - Math.min(30, (o.faults || 0) * 15) - (o.lineFull ? 20 : 0) - (o.stock > 0 ? 0 : 25);
    score = Math.max(0, score);
    var pass = score >= 60;
    return { score: score, pass: pass, auto: false, row: pass ? { cat: 'grant', cents: 4000, ref: 'President’s inspection: pass' } : { cat: 'beautify', cents: -2500, ref: 'Beautification fee (inspection fail)' } };
  }
  // Bulk order: 8 tacos at today's price, as many as the stand has kits for
  function bulk(kits, priceCents) {
    var n = Math.max(0, Math.min(8, kits));
    return { tacos: n, row: n ? { cat: 'sales', cents: n * priceCents, ref: 'Prof. Bigorder: bulk order x' + n } : null };
  }
  // Brendan: with Aaron hired he runs a tab; otherwise it's a lost sale. Day 20 he pays the whole tab back.
  function iou(state, aaron, priceCents, day, kits) {
    if (kits !== undefined && kits < 1) return null;
    if (!aaron) { state.lost++; return null; }
    state.owed += priceCents; state.visits.push(day);
    return { owed: state.owed };
  }
  function repay(state) {
    if (!state.owed) return null;
    var row = { cat: 'sales', cents: state.owed, ref: 'Brendan pays his IOU (' + state.visits.length + ' tacos)' };
    state.repaid += state.owed; state.owed = 0;
    return row;
  }
  // Inspection rewards shift tomorrow's WEST Rise %, never Gala mood.
  var WEST_PASS = 15;
  // Selling n tacos at `unit` cents from what the stand has (kits); the sale row is integer cents.
  function sell(kits, n, unit, who) { var k = Math.max(0, Math.min(n, kits)); return { tacos: k, row: k ? { cat: 'sales', cents: k * unit, ref: who + ' x' + k } : null }; }
  // The other 14 (§7b, one small effect each). c = { kits, price, prices:{cheap,fair,bougie}, trashNear, litterNear,
  // first (first visit), roll (0..1 from the cast stream) }. Returns what happens; the game applies it.
  var EFFECTS = {
    tourGuide: function (c) { return { sale: sell(c.kits, 3, c.price, 'Tour group parents'), mood: c.litterNear ? -1 : 0 }; },       // 6 parents, half buy; visible trash: West -1
    marchingBand: function () { return { demand: { mul: 2, secs: 30 } }; },                                                              // 2x crowd for 30 s
    strutters: function () { return { demand: { mul: 1.25, secs: 15 }, endRant: true }; },                                              // +25% draw 15 s; Ali's rant ends
    raDana: function (c) { return { sale: sell(c.kits, 6, c.price, 'RA Dana\u2019s freshmen') }; },                                    // group order of 6
    chadAndChad: function (c) { return { sale: sell(c.kits, 8, c.price, 'Chad & Chad'), tipTrash: c.roll < 0.2 }; },                    // 4 each; 20% they tip a can
    sororityWave: function () { return { spawn: 10 }; },                                                                                  // +10 customers
    flyerKevin: function (c) { return { litter: c.trashNear ? 0 : 3 }; },                                                              // +3 litter unless a can is near
    theaterKid: function () { return { spawn: 5 }; },                                                                                     // a crowd of 5 that may buy
    gymBro: function (c) { return { sale: sell(c.kits, 2, c.price, 'Gym Bro (double order)') }; },                               // double protein: double price
    scooterSpeeder: function (c) { return { knock: c.roll < 0.1 }; },                                                                    // 10%: one customer knocked out of line
    // a $15 ticket for an unpermitted cart: on L2-L4 a stand outside the level's stand slots, or a food truck without its pad
    officerRhonda: function (c) { return (c.truck && !c.truckPad) || c.unpermitted ? { rows: [{ cat: 'permit', cents: -1500, ref: 'Officer Rhonda: ticket (' + (c.unpermitted ? 'stand off the permitted slots' : 'food truck, no pad') + ')' }] } : {}; },
    taNoSleep: function (c) { var t = sell(c.kits, 1, c.price, 'The TA'); return { sale: t, rows: t.tacos ? [{ cat: 'drinks', cents: 200, ref: 'The TA: energy drink' }] : [] }; },
    lukas: function (c) { return { sale: sell(c.kits, c.first ? 3 : 1, c.price, c.first ? 'Lukas: one of everything' : 'Lukas (regular)') }; },
    moveInParents: function (c) { var t = sell(c.kits, 1, c.price, 'Move-in parents'); return { sale: t, rows: t.tacos ? [{ cat: 'tips', cents: 300, ref: 'Move-in parents tip' }] : [] }; }
  };
  var pure = { INFO: INFO, ALIAS: ALIAS, id: id, merge: merge, inspect: inspect, bulk: bulk, iou: iou, repay: repay, EFFECTS: EFFECTS, sell: sell, WEST_PASS: WEST_PASS };
  if (!TF || !TF.Sim) return pure;

  // ---- in the game ----------------------------------------------------------------------------------------
  var Sim = TF.Sim, World = TF.World, R = TF.Render;
  var CX = Object.assign(pure, { met: {}, effects: [], demandT: 0, demandMul: 1, brendan: { owed: 0, repaid: 0, lost: 0, visits: [] }, today: [], walkers: [], log: [], inspections: [], atlases: {}, day: 0 });
  if (TF.CAST && TF.CAST_EXTRA) merge(TF.CAST, TF.CAST_EXTRA);
  // Roster picks use a day-keyed local stream (exactly 4 draws per castFor). Chance rolls and walk
  // exits use TF.Rng.streams.cast, which is saved/restored with the game so replay matches.
  function seed() { return ((TF.Rng ? TF.Rng.seed : 7) ^ 0xCA57) >>> 0; }
  function stream(seed) { var s = seed >>> 0; return { next: function () { s = (s + 0x6D2B79F5) >>> 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } }; }
  function roll() { return TF.Rng && TF.Rng.cast ? TF.Rng.cast() : stream(seed()).next(); }
  function abs() { return TF.Econ && TF.Econ.abs ? TF.Econ.abs(TF.Week.day) : TF.Week.day; }
  CX.castFor = function (n) {
    if (!TF.Calendar) return [];
    return TF.Calendar.castFor(n, stream(seed() + n * 7919)).map(id).filter(function (k) { return TF.CAST && TF.CAST.chars[k]; });
  };
  function post(row, who) { if (row) TF.postTransaction({ cat: row.cat, cents: row.cents, ref: row.cat === 'sales' ? 'cast:' + who + ' ' + row.ref : row.ref }); }
  function stand() { return Sim.stand; }

  // Brendan's tab, who we've met (Lukas first visit), inspections, and any live demand buff.
  CX.getState = function () {
    return JSON.parse(JSON.stringify({
      brendan: CX.brendan, met: CX.met, inspections: CX.inspections,
      demandMul: CX.demandMul, demandT: CX.demandT
    }));
  };
  CX.setState = function (s) {
    s = JSON.parse(JSON.stringify(s || { brendan: { owed: 0, repaid: 0, lost: 0, visits: [] }, met: {}, inspections: [] }));
    CX.brendan = s.brendan; CX.met = s.met || {}; CX.inspections = s.inspections || [];
    CX.demandMul = typeof s.demandMul === 'number' ? s.demandMul : 1;
    CX.demandT = typeof s.demandT === 'number' ? s.demandT : 0;
    CX.walkers = []; CX.day = 0;
  };
  CX.openDay = function () {
    var n = abs();
    CX.day = n; CX.walkers = []; CX.demandMul = 1; CX.demandT = 0;
    CX.today = Array.from(new Set(CX.castFor(n))).slice(0, 3);
    CX.today.forEach(function (k, i) { CX.walkers.push({ id: k, at: 15 + i * 40, state: 'wait', path: [], x: 0, y: 0, px: 0, py: 0, t: 0, said: '' }); });
    if (n === 20) post(repay(CX.brendan), 'brendan');   // Day 20: Brendan's Venmo finally clears
  };
  // Exit pick advances the cast stream (not Math.random): arrival paths affect when sales land.
  function exitPt() {
    var exits = World.exits;
    if (!exits || !exits.length) return { x: 0.5, y: 0.5 };
    var e = exits[Math.floor(roll() * exits.length) % exits.length];
    return { x: e.x + 0.5, y: e.y + 0.5 };
  }
  function walkTo(w, to) {
    var t = World.astar(Math.floor(w.x), Math.floor(w.y), Math.floor(to.x), Math.floor(to.y));
    w.path = t ? t.slice(1).map(function (p) { return { x: p.x + 0.5, y: p.y + 0.5 }; }) : [];
  }
  function arrive(w) {
    var st = stand(), k = w.id, E = TF.Econ;
    var lines = TF.CAST.chars[k] && TF.CAST.chars[k].joke;
    if (TF.CastLines) lines = (CX.met[k] && TF.CastLines.memory[k] ? TF.CastLines.memoryLine(TF.CastLines.memory[k], stream(seed() + CX.day)) : TF.CastLines.bark(k, stream(seed() + CX.day))) || lines;
    if (k === 'maroonfield') {
      if (CX.inspections.some(function (x) { return x.day === CX.day; })) { w.said = 'Inspection already recorded.'; return; }
      var H = TF.Handyman, pass = !!(E && E.M && E.M.hasFavor('presidentPass'));
      if (pass) E.M.consumeFavor('presidentPass');
      var r = inspect({ presidentPass: pass, litter: TF.Objects ? TF.Objects.litter.length : 0, faults: H && H.S ? H.S.faults.length : 0, lineFull: st.cap > 0 && st.queue.length >= st.cap, stock: st.stock });
      post(r.row); CX.inspections.push({ day: CX.day, score: r.score, pass: r.pass, auto: r.auto });
      if (r.pass && TF.Market) TF.Market.scheduleCatalyst({ sym: 'WEST', type: 'inspection', day: CX.day + 1, shift: r.auto ? 10 : WEST_PASS });
      w.said = r.pass ? 'Pass. The stand meets code. Carry on.' : 'Fail. Fix it before I return.';
      Sim.events.push({ type: 'toast', text: '🎓 Inspection ' + (r.pass ? 'PASSED' : 'failed') + ' (' + r.score + '/100): ' + (r.pass ? '+$40 grant' : '−$25 beautification fee') });
    } else if (k === 'bigorder') {
      var b = bulk(E && E.on() ? E.kits(st) : st.stock, E && E.on() ? E.K.price() : 550);
      if (b.tacos) {
        post(b.row, k); Sim.stats.served += b.tacos;
        if (E && E.on()) { if (st.idx === 0) { var ks = E.state(); ks.standKits -= b.tacos; E.K.setState(ks); } else st.ekits -= b.tacos; E.sync(); }
        else st.stock -= b.tacos;
      }
      var waiting = E && E.on() && E.stockStatus && !E.soldOutAll(st);
      w.said = b.tacos ? 'Eight tacos. B+, see me.' : waiting ? 'Restocking? I will come back.' : 'Sold out? See me after class.';
      Sim.events.push({ type: 'toast', text: '📚 Prof. Bigorder steps to the front (politely): ' + (b.tacos ? b.tacos + ' tacos, +$' + (b.row.cents / 100).toFixed(2) : waiting ? 'restocking…' : 'sold out') });
    } else if (k === 'brendan') {
      var aaron = !!(TF.Crew && TF.Crew.hiredSet.aaron), o = iou(CX.brendan, aaron, E && E.on() ? E.K.price() : 550, CX.day, E && E.on() ? E.kits(st) : st.stock);
      if (o) {
        applyEffect(k, { sale: { tacos: 1, row: null } });
        if (CX.day === 20) post(repay(CX.brendan), 'brendan'); // a finale-day visit clears with today's tab too
      }
      w.said = o ? 'Put it on my tab? I’ll Venmo you.' : 'I’ll Venmo you. Promise.';
    } else if (EFFECTS[k]) { applyEffect(k, EFFECTS[k](ctxFor(k))); w.said = lines || ''; }
    else w.said = lines || '';
    CX.log.push({ day: CX.day, id: k });
  }
  // the situation an effect sees, and applying its outcome (sales take the stand's kits)
  function ctxFor(k) {
    var st = stand(), E = TF.Econ, on = E && E.on(), O = TF.Objects, g = st.geom || { cx: 0, cy: 0 };
    var near = function (x, y) { return Math.hypot(x - g.cx, y - g.cy) <= 4; };
    return { kits: on ? E.kits(st) : st.stock, price: on ? E.K.price() : 550, prices: on ? E.level().prices : { cheap: 400, fair: 550, bougie: 800 },
      trashNear: !!(O && O.list.some(function (o) { return o.kind === 'trash' && o.ready && near(o.x + 0.5, o.y + 0.5); })),
      litterNear: !!(O && O.litter.some(function (l) { return near(l.x, l.y); })),
      first: !CX.met[k], roll: roll(), truck: false, truckPad: false,
      unpermitted: (TF.Econ && TF.Econ.levelNo >= 2) && Sim.stands.some(function (x) { return x.placed && !permitted(x); }) };
  }
  // permitted = on (or overlapping) one of the level's stand slots
  function permitted(st) {
    var slots = World.standSlots || [];
    return !slots.length || slots.some(function (sl) { return Math.abs(sl.x - st.sx) <= 1 && Math.abs(sl.y - st.sy) <= 1; });
  }
  function applyEffect(k, o) {
    var st = stand(), E = TF.Econ;
    if (o.sale && o.sale.tacos) {
      post(o.sale.row, k); Sim.stats.served += o.sale.tacos;
      if (E && E.on()) { if (st.idx === 0) { var ks = E.state(); ks.standKits -= o.sale.tacos; E.K.setState(ks); } else st.ekits -= o.sale.tacos; E.sync(); }
      else st.stock -= o.sale.tacos;
    }
    (o.rows || []).forEach(post);
    if (k === 'officerRhonda' && o.rows && o.rows.length) Sim.events.push({ type: 'toast', text: 'Officer Rhonda: $15 ticket - no permit here' });
    if (o.mood && E && E.M) { var ws = E.M.getState(); ws.mood = Math.max(0, Math.min(10, ws.mood + o.mood)); E.M.setState(ws); }
    if (o.demand) { CX.demandMul = o.demand.mul; CX.demandT = o.demand.secs; }
    if (o.endRant && TF.Arcs) TF.Arcs.rant = null;
    var exits = World.exits;
    for (var i = 0; i < (o.spawn || 0) && exits.length; i++) Sim.spawnGuest(exits[i % exits.length]);
    if (o.litter && TF.Objects) for (i = 0; i < o.litter; i++) TF.Objects.litter.push({ x: (st.geom ? st.geom.cx : 0) + (i - 1) * 0.8, y: (st.geom ? st.geom.cy : 0) + 1.6, t: 0, rot: i, col: '#f4efe4' });
    if (o.tipTrash && TF.Objects) { var can = TF.Objects.list.filter(function (x) { return x.kind === 'trash' && x.ready; })[0]; if (can) TF.Objects.litter.push({ x: can.x + 1, y: can.y + 1, t: 0, rot: 2, col: '#ffd23a' }); }
    if (o.knock && st.queue.length > 1) { var g = st.queue.pop(); Sim.loseSale(g, st, 'gave up waiting'); Sim.leavePolitely(g); }   // knocked out of line
    CX.met[k] = true;   // regulars remember (Lukas's first visit is the big one)
    CX.effects.push({ day: CX.day, id: k });
  }
  CX.applyEffect = function (k) { applyEffect(k, EFFECTS[k](ctxFor(k))); };   // tests / debug
  CX.step = function (dt) {
    var W = TF.Week;
    if (CX.demandT > 0) { CX.demandT -= dt; if (CX.demandT <= 0) CX.demandMul = 1; }
    if (!W || !W.active() || (W.phase !== 'open' && W.phase !== 'close')) return;
    if (CX.day !== abs()) CX.openDay();
    var out = CX.walkers.filter(function (w) { return w.state !== 'wait' && w.state !== 'gone'; }).length;
    CX.walkers.forEach(function (w) {
      w.px = w.x; w.py = w.y;
      if (w.state === 'wait') {
        if (W.t >= w.at && out < 3 && stand().placed) { var e = exitPt(); w.x = w.px = e.x; w.y = w.py = e.y; walkTo(w, Sim.door ? Sim.door(stand()) : { x: stand().geom.cx, y: stand().geom.cy }); w.state = 'in'; out++; }
        return;
      }
      if (w.state === 'gone') return;
      if (w.state === 'stay') { w.t -= dt; if (w.t <= 0) { w.state = 'out'; walkTo(w, exitPt()); } return; }
      var p = w.path[0];
      if (!p) { if (w.state === 'in') { arrive(w); w.state = 'stay'; w.t = 6; } else w.state = 'gone'; return; }
      var dx = p.x - w.x, dy = p.y - w.y, d = Math.hypot(dx, dy), v = 1.6 * dt;
      if (d <= v) { w.x = p.x; w.y = p.y; w.path.shift(); } else { w.x += dx / d * v; w.y += dy / d * v; }
      w.hx = dx; w.hy = dy;
    });
  };

  // ---- drawing: one keyed atlas per character (toward / away walk frames), built on first sight --------------
  function sheetImage(k, cb) {
    var c = TF.CAST.chars[k], name = c && c.sheet, src = TF.ART_SRCS && TF.ART_SRCS[name];
    if (!name) return;
    if (!src && location.protocol === 'file:' && !document.getElementById('castjs-' + name)) {   // file://: the data-URL script, on demand
      var sc = document.createElement('script'); sc.id = 'castjs-' + name; sc.src = (k in INFO ? 'assets/cast-extra/' : 'assets/gemini/') + name + '.js';
      sc.onload = function () { sheetImage(k, cb); }; document.head.appendChild(sc); return;
    }
    if (!src) src = (k in INFO ? 'assets/cast-extra/' : 'assets/gemini/') + name + '.webp';
    var im = new Image(); im.onload = function () { cb(im); }; im.src = src;
  }
  function atlas(k) {
    var a = CX.atlases[k];
    if (a) return a.ready ? a : null;
    CX.atlases[k] = a = { ready: false };
    sheetImage(k, function (im) {
      var c = TF.CAST.chars[k], f = c.frames, looks = [];
      ['toward', 'away'].forEach(function (set) {
        if (f[set] && f[set].length) looks.push({ height: c.h, frames: f[set].map(function (r) { return { image: im, x: r.x, y: r.y, w: r.w, h: r.h, ax: r.ax, ay: r.ay }; }) });
      });
      var built = TF.Crowd.Draw.buildAtlas(looks, { personHeight: c.drawPx || 31 });
      a.looks = built.looks; a.ready = true;
    });
    return null;
  }
  CX.items = function (items, alpha, ui) {
    if (ui && (ui.noGuests || ui.onlyPieces || ui.bare)) return;
    CX.walkers.forEach(function (w) {
      if (w.state === 'wait' || w.state === 'gone' || !atlas(w.id)) return;
      var x = w.px + (w.x - w.px) * alpha, y = w.py + (w.y - w.py) * alpha;
      items.push({ kind: 'cast', plugin: CX, w: w, x: x, y: y, k: x + y });
    });
  };
  CX.draw = function (ctx, it, z) {
    var w = it.w, a = CX.atlases[w.id], p = R.toScreen(it.x, it.y), vx = (w.hx || 0) - (w.hy || 0), vy = (w.hx || 0) + (w.hy || 0);
    var look = a.looks[vy >= 0 || a.looks.length < 2 ? 0 : 1], mirror = vy >= 0 ? vx < 0 : vx > 0;
    var set = mirror ? look.mirrored : look.frames, fr = set[w.state === 'stay' ? 0 : Math.floor(performance.now() / 160) % set.length];
    ctx.drawImage(fr.sheet, fr.sx, fr.sy, fr.sw, fr.sh, p.x - fr.ax * z, p.y - fr.ay * z, fr.width * z, fr.height * z);
    if (w.state === 'stay' && w.said) {
      var gate = TF.SpeechGate, st = gate ? gate.begin(w.said, { critical: true, secs: 4 }) : 'live';
      if (st === 'live' || (gate && gate.allows(w.said))) {
        R.speech(w.said, p.x, p.y - 44 * z, 12 * z, 'rgba(60,30,20,0.95)');
      }
    }
  };
  // a new level / day: nobody from yesterday is still walking
  if (World.onLoad) World.onLoad.push(function () { CX.walkers = []; CX.day = 0; CX.demandMul = 1; CX.demandT = 0; });
  TF.plugins.push(CX);
  return CX;
}));
