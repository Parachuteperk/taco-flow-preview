// Financial assets: the Quad Exchange plus Jared's metals and wagers.
// Physical purchases live in Build; their existing ROI records remain in the report.
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
  // ---- What you can invest in --------------------------------------------------------------------
  var TIER_SHARE = { grill: 0.30, banner: 0.15, serving: 0.20, canopy: 0.10 };   // share of later stand revenue credited to the tier
  // ---- The panel -------------------------------------------------------------------------------
  var panel = $('investPanel'), list = $('investList');
  I.open = function () { if (!panel) return; panel.hidden = false; I.sig = null; I.render(); };
  I.close = function () { if (panel) panel.hidden = true; };
  function money(n) { return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)); }
  I.render = function () {
    if (!panel || panel.hidden) return;
    var cash = Sim.stats.money, html = '<div class="tip">' + pick(D.invest, 'Daily margin is the real scoreboard.') + '</div>';
    html += '<div class="permit">' + (TF.Week ? TF.Week.permitLine() : '') + '</div>';
    if (TF.Mkt) html += TF.Mkt.html();   // the Quad Exchange: the 7-ticker board (data/tickers.js), first in the panel
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
  function panelOpen() {
    return ['crewPanel', 'investPanel', 'stockPanel', 'menuPanel', 'manageSheet'].some(function (id) {
      var el = $(id); return el && !el.hidden;
    });
  }
  I.maybePitch = function () {
    var W = TF.Week;
    if (!I.week() || W.phase !== 'prep' || W.day < 2 || I.pitchDay[W.day] || !pitchEl || panelOpen()) return;
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
    I.owned.push({ id: id, cost: cost, st: st, rev0: st ? st.rev || 0 : 0, obj: objRef || null, day: TF.Week.day, name: id === 'stand2' && st ? 'Stand ' + (st.idx+1) : nameOf(id) });
  };
  function nameOf(id) {
    var C = TF.Crew, t = C.TIERS.filter(function (u) { return u.id === id; })[0];
    if (t) return t.name; if (/^stand[2-6]$/.test(id)) return TF.P7Content ? TF.P7Content.items[id].name : 'Stand '+id.slice(-1);
    return TF.Objects && TF.Objects.KINDS[id] ? TF.Objects.KINDS[id].name : id;
  }
  I.earned = function (o) {
    var O = TF.Objects, up = O && O.KINDS[o.id] ? O.KINDS[o.id].upkeep * Math.max(0, (TF.Week.day - o.day)) : 0;
    if (TIER_SHARE[o.id] !== undefined) return ((o.st.rev || 0) - o.rev0) * TIER_SHARE[o.id];
    if (/^stand[2-6]$/.test(o.id)) return o.st ? (o.st.rev || 0) - o.rev0 : 0;
    if (o.id === 'drinks') return O.totals.drinkRev - O.totals.drinkCost - up;
    if (o.id === 'picnic') return O.shadeStats.kept * TACO - up;
    if (o.id === 'trash') return O.litterStats.binned * 0.25 - up;
    var E = TF.Empire;   // catalog items (Pass 7): their own till, or a modeled share for demand items
    if (E && E.earnTotal && E.earnTotal[o.id]) return E.earnTotal[o.id].dollars - up;
    var share = E && E.EST_SHARE ? E.EST_SHARE(o.id) : undefined;
    if (share !== undefined && o.st) return ((o.st.rev || 0) - o.rev0) * share - up;
    return -up;
  };
  I.report = function () {
    var rows = I.owned.map(function (o) { var e = I.earned(o); return { name: o.name, stand: o.st && Number.isInteger(o.st.idx) ? o.st.idx + 1 : null, cost: o.cost, earned: Math.round(e), roi: Math.round((e / o.cost) * 100), est: TIER_SHARE[o.id] !== undefined || o.id === 'trash' || o.id === 'picnic' || !!(TF.Empire && TF.Empire.EST_SHARE && TF.Empire.EST_SHARE(o.id) !== undefined) }; });
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
    var ready = live && cash >= Math.min(I.price.gold, I.price.silver);
    btn.classList.toggle('glow', !!ready);
    I.ready = !!ready;
    I.maybePitch();
    if (panel && !panel.hidden) {   // re-render the open panel only when something it shows changed
      var sig = [cash, W.day, W.phase, W.majorUsed, W.openMinorUsed, I.metals.gold.units, I.metals.silver.units, I.flipDay[W.day], Sim.selected().tier, Sim.selected().building, Sim.stands.length, TF.Crew.confirmId, TF.Objects ? TF.Objects.list.length : 0].join('|');
      if (sig !== I.sig) { I.sig = sig; I.render(); }
    }
  };
  // Aaron (Oct 22): no floating "+$" pills over the grill/banner/serving/canopy - the week report keeps the ROI.
  I.SHOW_PILLS = false;
  I.items = function (items) {
    if (!I.week() || !I.SHOW_PILLS) return;
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
