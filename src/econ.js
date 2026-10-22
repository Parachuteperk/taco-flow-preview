// Taco Week economy (Pass 6A C3): wires the rules layer (src/stock.js = TF.Stock, src/west.js = TF.West,
// data/economy.js) into the game. Only in Taco Week; Free Play keeps the old free restocks.
//   STOCK: taco kits are ordered in PREP at the level's kit cost (RUSH during OPEN: +20%, 20 s delivery),
//   wait in the van, and the stand holds up to stockMax; restock walks bring them from the van. Every
//   sale goes through K.trySell (price tier, too pricey, sold out). Leftovers spoil at close (reported).
//   PRICE: Cheap / Fair / Bougie per level.
//   RENT: Mrs. West's rent is due Friday; the meter is always on the HUD; Friday REPORT auto-pays.
(function (TF) {
  var Sim = TF.Sim, $ = function (id) { return document.getElementById(id); };
  var EC = { K: null, M: null, last: null, spoil: [], rent: null, autoOrders: [] };
  EC.on = function () { return !!(EC.K && TF.Week && TF.Week.active()); };

  function cash() { return TF.Ledger.cash; }
  EC.init = function () {
    if (!(TF.Week && TF.Week.active() && TF.Stock && TF.West)) return;
    EC.K = TF.Stock.create({ level: 1, postTransaction: TF.postTransaction, getCash: cash, stockMax: Sim.stand.mods.stockMax || 10 });
    EC.M = TF.West.create({ postTransaction: TF.postTransaction, getCash: cash, hard: false });
    EC.M.startLevel(1);
    EC.K.setPhase('prep', EC.abs(TF.Week.day));
  };
  EC.state = function () { return EC.K ? EC.K.getState() : null; };
  // Each stand has its own kits + capacity; only the van is shared. Stand 1's kits live in the rules
  // layer (K.standKits); stand 2 keeps its own count (st.ekits) and refills from the same van.
  EC.kits = function (st) { st = st || Sim.stand; return st.idx === 0 ? EC.state().standKits : (st.ekits || 0); };
  function pendingKits(s) { return s.pending.reduce(function (a, p) { return a + p.kits; }, 0); }
  EC.kitsLeft = function () { var s = EC.state(); return s ? s.standKits + s.vanKits + pendingKits(s) + Sim.stands.slice(1).reduce(function (a, st) { return a + (st.ekits || 0); }, 0) : 0; };
  EC.soldOutAll = function (st) { var s = EC.state(); return !!s && EC.kits(st) === 0 && s.vanKits === 0 && !s.pending.length; };
  function setVan(n) { var s = EC.state(); s.vanKits = n; EC.K.setState(s); }
  EC.priceDollars = function () { return EC.K.price() / 100; };

  // ---- Week hooks (week.js) -------------------------------------------------------------------
  EC.openDay = function (day) {
    if (!EC.on()) return;
    // Day 1 kindness: opening with no kits at all, Jared orders the suggested amount for you.
    if (day === 1 && EC.kitsLeft() === 0) {
      var sg = EC.K.suggestOrder({ yesterdaySold: null });
      if (sg.kits && cash() >= sg.kits * EC.level().kitCents) { EC.K.order(sg.kits); EC.autoOrders.push({ day: day, kits: sg.kits }); Sim.events.push({ type: 'toast', text: '📦 Jared ordered ' + sg.kits + ' taco kits for you (' + sg.text + ')' }); }
    }
    EC.K.setPhase('open', EC.abs(day));
    // the van's kits fill every stand as you open, one kit at a time round the stands so a new stand 2
    // isn't left empty behind stand 1's 40-kit grill (C3c / C4: phone Day 4 stand 2 sold 0, NO STOCK 200 s)
    var placed = Sim.stands.filter(function (st) { return st.placed; });
    for (var moved = true; moved && EC.state().vanKits > 0;) {
      moved = false;
      placed.forEach(function (st) { if (EC.state().vanKits > 0 && EC.kits(st) < (st.mods.stockMax || 10)) { EC.refillOne(st); moved = true; } });
    }
    EC.sync();
  };
  EC.endDay = function (day) {
    if (!EC.on()) return null;
    EC.K.setPhase('report', EC.abs(day));
    var sp = EC.K.closeDay();
    var out = { spoiledKits: sp.spoiledKits, spoiledCents: sp.spoiledCostCents, kept: sp.kept, rent: null };
    Sim.stands.slice(1).forEach(function (st) {   // stand 2's leftovers spoil at the same rate
      var sp2 = Math.round((st.ekits || 0) * EC.level().spoilage);
      st.ekits -= sp2; out.spoiledKits += sp2; out.spoiledCents += sp2 * EC.level().kitCents; out.kept += st.ekits;
    });
    if (TF.Mkt) out.market = TF.Mkt.closeDay();   // the Exchange's pre-rolled closes land (C5)
    if (((day - 1) % 5) + 1 === 5) out.rent = EC.rent = EC.M.fridayReport(EC.abs(day));
    EC.last = out; EC.spoil.push(out);
    EC.sync();
    return out;
  };
  EC.nextDay = function (day) { if (EC.on()) { EC.K.setPhase('prep', EC.abs(day)); EC.sync(); if (TF.Mkt) TF.Mkt.openDay(); } };
  // Week days are level-local (1-5); West and Stock count campaign days (L2 Monday = day 6) (C3c).
  EC.levelNo = 1;
  EC.abs = function (day) { return (EC.levelNo - 1) * 5 + day; };
  EC.level = function () { return TF.Economy.levels[(EC.state() || { level: 1 }).level - 1]; };

  // ---- Sim hooks -------------------------------------------------------------------------------
  // A sale at the window: priced by the tier, posted to the ledger. {dollars} or {reason: 'soldOut' |
  // 'tooPricey'} (the price can go up while someone waits in line).
  EC.sell = function (g) {
    var st = g.st || Sim.stand, r;
    if (st.idx === 0) r = EC.K.trySell(Math.round(g.maxPay * 100));
    else {   // stand 2: same tier price, its own kits
      var price = EC.K.price();
      if (!st.ekits) r = { sold: false, reason: 'soldOut' };
      else if (Math.round(g.maxPay * 100) < price) r = { sold: false, reason: 'tooPricey' };
      else { TF.postTransaction({ day: TF.Week.day, phase: 'open', cat: 'sales', cents: price, ref: EC.state().tier + ' (stand 2)' }); st.ekits--; r = { sold: true, cents: price }; }
    }
    EC.sync();
    return r.sold ? { dollars: r.cents / 100 } : { reason: r.reason };
  };
  // Restock walk finished (Jared / the runner / the cashier): bring kits from the shared van.
  EC.refill = function (st) {
    if (!EC.on()) return;
    st = st || Sim.stand;
    if (st.idx === 0) EC.K.refill();
    else {
      var s = EC.state(), take = Math.min(s.vanKits, Math.max(0, (st.mods.stockMax || 10) - (st.ekits || 0)));
      setVan(s.vanKits - take); st.ekits = (st.ekits || 0) + take;
    }
    EC.sync(); return EC.kits(st);
  };
  EC.refillOne = function (st) {   // one kit van -> stand (fair split at OPEN)
    var s = EC.state();
    if (!s.vanKits) return;
    if (st.idx === 0) { s.vanKits--; s.standKits++; EC.K.setState(s); } else { setVan(s.vanKits - 1); st.ekits = (st.ekits || 0) + 1; }
  };
  EC.needsRefill = function (st) { st = st || Sim.stand; return EC.state().vanKits > 0 && EC.kits(st) <= (st.mods.stockMax || 10) * 0.25; };
  EC.sync = function () { Sim.stands.forEach(function (st) { if (st.placed) st.stock = EC.kits(st); }); };
  // Push the Line uses up extra ingredients (0.15 kit a sale): it adds up, and whole kits leave that stand.
  EC.wasted = 0;
  EC.waste = function (kits, st) {
    st = st || Sim.stand;
    st.wasteAcc = (st.wasteAcc || 0) + kits;
    while (st.wasteAcc >= 1 - 1e-9 && EC.kits(st) > 0) {
      st.wasteAcc -= 1; EC.wasted++;
      if (st.idx === 0) { var s = EC.state(); s.standKits--; EC.K.setState(s); } else st.ekits--;
    }
    EC.sync();
  };
  // Walk-aways today (all of them, not just the ones at the window), for the STOCK panel.
  EC.lostToday = function (why) { var W = TF.Week, b = W.today && W.today.lost; return Sim.lost[why] - (b ? b[why] || 0 : 0); };
  // A new level: stand upgrades, kits, pending deliveries and the rent record start over (cash carries over).
  EC.resetLevel = function (level) {
    if (!EC.K) return;
    EC.levelNo = level || 1;
    EC.K.setLevel(EC.levelNo); EC.M.startLevel(EC.levelNo); EC.rent = null;
    if (TF.Mkt) TF.Mkt.resetLevel();
    Sim.stands.forEach(function (st) { st.ekits = 0; st.wasteAcc = 0; });
    EC.sync();
  };
  // The week's outcome is the rent (PLAN §1b): paid on Friday = level passed.
  EC.rentPaid = function () { return !!(EC.rent && EC.rent.paid); };
  EC.step = function (dt) {
    if (!EC.on()) return;
    var W = TF.Week;
    if (W.phase === 'open' || W.phase === 'close') {
      if (EC.K.tick(dt)) Sim.events.push({ type: 'toast', text: '🚚 Rush kits arrived at the van!' });
    }
    var max = Sim.stand.mods.stockMax;
    if (EC.state().stockMax !== max) EC.K.setStockMax(max);
    Sim.stands.slice(1).forEach(function (st) { var m = st.mods.stockMax || 10; if ((st.ekits || 0) > m) { setVan(EC.state().vanKits + st.ekits - m); st.ekits = m; } });
    EC.sync();
    Sim.stands.forEach(function (st) { if (st.placed && !st.trip) st.needRestock = EC.needsRefill(st); });
  };

  // ---- STOCK panel -------------------------------------------------------------------------------
  var panel = $('stockPanel'), body = $('stockBody'), btn = $('btnStock');
  EC.want = 20;
  EC.open = function () { if (!panel) return; panel.hidden = false; EC.sig = null; EC.render(); };
  EC.close = function () { if (panel) panel.hidden = true; };
  function money(c) { return '$' + (c / 100).toFixed(2).replace(/\.00$/, ''); }
  // Demand estimate fed to the rules layer's suggestOrder: yesterday's sales plus most of the customers
  // who walked away "sold out" (they wanted a taco), and never below today's goal.
  // Kits the rules layer doesn't see when it suggests (it counts stand 1 + the van): stand 2's own kits and
  // rush deliveries still on the road (C3b).
  function otherKits() {
    var s = EC.state();
    return pendingKits(s) + Sim.stands.slice(1).reduce(function (a, st) { return a + (st.placed ? st.ekits || 0 : 0); }, 0);
  }
  EC.suggestion = function () {
    var res = TF.Week.results.filter(Boolean), last = res[res.length - 1], s = EC.state();
    var demand = last ? Math.max(TF.Week.goal(), Math.round(last.sold + 0.6 * ((last.lost && last.lost['sold out']) || 0))) : Math.max(20, TF.Week.goal());
    // a second stand that has not sold yet has no history: add its capacity (C3b; was 0 -> Day 4 NO STOCK)
    Sim.stands.slice(1).forEach(function (st) { if (st.placed && !st.sold) demand += st.mods.stockMax || 10; });
    var passed = Math.max(0, demand - otherKits());
    var sg = EC.K.suggestOrder({ yesterdaySold: passed });
    if (!last) sg.text = sg.text.replace('Yesterday you sold ' + passed + '. ', 'First day. ');
    else sg.text = sg.text.replace('Yesterday you sold ' + passed + '.', 'Yesterday you sold ' + last.sold + (last.lost && last.lost['sold out'] ? ' (' + last.lost['sold out'] + ' more wanted one)' : '') + '.');
    var have = s.standKits + s.vanKits + otherKits();
    if (have) sg.text = sg.text.replace(/Suggest (\d+) kits\./, 'You have ' + have + ' on hand. Suggest $1 more.');
    return sg;
  };
  EC.render = function () {
    if (!panel || panel.hidden || !EC.on()) return;
    var s = EC.state(), lv = EC.level(), W = TF.Week, prep = W.phase === 'prep', open = W.phase === 'open' || W.phase === 'close';
    var sg = EC.suggestion(), unit = lv.kitCents * (open ? TF.Economy.rushMult : 1), cost = Math.round(EC.want * unit);
    var rush = s.pending.length ? ' · 🚚 ' + s.pending.map(function (p) { return p.kits + ' in ' + Math.ceil(p.etaS) + 's'; }).join(', ') : '';
    var tiers = ['cheap', 'fair', 'bougie'], icons = { cheap: '🌮', fair: '🙂', bougie: '💅' };
    body.innerHTML =
      '<div class="kits">KITS ' + (Sim.stands[1] && Sim.stands[1].placed ? 'stand 1 <b>' + s.standKits + '</b> · stand 2 <b>' + (Sim.stands[1].ekits || 0) + '</b>' : 'in stand <b>' + s.standKits + '</b>') + ' · van <b>' + s.vanKits + '</b>' + rush +
        (prep && s.vanKits ? '<br><small>The van loads the stand at OPEN.</small>' : '') + '</div>' +
      '<div class="pick"><button id="kitMinus">−</button><b id="kitWant">' + EC.want + ' kits</b><button id="kitPlus">+</button></div>' +
      '<div class="cost">' + money(unit) + ' ea · total <b>' + money(cost) + '</b>' + (open ? ' (rush +20%)' : '') + '</div>' +
      '<div class="sug">💡 ' + sg.text + ' <button id="kitSuggest">Use</button></div>' +
      '<div class="act">' + (prep ? '<button id="kitOrder">ORDER NOW</button>' : '') + (open ? '<button id="kitRush">RUSH +20%</button>' : '') + '</div>' +
      '<div class="tiers">' + tiers.map(function (t) { return '<button data-tier-p="' + t + '" class="' + (s.tier === t ? 'on' : '') + '"' + (prep || open ? '' : ' disabled') + '>' + icons[t] + '&nbsp;' + money(lv.prices[t]) + (s.tier === t ? '&nbsp;✓' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="line">walked away today: pricey <b id="lostPricey">' + EC.lostToday('too pricey') + '</b> · sold out <b id="lostSoldOut">' + EC.lostToday('sold out') + '</b></div>';
    $('kitMinus').onclick = function () { EC.want = Math.max(0, EC.want - 5); EC.render(); };
    $('kitPlus').onclick = function () { EC.want = Math.min(200, EC.want + 5); EC.render(); };
    $('kitSuggest').onclick = function () { EC.want = sg.kits; EC.render(); };
    if ($('kitOrder')) $('kitOrder').onclick = function () { EC.orderNow(); };
    if ($('kitRush')) $('kitRush').onclick = function () { EC.rushNow(); };
    body.querySelectorAll('[data-tier-p]').forEach(function (b) { b.onclick = function () { EC.setTier(b.getAttribute('data-tier-p')); }; });
  };
  EC.orderNow = function () {
    var r = EC.K.order(EC.want);
    EC.lastOrder = r;
    Sim.events.push({ type: 'toast', text: r.ok ? '📦 Ordered ' + EC.want + ' kits (' + money(r.costCents) + ')' : 'Can’t order: ' + (r.reason === 'insufficientCash' ? 'not enough cash' : r.reason) });
    EC.sync(); EC.render(); return r;
  };
  EC.rushNow = function () {
    var r = EC.K.rush(EC.want);
    EC.lastOrder = r;
    Sim.events.push({ type: 'toast', text: r.ok ? '🚚 Rush: ' + EC.want + ' kits in 20 s (' + money(r.costCents) + ')' : 'Can’t rush: ' + (r.reason === 'insufficientCash' ? 'not enough cash' : r.reason) });
    EC.render(); return r;
  };
  // prices change in PREP / OPEN only (the rules layer throws otherwise; REPORT showed live buttons, C3b)
  EC.setTier = function (t) {
    var ph = TF.Week.phase;
    if (ph !== 'prep' && ph !== 'open' && ph !== 'close') { Sim.events.push({ type: 'toast', text: 'Prices change in PREP or while OPEN.' }); return false; }
    EC.K.setTier(t); EC.render(); return true;
  };

  // ---- HUD: STOCK button + rent meter ---------------------------------------------------------------
  if (btn) btn.addEventListener('click', function () { TF.Audio.unlock(); panel.hidden ? EC.open() : EC.close(); });
  if ($('btnStockClose')) $('btnStockClose').addEventListener('click', function () { EC.close(); });
  var rentHud = $('rentHud');
  EC.refresh = function () {
    var on = EC.on();
    if (btn) btn.hidden = !on;
    if (rentHud) rentHud.hidden = !on;
    if (!on) return;
    var W = TF.Week, st = EC.M.rentStatus(cash(), EC.abs(W.day), W.phase), paid = EC.rent && EC.rent.paid;
    var txt = paid ? 'RENT PAID ✔' : 'RENT ' + money(st.coveredCents) + ' / ' + money(st.dueCents) + ' · due FRI';
    if (rentHud.textContent !== txt) rentHud.textContent = txt;
    rentHud.className = 'chip ' + (paid || st.state === 'covered' ? 'ok' : st.state === 'urgent' ? 'urgent' : 'short');
    rentHud.style.setProperty('--pct', Math.round(st.pct * 100) + '%');
    if (!panel.hidden) {
      var s = EC.state(), sig = [s.standKits, s.vanKits, s.tier, s.pending.length && Math.ceil(s.pending[0].etaS), W.phase, cash(), EC.lostToday('too pricey'), EC.lostToday('sold out')].join('|');
      if (sig !== EC.sig) { EC.sig = sig; EC.render(); }
    }
  };
  EC.stats = function () {
    if (!EC.on()) return null;
    var s = EC.state(), W = TF.Week;
    return { stand: s.standKits, stand2: Sim.stands[1] ? Sim.stands[1].ekits || 0 : null, wasted: EC.wasted, van: s.vanKits, pending: s.pending, tier: s.tier, price: EC.K.price(), lost: s.lost, last: EC.last, spoil: EC.spoil, rent: EC.rent,
      rentStatus: EC.M.rentStatus(cash(), EC.abs(W.day), W.phase), rentDue: EC.M.rentDue(), mood: EC.M.mood(), autoOrders: EC.autoOrders, lastOrder: EC.lastOrder || null, hud: rentHud ? rentHud.textContent : '' };
  };

  TF.plugins.push(EC);
  TF.Econ = EC;
  EC.init();
})(window.TF);
