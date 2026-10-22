// Investments (Pass 5, SIFE business theme). A big INVEST button in the HUD opens cards for
// everything that makes money: the next stand tier, the second stand, the drink cooler, picnic
// shade, trash cans, and Jared's gold + silver. Each card shows cost, an estimated $/day and the
// payback in days. Placed investments carry a floating +$ tally of what they've earned so far, and
// the day report ranks them by ROI. Jared pitches metals every PREP, and once a day he'll flip a
// coin with you (double or nothing, cash or a gold coin). Tallies for stand tiers are estimates.
(function (TF) {
  var Sim = TF.Sim, R = TF.Render, World = TF.World;
  var $ = function (id) { return document.getElementById(id); };
  var D = TF.Dialogue || {};
  var I = { owned: [], metals: { gold: { units: 0, paid: 0 }, silver: { units: 0, paid: 0 } }, price: { gold: 20, silver: 6 }, lastPrice: { gold: 20, silver: 6 },
    flipDay: {}, pitchDay: {}, flips: { won: 0, lost: 0, net: 0, coins: 0 }, history: [] };
  I.rng = TF.Rng.market;   // metal prices: the market stream; flips use the wager stream
  var TACO = 5.5;   // average taco price ($4-7)
  function pick(a, fb) { return a && a.length ? a[Math.floor(Math.random() * a.length)] : fb; }   // cosmetic: never touches saved streams
  I.week = function () { return !!(TF.Week && TF.Week.active()); };
  function base() {   // tacos per day to estimate with: yesterday's, or a first-day guess
    var r = TF.Week && TF.Week.results.filter(Boolean);
    return Math.max(12, r && r.length ? r[r.length - 1].sold : 15);
  }

  // ---- What you can invest in --------------------------------------------------------------------
  var TIER_SHARE = { grill: 0.30, banner: 0.15, serving: 0.20, canopy: 0.10 };   // share of later stand revenue credited to the tier
  function catalog() {
    var C = TF.Crew, st = Sim.selected(), out = [], b = base();
    var next = C.TIERS.filter(function (u) { return u.tier === st.tier + 1; })[0];
    if (next) out.push({ id: next.id, name: next.name + (Sim.stands.length > 1 ? ' (stand ' + (st.idx + 1) + ')' : ''), cost: next.price, est: b * (TIER_SHARE[next.id] + 0.1) * TACO * 0.6,
      note: next.effect, buy: function () { return C.buyTier(next.id); }, major: true });
    if (Sim.stands.length < 2) out.push({ id: 'stand2', name: 'Second stand', cost: C.STAND2_PRICE, est: b * 0.6 * TACO * 0.6, note: 'Its own line + Freshman Cashier', buy: function () { I.close(); return C.buyStand2(); }, major: true });
    var O = TF.Objects;
    if (O) Object.keys(O.KINDS).forEach(function (k) {
      var K = O.KINDS[k];
      var est = k === 'drinks' ? Math.min(25, b * 0.35) * (O.DRINK.price - O.DRINK.cost) - K.upkeep : k === 'picnic' ? 3 * TACO - K.upkeep : b * 0.04 * TACO - K.upkeep;
      out.push({ id: k, name: K.name, cost: K.price, est: est, note: K.effect, buy: function () { I.close(); return C.startObject(k); }, major: K.major, obj: k });
    });
    return out;
  }
  function blockOf(it) {
    var C = TF.Crew, st = Sim.selected();
    if (it.obj) return TF.Objects.blockReason(it.obj) || C.blocked(it.id);
    if (it.id === 'stand2') return !Sim.stand.placed ? 'Place stand 1' : C.blocked('stand2');
    if (st.building) return 'Building…';
    return !st.placed ? 'Place the stand' : C.blocked(it.id);
  }

  // ---- The panel -------------------------------------------------------------------------------
  var panel = $('investPanel'), list = $('investList');
  I.open = function () { if (!panel) return; panel.hidden = false; I.sig = null; I.render(); };
  I.close = function () { if (panel) panel.hidden = true; };
  function money(n) { return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)); }
  I.render = function () {
    if (!panel || panel.hidden) return;
    var cash = Sim.stats.money, html = '<div class="tip">' + pick(D.invest, 'Daily margin is the real scoreboard.') + '</div>';
    html += '<div class="permit">' + (TF.Week ? TF.Week.permitLine() : '') + '</div>';
    if (TF.Mkt) html += TF.Mkt.html();   // the Quad Exchange: GOLD / TACO / NAPZ (C5), first in the panel
    catalog().forEach(function (it) {
      var bl = blockOf(it), est = Math.max(0.5, it.est), pay = Math.ceil(it.cost / est);
      if (bl && /^Day /.test(bl)) { html += '<div class="icard lock"><b>' + it.name + '</b><span>' + bl + '</span></div>'; return; }
      html += '<div class="icard"><div><b>' + it.name + '</b> <small>' + it.note + '</small>' +
        '<div class="nums">Cost <b>$' + it.cost + '</b> · est. <b>+$' + Math.round(est) + '/day</b> · payback <b>' + pay + ' day' + (pay === 1 ? '' : 's') + '</b></div></div>' +
        '<button data-inv="' + it.id + '"' + (bl || cash < it.cost ? ' disabled' : '') + '>' + (bl || (cash < it.cost ? 'Need $' + it.cost : (TF.Crew.confirmId === it.id ? 'Confirm?' : 'Invest'))) + '</button></div>';
    });
    // Jared's metals: prices move every day
    ['gold', 'silver'].forEach(function (m) {
      var h = I.metals[m], p = I.price[m], ch = p - I.lastPrice[m], val = h.units * p;
      html += '<div class="icard metal ' + m + '"><div><b>' + (m === 'gold' ? '🥇 Gold coin' : '🥈 Silver bar') + '</b> <small>' + (m === 'gold' ? 'steady-ish' : 'wild swings') + ', moves every night</small>' +
        '<div class="nums">Price <b>$' + p + '</b> (' + (ch >= 0 ? '+' : '') + ch + ' today) · you hold <b>' + h.units + '</b> = ' + money(val) + ' (paid ' + money(h.paid) + ')</div></div>' +
        '<span class="pair"><button data-buy="' + m + '"' + (cash < p ? ' disabled' : '') + '>Buy</button><button data-sell="' + m + '"' + (h.units ? '' : ' disabled') + '>Sell</button></span></div>';
    });
    // Jared's coin flip: once a day
    var used = TF.Week && I.flipDay[TF.Week.day];
    html += '<div class="icard flip"><div><b>🪙 Jared’s coin flip</b> <small>double or nothing, once a day</small></div>' +
      '<span class="pair"><button data-flip="10"' + (used || cash < 10 ? ' disabled' : '') + '>$10</button><button data-flip="25"' + (used || cash < 25 ? ' disabled' : '') + '>$25</button><button data-flip="coin"' + (used || !I.metals.gold.units ? ' disabled' : '') + '>1 gold</button></span></div>';
    list.innerHTML = html;
    list.querySelectorAll('[data-inv]').forEach(function (b) { b.addEventListener('click', function () { var it = catalog().filter(function (x) { return x.id === b.getAttribute('data-inv'); })[0]; if (it) it.buy(); I.render(); }); });
    list.querySelectorAll('[data-buy]').forEach(function (b) { b.addEventListener('click', function () { I.buyMetal(b.getAttribute('data-buy')); }); });
    list.querySelectorAll('[data-sell]').forEach(function (b) { b.addEventListener('click', function () { I.sellMetal(b.getAttribute('data-sell')); }); });
    list.querySelectorAll('[data-flip]').forEach(function (b) { b.addEventListener('click', function () { I.flip(b.getAttribute('data-flip')); }); });
    if (TF.Mkt) TF.Mkt.bind(list);
  };

  // ---- Metals ------------------------------------------------------------------------------------
  I.buyMetal = function (m) {
    var p = I.price[m];
    if (Sim.stats.money < p) return false;
    TF.Ledger.add('metal', -p, 'buy ' + m); I.metals[m].units++; I.metals[m].paid += p;
    Sim.events.push({ type: 'toast', text: 'Jared: “' + pick(D.jared && D.jared[m + '_pitch'], 'Physical is forever.') + '” (+1 ' + m + ')' });
    I.render(); return true;
  };
  I.sellMetal = function (m) {
    var h = I.metals[m];
    if (!h.units) return false;
    var avg = h.paid / h.units, p = I.price[m];
    h.units--; h.paid -= avg; TF.Ledger.add('metal', p, 'sell ' + m);
    I.history.push({ m: m, gain: Math.round(p - avg) });
    if (I.history.length > 64) I.history.shift();
    Sim.events.push({ type: 'toast', text: 'Sold 1 ' + m + ' for $' + p + ' (' + (p - avg >= 0 ? '+' : '-') + '$' + Math.abs(Math.round(p - avg)) + ')' });
    I.render(); return true;
  };
  I.metalValue = function () { return I.metals.gold.units * I.price.gold + I.metals.silver.units * I.price.silver; };
  // Every night the prices move: gold drifts up a little with small swings; silver swings wildly.
  function gauss() { return (I.rng() + I.rng() + I.rng() - 1.5) / 0.5; }
  I.nightly = function () {
    I.lastPrice = { gold: I.price.gold, silver: I.price.silver };
    I.price.gold = Math.max(8, Math.round(I.price.gold * (1 + 0.03 + 0.12 * gauss())));
    I.price.silver = Math.max(2, Math.round(I.price.silver * (1 + 0.04 + 0.28 * gauss())));
  };

  // ---- Coin flip (with a coin you can watch) -----------------------------------------------------
  var coin = $('coinFlip');
  I.flip = function (stake) {
    if (!TF.Week || I.flipDay[TF.Week.day]) return false;
    var gold = stake === 'coin', amt = gold ? 0 : +stake;
    if (gold ? !I.metals.gold.units : Sim.stats.money < amt) return false;
    I.flipDay[TF.Week.day] = true;
    var win = TF.Rng.wager() < 0.5, W = TF.Week;
    // Settle now, on the ledger, under the day + phase it was flipped in (the coin below is only the reveal).
    if (gold) { if (win) { I.metals.gold.units++; I.flips.coins++; } else { var avg = I.metals.gold.paid / I.metals.gold.units; I.metals.gold.units--; I.metals.gold.paid -= avg; I.flips.coins--; } }
    else { TF.Ledger.post({ day: TF.Econ ? TF.Econ.abs(W.day) : W.day, phase: W.phase, cat: 'wager', cents: (win ? amt : -amt) * 100, ref: 'coin flip' }); I.flips.net += win ? amt : -amt; }
    I.flips[win ? 'won' : 'lost']++;
    I.lastFlip = { stake: stake, win: win, day: W.day, phase: W.phase };
    if (coin) {
      coin.hidden = false;
      coin.querySelector('.offer').textContent = 'Jared: “' + pick(D.jared && D.jared.coin_flip_offer, 'Heads we win.') + '”';
      var c = coin.querySelector('.coin'); c.className = 'coin spin'; c.textContent = '';
      coin.querySelector('.react').textContent = '';
      setTimeout(function () {
        c.className = 'coin ' + (win ? 'heads' : 'tails'); c.textContent = win ? 'H' : 'T';
        coin.querySelector('.react').textContent = (win ? '😎 ' : '😬 ') + 'Jared: “' + pick(D.jared && D.jared[win ? 'coin_win' : 'coin_lose'], win ? 'Called it.' : 'Next coin.') + '”';
      }, 1400);
      setTimeout(function () { coin.hidden = true; }, 3600);
    }
    if (TF.Crew) TF.Crew.flash.jared = 2;
    I.render();
    return true;
  };

  // ---- Jared's pitch (PREP, Day 2+) --------------------------------------------------------------
  var pitchEl = $('betCard');
  I.maybePitch = function () {
    var W = TF.Week;
    if (!I.week() || W.phase !== 'prep' || W.day < 2 || I.pitchDay[W.day] || !pitchEl) return;
    I.pitchDay[W.day] = true;
    pitchEl.querySelector('.txt').textContent = 'Jared: “' + pick(D.jared && D.jared.gold_pitch, 'Gold never sleeps.') + ' …and silver. ' + pick(D.jared && D.jared.silver_pitch, 'Silver whispers profit.') + '”';
    var row = pitchEl.querySelector('.btns'); row.innerHTML = '';
    [['💰 Invest', 'pitchInvest', function () { I.open(); }], ['Later', 'pitchLater', function () {}]].forEach(function (b) {
      var btn = document.createElement('button'); btn.textContent = b[0]; btn.id = b[1];
      btn.addEventListener('click', function () { pitchEl.hidden = true; b[2](); });
      row.appendChild(btn);
    });
    pitchEl.hidden = false;
    I.pitched = (I.pitched || 0) + 1;
  };

  // ---- What each investment has earned (tallies + report) ------------------------------------------
  // Called when something is bought: remember when, for how much, and the revenue baseline.
  I.noteBuy = function (id, cost, st, objRef) {
    if (!I.week()) return;
    I.owned.push({ id: id, cost: cost, st: st, rev0: st ? st.rev || 0 : 0, obj: objRef || null, day: TF.Week.day, name: nameOf(id) });
  };
  function nameOf(id) {
    var C = TF.Crew, t = C.TIERS.filter(function (u) { return u.id === id; })[0];
    if (t) return t.name; if (id === 'stand2') return 'Second stand';
    return TF.Objects && TF.Objects.KINDS[id] ? TF.Objects.KINDS[id].name : id;
  }
  I.earned = function (o) {
    var O = TF.Objects, up = O && O.KINDS[o.id] ? O.KINDS[o.id].upkeep * Math.max(0, (TF.Week.day - o.day)) : 0;
    if (TIER_SHARE[o.id] !== undefined) return ((o.st.rev || 0) - o.rev0) * TIER_SHARE[o.id];
    if (o.id === 'stand2') return Sim.stands[1] ? (Sim.stands[1].rev || 0) : 0;
    if (o.id === 'drinks') return O.totals.drinkRev - O.totals.drinkCost - up;
    if (o.id === 'picnic') return O.shadeStats.kept * TACO - up;
    if (o.id === 'trash') return O.litterStats.binned * 0.25 - up;
    return 0;
  };
  I.report = function () {
    var rows = I.owned.map(function (o) { var e = I.earned(o); return { name: o.name, cost: o.cost, earned: Math.round(e), roi: Math.round((e / o.cost) * 100), est: TIER_SHARE[o.id] !== undefined || o.id === 'trash' || o.id === 'picnic' }; });
    ['gold', 'silver'].forEach(function (m) { var h = I.metals[m]; if (h.units) rows.push({ name: (m === 'gold' ? 'Gold' : 'Silver') + ' ×' + h.units, cost: Math.round(h.paid), earned: Math.round(h.units * I.price[m] - h.paid), roi: Math.round(((h.units * I.price[m] - h.paid) / h.paid) * 100), metal: true, value: h.units * I.price[m] }); });
    rows.sort(function (a, b) { return b.roi - a.roi; });
    return rows;
  };

  // ---- HUD button + floating tallies --------------------------------------------------------------
  var btn = $('btnInvest');
  if (btn) btn.addEventListener('click', function () { TF.Audio.unlock(); panel.hidden ? I.open() : I.close(); });
  if ($('btnInvestClose')) $('btnInvestClose').addEventListener('click', function () { I.close(); });
  I.refresh = function () {
    if (!btn) return;
    var on = I.week();
    btn.hidden = !on;
    if (!on) return;
    var cash = Sim.stats.money, W = TF.Week, live = W.phase === 'prep' || W.phase === 'open';
    // glow when something is affordable and allowed right now (a big build while the permit is unused counts most)
    var ready = live && catalog().some(function (it) { return !blockOf(it) && cash >= it.cost; });
    btn.classList.toggle('glow', !!ready);
    I.ready = !!ready;
    I.maybePitch();
    if (panel && !panel.hidden) {   // re-render the open panel only when something it shows changed
      var sig = [cash, W.day, W.phase, W.majorUsed, W.openMinorUsed, I.metals.gold.units, I.metals.silver.units, I.flipDay[W.day], Sim.selected().tier, Sim.selected().building, Sim.stands.length, TF.Crew.confirmId, TF.Objects ? TF.Objects.list.length : 0].join('|');
      if (sig !== I.sig) { I.sig = sig; I.render(); }
    }
  };
  I.items = function (items) {
    if (!I.week()) return;
    var perStand = {};
    I.owned.forEach(function (o) {
      var e = Math.round(I.earned(o));
      if (o.obj) items.push({ kind: 'invest', plugin: I, x: o.obj.x + 0.5, y: o.obj.y + 0.5, k: 9990, text: '+' + money(e).replace('$', '$'), neg: e < 0 });
      else if (o.st && o.st.placed) { var n = perStand[o.st.idx] = (perStand[o.st.idx] || 0) + 1; items.push({ kind: 'invest', plugin: I, x: o.st.geom.cx + 1.3, y: o.st.geom.cy - 1.3, h: 20 + n * 15, k: 9990, text: o.name + ' +' + money(e), neg: e < 0 }); }
    });
  };
  I.draw = function (ctx, it, z) {
    var p = R.toScreen(it.x, it.y, it.h || 36);
    R.pill(it.text.replace('+-', '-'), p.x, p.y, 7 * z, it.neg ? 'rgba(150,30,30,0.85)' : 'rgba(20,110,50,0.85)');
  };
  I.step = function () {};
  // Link objects placed from either panel to their investment record.
  I.onPlaced = function (o) { I.noteBuy(o.kind, TF.Objects.KINDS[o.kind].price, o.st, o); };

  TF.plugins.push(I);
  TF.Invest = I;
})(window.TF);
