// Jared's side hustles: a gold/silver stash and the occasional coin flip. A "day" is 3 sim-minutes.
// Small, non-blocking cards (bottom-left); nothing pauses the game.
// Money moves only on explicit B.confirm(betId) after propose. No auto-accept.
(function (TF) {
  var Sim = TF.Sim;
  var DAY = 180;

  var B = {
    day: 1, dayStart: 0, dayEarn: 0, policy: 'ask', card: null, cardT: 0, holding: null, offeredToday: false, betAt: 60,
    bets: { placed: 0, up: 0, down: 0, net: 0 }, flips: { offered: 0, flipped: 0, won: 0, lost: 0, skipped: 0, net: 0 },
    pending: null, nextId: 1
  };
  function rnd(a, b) { return a + (b - a) * TF.Rng.events(); }
  var el = document.getElementById('betCard');

  function showCard(kind, text, buttons) {
    B.card = kind; B.cardT = 12;
    el.querySelector('.txt').textContent = text;
    var row = el.querySelector('.btns');
    row.innerHTML = '';
    buttons.forEach(function (b) {
      var btn = document.createElement('button');
      btn.textContent = b[0]; btn.id = b[1];
      btn.addEventListener('click', function () { TF.Audio.unlock(); b[2](); hideCard(); });
      row.appendChild(btn);
    });
    el.hidden = false;
  }
  function hideCard() { el.hidden = true; B.card = null; }
  function toast(t) { Sim.events.push({ type: 'toast', text: t }); }

  function propose(kind, data) {
    var id = 'bet' + (B.nextId++);
    B.pending = { id: id, kind: kind, data: data };
    return id;
  }
  B.propose = propose;
  B.confirm = function (betId) {
    if (!B.pending || B.pending.id !== betId) return false;
    var p = B.pending;
    B.pending = null;
    if (p.kind === 'metal') {
      var d = p.data;
      TF.Ledger.add('metal', -d.amt, 'jared stash');
      B.holding = { metal: d.metal, amt: d.amt };
      B.bets.placed++;
      toast('Jared stashed $' + d.amt + ' in ' + d.metal);
    } else if (p.kind === 'flip') {
      var stake = p.data.stake;
      var win = TF.Rng.wager() < 0.5;
      TF.Ledger.add('wager', win ? stake : -stake, 'coin flip');
      B.flips.flipped++;
      B.flips[win ? 'won' : 'lost']++;
      B.flips.net += win ? stake : -stake;
      toast('🪙 Coin flip: ' + (win ? 'HEADS! +$' : 'tails… -$') + stake);
    }
    return true;
  };

  // ---- Gold / silver: once a day Jared offers to stash 10% of today's take ---------
  B.offerBet = function () {
    var amt = Math.max(5, Math.round(B.dayEarn * 0.1));
    if (B.holding || Sim.stats.money < amt) return false;
    B.offeredToday = true;
    showCard('bet', 'Jared: “Let me put $' + amt + ' of today’s take in metals. Back at closing.”', [
      ['Gold', 'betGold', function () { var id = propose('metal', {metal: 'gold', amt: amt}); B.confirm(id); }],
      ['Silver', 'betSilver', function () { var id = propose('metal', {metal: 'silver', amt: amt}); B.confirm(id); }],
      ['Skip', 'betSkip', function () {}]
    ]);
    return true;
  };
  // Up 75% of the time, down 25%. Gold swings harder than silver.
  function resolveBet() {
    var h = B.holding;
    if (!h) return;
    var up = TF.Rng.wager() < 0.75, r = h.metal === 'gold' ? 0.4 : 0.2;
    var back = Math.round(h.amt * (up ? 1 + r : 1 - r));
    TF.Ledger.add('metal', back, 'jared stash back');
    B.bets[up ? 'up' : 'down']++;
    B.bets.net += back - h.amt;
    toast((up ? '📈 ' : '📉 ') + h.metal + ' ' + (up ? 'up' : 'down') + ': $' + h.amt + ' → $' + back);
    B.holding = null;
  }

  // ---- Coin flip: now and then at closing, 25% of the day's take on a 50/50 ----------
  B.offerFlip = function () {
    var stake = Math.max(5, Math.round(B.dayEarn * 0.25));
    if (Sim.stats.money < stake) return false;
    B.flips.offered++;
    if (B.policy === 'never') { B.flips.skipped++; return true; }
    // no auto-accept: always require explicit confirm via the card (or external confirm call)
    showCard('flip', 'Jared: “Double or nothing on $' + stake + '? Heads we win.”', [
      ['Flip', 'flipYes', function () { var id = propose('flip', {stake: stake}); B.confirm(id); }],
      ['Skip', 'flipNo', function () { B.flips.skipped++; }]
    ]);
    return true;
  };
  B.endDay = function () {
    resolveBet();
    if (TF.Rng.events() < 0.35) B.offerFlip();
    B.day++; B.dayStart = Sim.t; B.dayEarn = 0; B.offeredToday = false; B.betAt = rnd(40, 120);
  };

  B.earn = function (amt) { B.dayEarn += amt; };

  B.step = function (dt) {
    if (B.card) { B.cardT -= dt; if (B.cardT <= 0) { if (B.card === 'flip') B.flips.skipped++; hideCard(); } }
    if (!Sim.stand.placed) { B.dayStart = Sim.t; return; }
    var week = TF.Week && TF.Week.active();
    if (week) return;   // in Taco Week Jared's metals + coin flip live in the Invest panel (TF.Invest)
    if (!B.offeredToday && Sim.t - B.dayStart >= B.betAt && B.dayEarn >= 20 && !B.card && (!week || TF.Week.eventAllowed('bets', true))) B.offerBet();
    if (!week && Sim.t - B.dayStart >= DAY) B.endDay();   // in Taco Week, closing time ends the day
  };

  B.setPolicy = function (p) { if (p === 'always' || p === 'ask' || p === 'never') B.policy = p; };

  TF.Bets = B;
})(window.TF);
