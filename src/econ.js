// Taco Week economy (Pass 6A C3): wires the rules layer (src/stock.js = TF.Stock, src/west.js = TF.West,
// data/economy.js) into the game. Only in Taco Week; Free Play keeps the old free restocks.
//   STOCK: taco kits are ordered in PREP / REPORT at the level's kit cost (RUSH during OPEN: +20%, 20 s delivery),
//   wait in the van, and the stand holds up to stockMax; restock walks bring them from the van. Every
//   sale goes through K.trySell (price tier, too pricey, sold out). Leftovers spoil at close (reported).
//   PRICE: Cheap / Fair / Bougie per level.
//   RENT: Mrs. West's rent is due Friday; the meter is always on the HUD; Friday REPORT auto-pays.
(function (TF) {
  var Sim = TF.Sim, $ = function (id) { return document.getElementById(id); };
  var EC = { K: null, M: null, last: null, spoil: [], rent: null, autoOrders: [], finance: { creditUsed: false, debt: 0 } };
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
  EC.kits = function (st) { st = st || Sim.stand; var state = EC.state(); return st.idx === 0 ? (state ? state.standKits : st.stock || 0) : (st.ekits || 0); };
  function pendingKits(s) { return s.pending.reduce(function (a, p) { return a + p.kits; }, 0); }
  EC.kitsLeft = function () { var s = EC.state(); return s ? s.standKits + s.vanKits + Sim.stands.slice(1).reduce(function (a, st) { return a + (st.ekits || 0); }, 0) : 0; };
  EC.stockStatus = function (st) {
    var s = EC.state();
    if (!s || EC.kits(st) > 0) return 'available';
    return s.vanKits > 0 ? 'restocking' : s.pending.some(function (p) { return p.kits > 0; }) ? 'arriving' : 'soldOut';
  };
  EC.soldOutAll = function (st) { return EC.stockStatus(st) === 'soldOut'; };
  function setVan(n) { var s = EC.state(); s.vanKits = n; EC.K.setState(s); }
  EC.priceDollars = function () { return EC.K.price() / 100; };

  // ---- Week hooks (week.js) -------------------------------------------------------------------
  EC.openDay = function (day) {
    if (!EC.on()) return;
    EC.startRows = TF.Ledger.rows ? TF.Ledger.rows.length : 0;
    EC.startInv = EC.kitsLeft();
    Sim.stands.forEach(function (st) { st.dayRev = st.rev || 0; st.daySold = st.sold || 0; st.dayRep = st.reputation; });
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
    if (EC.last && EC.last.absoluteDay === EC.abs(day)) return EC.last;
    if (TF.Aaron && TF.Aaron.live) TF.Aaron.live.payWage();
    EC.K.payWages(TF.Crew ? TF.Crew.hired().filter(function (id) { return id !== 'aaron'; }) : []);
    EC.K.setPhase('report', EC.abs(day));
    var sp = EC.K.closeDay();
    var out = { absoluteDay: EC.abs(day), spoiledKits: sp.spoiledKits, spoiledCents: sp.spoiledCostCents, kept: sp.kept, rent: null };
    Sim.stands.slice(1).forEach(function (st) {   // stand 2's leftovers spoil at the same rate
      var sp2 = Math.round((st.ekits || 0) * EC.level().spoilage);
      st.ekits = Math.max(0,(st.ekits || 0) - sp2); out.spoiledKits += sp2; out.spoiledCents += sp2 * EC.level().kitCents; out.kept += st.ekits;
    });
    if (TF.Empire) out.passive = EC.settleRemote(day);
    out.drinkSales = TF.Objects ? TF.Objects.totals.lastDrinkSales || 0 : 0;
    if (TF.Mkt) out.market = TF.Mkt.closeDay();   // the Exchange's pre-rolled closes land (C5)
    if (((day - 1) % 5) + 1 === 5) out.rent = EC.rent = EC.M.fridayReport(EC.abs(day));
    var stands = Sim.stands.filter(function (st) { return st.placed; }), n = stands.length;
    var costs = TF.Economy.shiftCosts(n, EC.abs(day));
    costs.payroll = 1800 * stands.filter(function (st) { return st.idx > 0 && st.crew; }).length;
    ['payroll','rent','maintenance'].forEach(function (key) {
      if (costs[key]) TF.postTransaction({ day: EC.abs(day), phase: 'report', cat: key === 'payroll' ? 'wages' : key === 'rent' ? 'siteRent' : 'maintenance', cents: -costs[key], ref: n + ' stands' });
    });
    if (TF.Empire && EC.levelNo === 3) {
      var site = stands.reduce(function(n,st) { return n + (TF.Empire.site(st).prime ? 1200 : 300); },0);
      TF.postTransaction({cat:'siteRent',cents:-site,ref:'Hillside access premium'}); costs.rent += site;
    }
    out.costs = costs;
    var rows = TF.Ledger.rows ? TF.Ledger.rows.filter(function (r) { return r.day === EC.abs(day); }) : [];
    out.payrollCents = -rows.reduce(function (a,r) { return a + (r.cat === 'wages' ? r.cents : 0); },0);
    out.revenueCents = rows.reduce(function (a,r) { return a + (/^(sales|drinks|premium|portfolio|contract)$/.test(r.cat) ? r.cents : 0); },0);
    // Cash profit excludes capital, investments and financing. Spoilage is already paid in supplies.
    out.profitCents = rows.reduce(function (a,r) { return a + (/^(sales|drinks|premium|portfolio|contract|portfolioExpense|supplies|wages|upkeep|siteRent|maintenance|rent|creditFee)$/.test(r.cat) ? r.cents : 0); },0);
    var supplies = -rows.reduce(function (a,r) { return a + (r.cat === 'supplies' ? r.cents : 0); },0);
    var sold = stands.reduce(function (a,st) { return a + (st.sold || 0)-(st.daySold || 0); },0);
    var activeProfit = out.profitCents - (out.passive ? out.passive.netCents : 0);
    var fixed = out.revenueCents - (out.passive ? out.passive.grossCents : 0) - supplies - activeProfit;
    out.stands = stands.map(function (st) {
      var rev = Math.round(((st.rev || 0) - (st.dayRev || 0))*100);
      return { idx: st.idx, funnel: JSON.parse(JSON.stringify(st.funnel)), reputation: st.reputation,
        revenueCents: rev, profitCents: rev - Math.round(supplies * (sold ? ((st.sold || 0)-(st.daySold || 0))/sold : 1/Math.max(1,n))) - Math.round(fixed/Math.max(1,n)) };
    });
    if (n) out.stands[n-1].profitCents += activeProfit - out.stands.reduce(function (a,st) { return a+st.profitCents; },0);
    out.stands.forEach(function (r) {
      var st=Sim.stands[r.idx]; st.recent=st.recent || [];
      st.recent.push({gross:r.revenueCents,cost:Math.max(0,r.revenueCents-r.profitCents)});
      if (st.recent.length>3) st.recent.shift();
    });
    if (EC.finance.debt) {
      var repay = Math.min(EC.finance.debt, Math.max(0, cash()-4000), Math.round(out.revenueCents * 0.2));
      if (repay) { TF.postTransaction({cat:'loan', cents:-repay, ref:'Emergency credit repayment'}); EC.finance.debt -= repay; }
    }
    EC.last = out; EC.spoil.push(out);
    EC.sync();
    return out;
  };
  // The flagship moves. Secondary stands keep their original location and one daily settlement.
  EC.assets = function () {
    return { level:EC.levelNo, stands:Sim.stands.map(function(st) {
      return {tier:st.tier,reputation:st.reputation,crew:st.crew,offsite:!!st.offsite,
        recent:JSON.parse(JSON.stringify(st.recent || [])),remoteObjects:JSON.parse(JSON.stringify(st.remoteObjects || []))};
    }), objects:(TF.Objects ? TF.Objects.list.map(function(o) {return {kind:o.kind,st:o.st.idx};}) : []).concat(TF.Empire ? TF.Empire.cargo : []),
      extras:JSON.parse(JSON.stringify(TF.Crew.extras)),finance:JSON.parse(JSON.stringify(EC.finance)) };
  };
  EC.restoreAssets = function (assets) {
    if (!assets) return;
    var advance=assets.level && assets.level<EC.levelNo;
    assets.stands.forEach(function(s,i) {
      var st=Sim.stands[i] || Sim.addStand();
      st.tier=s.tier; st.reputation=s.reputation; st.crew=s.crew;
      st.offsite=advance ? i>0 : !!s.offsite;
      st.recent=JSON.parse(JSON.stringify(s.recent || []));
      st.remoteObjects=JSON.parse(JSON.stringify(s.remoteObjects || []));
    });
    if (TF.Empire) {
      TF.Empire.cargo=[];
      (assets.objects || []).forEach(function(o) {
        var st=Sim.stands[o.st];
        if (advance && st && st.offsite) st.remoteObjects.push({kind:o.kind});
        else TF.Empire.cargo.push(JSON.parse(JSON.stringify(o)));
      });
    }
    TF.Crew.extras=JSON.parse(JSON.stringify(assets.extras));
    EC.finance=JSON.parse(JSON.stringify(assets.finance));
    TF.Crew.applyMods();
  };
  EC.settleRemote = function(day) {
    var gross=0,cost=0;
    Sim.stands.forEach(function(st) {
      if (!st.offsite || st.placed) return;
      var history=st.recent || [], n=history.length;
      if (!n) return;
      var g=Math.round(history.reduce(function(a,r){return a+r.gross;},0)/n);
      var c=Math.round(history.reduce(function(a,r){return a+r.cost;},0)/n) + Math.round(g * 0.12); // remote manager takes 12% of gross
      TF.postTransaction({day:EC.abs(day),phase:'report',cat:'portfolio',cents:g,ref:'Stand '+(st.idx+1)+' remote gross'});
      TF.postTransaction({day:EC.abs(day),phase:'report',cat:'portfolioExpense',cents:-c,ref:'Stand '+(st.idx+1)+' remote expenses'});
      gross+=g;cost+=c;
    });
    if (TF.Week) TF.Week.earn((gross-cost)/100);
    return {grossCents:gross,costCents:cost,netCents:gross-cost};
  };
  EC.emergencyCredit = function () {
    if (!EC.on() || EC.finance.creditUsed || !/^(prep|open|report)$/.test(TF.Week.phase)) return false;
    EC.finance.creditUsed = true; EC.finance.debt = TF.Economy.creditCents;
    TF.postTransaction({cat:'loan', cents:TF.Economy.creditCents, ref:'One emergency credit'});
    TF.postTransaction({cat:'creditFee', cents:-TF.Economy.creditFeeCents, ref:'Emergency credit fee'});
    if (TF.P7Content) Sim.events.push({type:'toast',text:TF.P7Content.items.emergencyLoan.buyLine});
    if (TF.Save && /^(prep|report)$/.test(TF.Week.phase)) TF.Save.write(TF.Week.phase);
    return true;
  };
  EC.funnelHTML = function (out) {
    return '<div class="why">Payroll $' + ((out.payrollCents || 0)/100).toFixed(2) + ' · Site rent $' + ((out.costs ? out.costs.rent : 0)/100).toFixed(2) + ' · Maintenance $' + ((out.costs ? out.costs.maintenance : 0)/100).toFixed(2) + '</div>' + (out.stands || []).map(function (st) {
      var f=st.funnel, lost=Object.keys(f.lost).map(function (k) { return f.lost[k] + ' ' + k; }).join(' · ');
      return '<div class="why"><b>Stand ' + (st.idx+1) + ' · rep ' + Math.round(st.reputation) + '/100</b><br>' +
        f.walkers + ' walkers → ' + f.interested + ' interested → ' + f.queued + ' queued → ' + f.served + ' served<br>' +
        'Lost: ' + (lost || '0') + '<br>Profit $' + (st.profitCents/100).toFixed(2) + '</div>';
    }).join('') + '<small>Supplies split by sales; shared costs split equally.</small><div class="row"><span>Operating cash profit</span><b>$' + (out.profitCents/100).toFixed(2) + '</b></div>';
  };
  EC.nextDay = function (day) { if (EC.on()) { EC.K.setPhase('prep', EC.abs(day)); EC.sync(); if (TF.Empire) TF.Empire.marketSignals(); if (TF.Mkt) TF.Mkt.openDay(); } };
  // Week days are level-local (1-5); West and Stock count campaign days (L2 Monday = day 6) (C3c).
  EC.levelNo = 1;
  EC.abs = function (day) { return (EC.levelNo - 1) * 5 + day; };
  EC.level = function () { return TF.Economy.levels[(EC.state() || { level: 1 }).level - 1]; };

  // ---- Sim hooks -------------------------------------------------------------------------------
  // A sale at the window: priced by the tier, posted to the ledger. {dollars} or {reason: 'soldOut' |
  // 'tooPricey'} (the price can go up while someone waits in line).
  EC.sell = function (g) {
    var st = g.st || Sim.stand, r;
    if (st.idx > 0 && !st.crew) return { reason: 'unassigned' };
    if (g.econSale) return { reason: 'alreadyPaid' };
    if (EC.state().phase !== 'open') return { reason: 'closed' };
    if (EC.kits(st) === 0 && !EC.soldOutAll(st)) { st.needRestock = EC.needsRefill(st); return { reason: 'restocking' }; }
    if (st.idx === 0) r = EC.K.trySell(Math.round(g.maxPay * 100));
    else {   // stand 2: same tier price, its own kits
      var price = EC.K.price();
      if (!st.ekits) r = { sold: false, reason: 'soldOut' };
      else if (Math.round(g.maxPay * 100) < price) r = { sold: false, reason: 'tooPricey' };
      else { TF.postTransaction({ day: EC.abs(TF.Week.day), phase: 'open', cat: 'sales', cents: price, ref: EC.state().tier + ' (stand ' + (st.idx+1) + ')' }); st.ekits--; r = { sold: true, cents: price }; }
    }
    EC.sync();
    if (r.sold) g.econSale = true;
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
    if (TF.Empire) TF.Empire.marketSignals();
    if (TF.Mkt && !(TF.Campaign && TF.Campaign.busy) && !(TF.Save && TF.Save.restoring)) TF.Mkt.resetLevel();
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
    var target = TF.Week.goal(/^(close|report)$/.test(TF.Week.phase) ? Math.min(5, TF.Week.day + 1) : TF.Week.day);
    var demand = last ? Math.max(target, Math.round(last.sold + 0.6 * ((last.lost && last.lost['sold out']) || 0))) : Math.max(20, target);
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
      '<div class="kits">KITS ' + Sim.stands.filter(function (st) { return st.placed; }).map(function (st) { return 'stand ' + (st.idx+1) + ' <b>' + EC.kits(st) + '</b>'; }).join(' · ') + ' · van <b>' + s.vanKits + '</b>' + rush +
        (prep && s.vanKits ? '<br><small>The van loads the stand at OPEN.</small>' : '') + '</div>' +
      '<div class="pick"><button id="kitMinus">−</button><b id="kitWant">' + EC.want + ' kits</b><button id="kitPlus">+</button></div>' +
      '<div class="cost">' + money(unit) + ' ea · total <b>' + money(cost) + '</b>' + (open ? ' (rush +20%)' : '') + '</div>' +
      '<div class="sug">💡 ' + sg.text + ' <button id="kitSuggest">Use</button></div>' +
      '<div class="act">' + (prep ? '<button id="kitOrder">ORDER NOW</button>' : '') + (open ? '<button id="kitRush">RUSH +20%</button>' : '') + '</div>' +
      '<div class="tiers">' + tiers.map(function (t) { return '<button data-tier-p="' + t + '" class="' + (s.tier === t ? 'on' : '') + '"' + (prep || open ? '' : ' disabled') + '>' + icons[t] + '&nbsp;' + money(lv.prices[t]) + (s.tier === t ? '&nbsp;✓' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="line">walked away today: pricey <b id="lostPricey">' + EC.lostToday('too pricey') + '</b> · sold out <b id="lostSoldOut">' + EC.lostToday('sold out') + '</b></div>';
    $('kitMinus').onclick = function () { EC.want = Math.max(0, EC.want - 5); EC.render(); };
    $('kitPlus').onclick = function () { EC.want = Math.min(1000, EC.want + 5); EC.render(); };
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

  // Public menu and restock controls share the existing rules and ledger paths.
  var menu = $('menuPanel'), menuBody = $('menuBody'), menuBtn = $('btnMenu');
  var restock = $('restockCard'), rushBtn = $('btnRushStock');
  EC.restockWant = null;
  EC.restockOffer = function () {
    var W = TF.Week, phase = W.phase, rush = phase === 'open';
    var unit = Math.round(EC.level().kitCents * (rush ? TF.Economy.rushMult : 1));
    var suggested = EC.suggestion().kits;
    var affordable = Math.max(0, Math.floor(cash() / unit));
    var want = EC.restockWant === null ? Math.min(suggested, affordable) : EC.restockWant;
    // Low stock needs a usable small order even when the day estimate is already covered.
    if (rush && EC.restockWant === null) want = Math.min(Math.max(5, suggested), affordable);
    return { kitsLeft: EC.kitsLeft(), suggested: suggested, want: want, unit: unit, cost: want * unit,
      canBuy: phase !== 'close' && !(W.day === 5 && phase === 'report') && want > 0 && want * unit <= cash(), rush: rush };
  };
  EC.buyRestock = function () {
    var o = EC.restockOffer();
    if (!o.canBuy) return false;
    var old = EC.want; EC.want = o.want;
    var r = o.rush ? EC.rushNow() : EC.orderNow(); EC.want = old;
    if (r.ok) {
      EC.restockWant = null;
      if (TF.Save && TF.Week.phase === 'report') TF.Save.write('report');
      else if (TF.Save && TF.Week.phase === 'prep') TF.Save.write('prep');
    }
    EC.restockSig = null; EC.refresh(); return r.ok;
  };
  EC.renderMenu = function () {
    if (!menu || menu.hidden || !EC.on()) return;
    var s = EC.state(), lv = EC.level(), editable = /^(prep|open|close)$/.test(TF.Week.phase);
    menuBody.innerHTML = '<p><b>🌮 Taco · ' + money(EC.K.price()) + '</b><br>Kits left: ' + EC.kitsLeft() + '</p>' +
      ['cheap', 'fair', 'bougie'].map(function (t) { return '<button data-menu-tier="' + t + '" aria-pressed="' + (s.tier === t) + '"' + (editable ? '' : ' disabled') + '>' + t + ' ' + money(lv.prices[t] + s.priceAdd) + '</button>'; }).join('') +
      '<p>Too pricey: <b>' + EC.lostToday('too pricey') + '</b> lost sales today. Lower prices attract more budgets.</p>';
    var O = TF.Objects, cooler = O && O.list.some(function (o) { return o.kind === 'drinks' && o.ready; });
    menuBody.innerHTML += '<p><b>🥤 Agua fresca · ' + money(100 * (O.day.price || O.DRINK.price)) + '</b><br>' +
      (cooler ? (O.stock ? O.stock.drinks : 0) + ' drinks left · buy stock in Restock.' : 'Build a Drink cooler to sell purchased drinks.') + '</p>' +
      [1, 2, 3].map(function (p) { return '<button data-drink-price="' + p + '" aria-pressed="' + ((O.day.price || O.DRINK.price) === p) + '"' + (editable ? '' : ' disabled') + '>' + money(p * 100) + '</button>'; }).join('') +
      '<p>Cheaper drinks get more takers; drinks add pickup time.</p>' + EC.drinkControls();
    menuBody.innerHTML += '<p>' + (TF.P7Content ? TF.P7Content.items.emergencyLoan.blurb : '') + '</p><p>Emergency credit: $100 now; $40 fee; repay 20% of sales above a $40 reserve.</p><button id="btnEmergencyCredit"' + (EC.finance.creditUsed ? ' disabled' : '') + '>' + (TF.P7Content ? TF.P7Content.items.emergencyLoan.name : 'Emergency credit') + (EC.finance.creditUsed ? ' used · debt $' + (EC.finance.debt/100).toFixed(2) : '') + '</button>';
    if ($('btnEmergencyCredit')) $('btnEmergencyCredit').onclick = function () { EC.emergencyCredit(); EC.renderMenu(); };
    EC.bindDrinks();
    menuBody.querySelectorAll('[data-menu-tier]').forEach(function (b) { b.onclick = function () { EC.setTier(b.dataset.menuTier); EC.renderMenu(); }; });
    menuBody.querySelectorAll('[data-drink-price]').forEach(function (b) { b.onclick = function () { EC.setDrinkPrice(Number(b.dataset.drinkPrice)); }; });
  };
  EC.drinkControls = function () {
    var O = TF.Objects, stock = O.stock || { drinks: 0, pending: [] }, rush = TF.Week.phase === 'open';
    var allowed = /^(prep|open|report)$/.test(TF.Week.phase), n = EC.drinkWant || 10;
    var cents = Math.round(n * (O.drinkCost ? O.drinkCost() : O.DRINK.cost || 0.5) * 100 * (rush ? TF.Economy.rushMult : 1));
    return '<div class="drink-stock"><b>🥤 Drink stock: ' + stock.drinks + ' left</b>' +
      stock.pending.map(function (p) { return ' · ' + p.drinks + ' arriving in ' + Math.ceil(p.etaS) + 's'; }).join('') +
      '<div class="restock-actions"><button data-drink-minus aria-label="Fewer drinks">−</button><b>' + n + ' drinks</b><button data-drink-plus aria-label="More drinks">+</button>' +
      '<button data-drink-buy' + (!allowed || cents > cash() ? ' disabled' : '') + '>' + (rush ? 'RUSH +20%' : 'Buy') + ' ' + money(cents) + '</button></div><small>' + money(Math.round((O.drinkCost ? O.drinkCost() : 0.5)*100)) + ' each · leftovers keep overnight</small></div>';
  };
  EC.bindDrinks = function () {
    [menuBody, restock].forEach(function (root) {
      if (!root) return;
      root.querySelectorAll('[data-drink-minus]').forEach(function (b) { b.onclick = function () { EC.drinkWant = Math.max(5, (EC.drinkWant || 10) - 5); EC.restockSig = null; EC.refresh(); EC.renderMenu(); }; });
      root.querySelectorAll('[data-drink-plus]').forEach(function (b) { b.onclick = function () { EC.drinkWant = Math.min(200, (EC.drinkWant || 10) + 5); EC.restockSig = null; EC.refresh(); EC.renderMenu(); }; });
      root.querySelectorAll('[data-drink-buy]').forEach(function (b) { b.onclick = function () { EC.buyDrinks(); }; });
    });
  };
  EC.buyDrinks = function () {
    var r = TF.Objects.buyDrinks(EC.drinkWant || 10);
    Sim.events.push({ type: 'toast', text: r.ok ? '🥤 Drinks ' + (TF.Week.phase === 'open' ? 'arrive in 20s' : 'stock purchased') + ' (' + money(r.costCents) + ')' : 'Drinks: ' + r.reason });
    if (r.ok && TF.Save && /^(prep|report)$/.test(TF.Week.phase)) TF.Save.write(TF.Week.phase);
    EC.restockSig = null; EC.refresh(); EC.renderMenu(); return r;
  };
  EC.setDrinkPrice = function (price) {
    if (!/^(prep|open|close)$/.test(TF.Week.phase) || [1, 2, 3].indexOf(price) < 0) return false;
    TF.Objects.day.price = price; EC.renderMenu(); return true;
  };
  if (menuBtn) menuBtn.onclick = function () { menu.hidden = !menu.hidden; EC.renderMenu(); };
  if ($('btnMenuClose')) $('btnMenuClose').onclick = function () { menu.hidden = true; };
  if (rushBtn) rushBtn.onclick = function () { EC.buyRestock(); };
  EC.refreshBuying = function () {
    if (!restock || !rushBtn || !menuBtn) return;
    var W = TF.Week, on = EC.on();
    if (menuBtn) menuBtn.hidden = !on;
    if (!on) { if (restock) restock.hidden = true; if (rushBtn) rushBtn.hidden = true; return; }
    var key = EC.levelNo + ':' + W.day + ':' + W.phase;
    if (EC.restockKey !== key) { EC.restockKey = key; EC.restockWant = null; EC.restockSig = null; }
    var o = EC.restockOffer(), s = EC.state();
    rushBtn.hidden = W.phase !== 'open' || o.kitsLeft > 3;
    var empty = Sim.stands.some(function (st) { return st.placed && EC.stockStatus(st) === 'restocking'; });
    rushBtn.disabled = !o.canBuy;
    rushBtn.textContent = 'RUSH restock (+20%) · ' + o.want + ' kits ' + money(o.cost);
    if (W.phase === 'open' && empty) { rushBtn.hidden = false; rushBtn.disabled = true; rushBtn.textContent = 'Restocking… kits in the van'; }
    // Deliveries stay visible so sold-out players know help is coming.
    if (W.phase === 'open' && s.pending.length && !empty) {
      rushBtn.hidden = false; rushBtn.disabled = true;
      rushBtn.textContent = 'Restock arriving in ' + Math.ceil(s.pending[0].etaS) + 's';
    }
    var report = $('reportCard'), inReport = W.phase === 'report' && !report.hidden;
    var parent = inReport ? report : $('hud');
    if (restock.parentNode !== parent) {
      if (inReport) parent.insertBefore(restock, $('btnNextDay')); else parent.appendChild(restock);
    }
    restock.hidden = !/^(prep|open|close|report)$/.test(W.phase) || EC.restockSkipped === key;
    var ds = TF.Objects.stock || { drinks: 0, pending: [] };
    if (W.phase === 'open' && o.kitsLeft > 3 && !(TF.Objects.list.some(function (o) { return o.kind === 'drinks'; }) && ds.drinks <= 3)) restock.hidden = true;
    var sig = [key, o.kitsLeft, o.want, o.suggested, cash(), ds.drinks, ds.pending.map(function (p) { return Math.ceil(p.etaS); }).join(',')].join('|');
    if (!restock.hidden && sig !== EC.restockSig) {
      EC.restockSig = sig;
      restock.innerHTML = '<b>' + (W.phase === 'open' ? 'RUSH restock (+20%)' : W.phase === 'prep' ? 'Restock before OPEN' : W.day === 5 ? 'Restock at the next location' : 'Restock for tomorrow') + '</b> · ' + o.kitsLeft + ' kits left' +
        '<small>Suggested: ' + o.suggested + ' kits (' + money(o.suggested * o.unit) + '). ' + (W.day === 5 && W.phase !== 'prep' ? 'Kits reset at the next location. Restock in its PREP.' : W.phase === 'close' ? 'Buy after closing; leftovers spoil first.' : 'Adjust to your budget; or skip.') + '</small>' +
        '<div class="restock-actions"><button id="restockMinus" aria-label="Fewer kits">−</button><b>' + o.want + ' kits</b><button id="restockPlus" aria-label="More kits">+</button>' +
        '<button id="restockBuy"' + (o.canBuy ? '' : ' disabled') + '>Buy ' + money(o.cost) + '</button><button id="restockSkip">Skip</button></div>' + EC.drinkControls();
      EC.bindDrinks();
      $('restockMinus').onclick = function () { EC.restockWant = Math.max(0, o.want - 5); EC.refresh(); };
      $('restockPlus').onclick = function () { EC.restockWant = Math.min(200, o.want + 5); EC.refresh(); };
      $('restockBuy').onclick = EC.buyRestock;
      $('restockSkip').onclick = function () { EC.restockSkipped = key; restock.hidden = true; };
    }
    var ms = [key, EC.K.price(), TF.Objects.day.price, TF.Objects.day.drinks, ds.drinks, ds.pending.map(function (p) { return Math.ceil(p.etaS); }).join(','), o.kitsLeft, EC.lostToday('too pricey'), TF.Objects.list.map(function (o) { return o.ready; }).join(',')].join('|');
    if (EC.menuSig !== ms) { EC.menuSig = ms; EC.renderMenu(); }
  };

  // ---- HUD: STOCK button + rent meter ---------------------------------------------------------------
  if (btn) btn.addEventListener('click', function () { TF.Audio.unlock(); panel.hidden ? EC.open() : EC.close(); });
  if ($('btnStockClose')) $('btnStockClose').addEventListener('click', function () { EC.close(); });
  var rentHud = $('rentHud');
  EC.refresh = function () {
    var on = EC.on();
    EC.refreshBuying();
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
  if (TF.Mkt && !TF.Mkt.X && EC.K) { if (TF.Empire) TF.Empire.marketSignals(); TF.Mkt.create(); }
})(window.TF);
