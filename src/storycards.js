// Pass 7: short dialogue cards (Aaron: "an intro story ... on Mrs West and the rent due at the end of
// the week ... the month long campaign and the different levels" + "a quick intro to each character
// with their benefits"). Copy lives in data/story-copy.js; rents, level names and every benefit number
// are read from the game's own data and code. Portraits reuse the existing sprites (Crew.paintPortrait).
//  - New game: a skippable 3-5 card intro before Level 1 Day 1 PREP, once per run (not on a week retry).
//  - Character cards: the first time a crew member is available (or appears), one per day, in PREP;
//    always viewable from the Hire menu's info button. "Skip all intros" turns the automatic ones off.
(function (TF) {
  var SC = TF.StoryCards = { open: null };
  var INTRO_KEY = 'loli.v6.intro', CARDS_KEY = 'loli.v6.cards';
  function copy() { return TF.STORY_COPY || { intro: { cards: [] }, cards: {}, characters: {} }; }
  function store() { try { return window.localStorage; } catch (e) { return null; } }
  function auto() { return !(window.__autotest || (typeof navigator !== 'undefined' && navigator.webdriver)); }
  function dollars(cents) { return '$' + Math.round(cents / 100).toLocaleString('en-US'); }
  function money(cents) { var d = cents / 100; return '$' + (d % 1 ? d.toFixed(2) : d.toLocaleString('en-US')); }

  // ---- tokens from the live data -------------------------------------------------------------
  SC.tokens = function () {
    var t = {}, levels = (TF.Economy && TF.Economy.levels) || [];
    levels.forEach(function (lv, i) {
      var map = TF.LEVELS && TF.LEVELS['L' + (i + 1)];
      t['rentL' + (i + 1)] = dollars(lv.rentCents);
      t['levelL' + (i + 1)] = (map && map.name) || lv.map;
    });
    t.weeks = String(levels.length || 4);
    t.maxStands = String((TF.Sim && TF.Sim.MAX_STANDS) || 6);
    return t;
  };
  SC.fill = function (text, extra) {
    var t = SC.tokens(); Object.keys(extra || {}).forEach(function (k) { t[k] = extra[k]; });
    return String(text || '').replace(/\{(\w+)\}/g, function (m, k) { return t[k] !== undefined ? t[k] : m; });
  };

  // ---- the real benefit numbers per character ---------------------------------------------------
  function roster(id) { return TF.Crew && TF.Crew.ROSTER.filter(function (r) { return r.id === id; })[0]; }
  function pct(mul) { return Math.round((1 - mul) * 100) + '%'; }
  SC.benefits = function (id) {
    var C = TF.C || {}, P = (TF.Crew && TF.Crew.PERKS) || {}, wages = (TF.Economy && TF.Economy.wagesCents) || {};
    var out = [];
    if (id === 'jared') {
      out.push('Runs the register and the cooler, and walks restocks from the van');
      if (TF.Econ && TF.Econ.FLOAT_KITS) out.push('Kit float: fronts ' + TF.Econ.FLOAT_KITS + ' taco kits once per level when you are broke and out of stock');
    } else if (id === 'ali') {
      out.push('Cooking ' + pct(P.ali.cookMul) + ' faster, +' + P.ali.grillAdd + ' grill slot');
    } else if (id === 'phillip') {
      out.push('Cooking ' + pct(P.phillip.cookMul) + ' faster');
      out.push('Tortilla Cannon extra: hand-off ' + Math.round(1 / P.cannon.handMul) + 'x faster (needs the Serving station)');
    } else if (id === 'matt') {
      out.push('Hand-off in ' + P.matt.handT + ' s (stand default ' + (C.HAND_T || 0.8) + ' s), serves drinks quickly');
      out.push('Repairs breakdowns: grills, banners, coolers, tipped trash cans');
    } else if (id === 'antonio') {
      var hacks = (TF.Hacks && TF.Hacks.LEVELS) || [];
      out.push('One player-triggered hack a day' + (hacks.length ? ' (' + hacks.length + ' hacks, he levels up daily: ' + hacks.map(function (h) { return h.name; }).join(', ') + ')' : ''));
      var acc = TF.Exchange && TF.Exchange.ACCURACY && TF.Exchange.ACCURACY.antonio;
      if (acc) out.push('Exchange tips that are right ' + Math.round(acc * 100) + '% of the time');
    } else if (id === 'aaron') {
      var A = TF.Aaron || {};
      out.push('Elevator Pitch: +' + (A.PATIENCE_S || 8) + ' s patience for waiting customers within ' + (A.RADIUS_TILES || 3) + ' tiles');
      out.push('Lands bulk orders from clubs and professors');
      if (A.unlockDay) out.push(SC.fill(copy().cards.fromDay || 'Available from Day {day}', { day: A.unlockDay }));
    } else if (id === 'runner') {
      out.push('Walks supply runs: restocks the stand from the van');
    }
    var r = roster(id);
    if (r) {
      var cards = copy().cards || {};
      var price = id === 'aaron' && TF.Aaron && TF.Aaron.hireCents ? TF.Aaron.hireCents : r.price * 100;
      if (!price) out.push(cards.free || 'Already on the crew');
      else out.push(SC.fill(cards.hireCost || '{price} to hire', { price: money(price) }));
      var wage = id === 'aaron' && TF.Aaron && TF.Aaron.wageCents ? TF.Aaron.wageCents : wages[id];
      if (wage) out.push(SC.fill(cards.wage || '{wage}/day wage', { wage: money(wage) }));
      if (r.tier > 0 && TF.Crew && TF.Crew.TIERS[r.tier - 1]) out.push(SC.fill(cards.needsTier || 'Unlocks with the {tier}', { tier: TF.Crew.TIERS[r.tier - 1].name }));
    }
    return out;
  };
  SC.character = function (id) {
    var c = (copy().characters || {})[id] || {}, r = roster(id) || {};
    return { who: id, name: c.name || r.name || id, title: c.title || r.role || '', text: SC.fill(c.line || ''), benefits: SC.benefits(id) };
  };

  // ---- the card UI --------------------------------------------------------------------------------
  SC.show = function (deck, opts) {
    opts = opts || {};
    if (SC.open) SC.open.close(true);
    var doc = document, i = 0, labels = opts.labels || {};
    var wrap = doc.createElement('section');
    wrap.id = 'storyCard'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    wrap.dataset.kind = opts.kind || 'cards';
    wrap.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1010;width:min(380px,calc(100% - 28px));box-sizing:border-box;background:#fff5d6;border:3px solid #501214;border-radius:14px;padding:14px;color:#2a1810;font-family:system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35);overflow-wrap:anywhere';
    var row = doc.createElement('div'); row.style.cssText = 'display:flex;gap:12px;align-items:flex-start';
    var cv = doc.createElement('canvas'); cv.width = 66; cv.height = 96; cv.className = 'portrait';
    cv.style.cssText = 'flex:0 0 66px;background:#f1e3bb;border-radius:10px';
    var body = doc.createElement('div'); body.style.cssText = 'flex:1;min-width:0';
    var kicker = doc.createElement('div'); kicker.style.cssText = 'font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#7a1e2c;opacity:.8';
    var name = doc.createElement('h2'); name.style.cssText = 'margin:2px 0 0;font-size:19px;color:#501214';
    var title = doc.createElement('div'); title.className = 'sc-title'; title.style.cssText = 'font-size:13px;font-weight:700;opacity:.8;margin-bottom:6px';
    var text = doc.createElement('p'); text.className = 'sc-text'; text.style.cssText = 'margin:0;font-size:15px;line-height:1.35';
    body.appendChild(kicker); body.appendChild(name); body.appendChild(title); body.appendChild(text);
    row.appendChild(cv); row.appendChild(body); wrap.appendChild(row);
    var perks = doc.createElement('div'); perks.className = 'sc-benefits'; perks.style.cssText = 'margin-top:10px;font-size:13px;line-height:1.35';
    wrap.appendChild(perks);
    var btns = doc.createElement('div'); btns.style.cssText = 'display:flex;gap:8px;margin-top:12px';
    var skip = doc.createElement('button'); skip.type = 'button'; skip.id = 'btnStorySkip'; skip.style.cssText = 'flex:1;min-height:44px';
    var next = doc.createElement('button'); next.type = 'button'; next.id = 'btnStoryNext'; next.style.cssText = 'flex:1.4;min-height:44px;font-weight:800';
    btns.appendChild(skip); btns.appendChild(next); wrap.appendChild(btns);
    function render() {
      var c = deck[i];
      kicker.textContent = opts.kicker || ''; name.textContent = c.name || ''; title.textContent = c.title || '';
      text.textContent = c.text || '';
      perks.innerHTML = '';
      if (c.benefits && c.benefits.length) {
        var h = doc.createElement('b'); h.textContent = labels.benefits || 'What they do'; perks.appendChild(h);
        var ul = doc.createElement('ul'); ul.style.cssText = 'margin:4px 0 0;padding-left:18px';
        c.benefits.forEach(function (b) { var li = doc.createElement('li'); li.textContent = b; ul.appendChild(li); });
        perks.appendChild(ul);
      }
      next.textContent = i < deck.length - 1 ? (labels.next || 'Next') : (labels.done || 'OK');
      skip.textContent = labels.skip || 'Skip';
      skip.hidden = !!opts.noSkip;
      if (TF.Crew && TF.Crew.paintPortrait) TF.Crew.paintPortrait(cv, c.who);
    }
    var ui = { element: wrap, close: function (silent) {
      if (!wrap.parentNode) return; wrap.remove(); if (SC.open === ui) SC.open = null;
      if (!silent && opts.onClose) opts.onClose();
    } };
    next.onclick = function () { if (i < deck.length - 1) { i++; render(); } else ui.close(); };
    skip.onclick = function () { if (opts.onSkip) opts.onSkip(); ui.close(); };
    render(); doc.body.appendChild(wrap); SC.open = ui;
    try { next.focus(); } catch (e) { /* ignore */ }
    return ui;
  };

  // ---- new-game intro -------------------------------------------------------------------------------
  SC.introDeck = function () {
    return (copy().intro.cards || []).map(function (c) { return { who: c.who, name: c.name, title: c.title, text: SC.fill(c.text) }; });
  };
  function get(k) { var ls = store(); try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v) { var ls = store(); try { if (ls) ls.setItem(k, v); } catch (e) { /* storage blocked */ } }
  SC.introSeen = function () { return get(INTRO_KEY) === '1'; };
  // A brand-new run: campaign Level 1, Day 1 PREP, no stand placed and nothing sold yet.
  SC.isNewGame = function () {
    var W = TF.Week, E = TF.Econ, Sim = TF.Sim;
    return !!(W && W.active && W.active() && W.day === 1 && W.phase === 'prep' && (!E || (E.levelNo || 1) === 1) &&
      Sim && !(Sim.stands || [Sim.stand]).some(function (st) { return st && st.placed; }) && !(Sim.stats && Sim.stats.served));
  };
  SC.maybeIntro = function (force) {
    if (!force && (!auto() || SC.introSeen() || !SC.isNewGame())) return null;
    var resume = document.getElementById('resumeCard');
    if (!force && resume && !resume.hidden) return null;   // the player is choosing Resume / New game first
    var deck = SC.introDeck(); if (!deck.length) return null;
    set(INTRO_KEY, '1');
    var I = copy().intro;
    return SC.show(deck, { kind: 'intro', kicker: '', labels: { next: I.next, done: I.start, skip: I.skip }, onClose: function () { SC.check(); } });
  };

  // ---- character cards ---------------------------------------------------------------------------------
  function cardState() { try { return JSON.parse(get(CARDS_KEY) || '{}') || {}; } catch (e) { return {}; } }
  SC.seen = function () { return cardState().seen || []; };
  SC.available = function (id) {
    var r = roster(id), Sim = TF.Sim; if (!r || !Sim || !Sim.stand) return false;
    if (TF.Crew.hiredSet[id]) return true;   // on the crew = appears
    if (Sim.stand.tier < r.tier) return false;
    if (id === 'aaron') { var day = TF.Econ && TF.Econ.abs ? TF.Econ.abs(TF.Week.day) : (TF.Week && TF.Week.day); return day >= ((TF.Aaron && TF.Aaron.unlockDay) || 3); }
    return true;
  };
  SC.showCharacter = function (id, auto) {
    var c = SC.character(id), K = copy().cards || {};
    return SC.show([c], { kind: 'character', kicker: auto ? (K.heading || 'New crew member') : '', noSkip: !auto,
      labels: { done: K.close || 'Got it', skip: K.skipAll || 'Skip all intros', benefits: K.benefitsHeading },
      onSkip: function () { var s = cardState(); s.off = true; set(CARDS_KEY, JSON.stringify(s)); } });
  };
  // At most one automatic card per campaign day, only in PREP, never over another dialog.
  SC.check = function () {
    if (!auto() || SC.open || !TF.Crew || !(TF.Week && TF.Week.active && TF.Week.active() && TF.Week.phase === 'prep')) return null;
    if (!SC.introSeen() && SC.isNewGame()) return null;   // the intro goes first
    if (['levelStart', 'aaronHire'].some(function (id) { var e = document.getElementById(id); return e && e.parentNode && !e.hidden; })) return null;
    var resume = document.getElementById('resumeCard'); if (resume && !resume.hidden) return null;
    var s = cardState(), day = TF.Econ && TF.Econ.abs ? TF.Econ.abs(TF.Week.day) : TF.Week.day;
    if (s.off || s.day === day) return null;
    var seen = s.seen || [];
    var id = TF.Crew.ROSTER.map(function (r) { return r.id; }).filter(function (x) { return seen.indexOf(x) < 0 && SC.available(x); })[0];
    if (!id) return null;
    s.seen = seen.concat([id]); s.day = day; set(CARDS_KEY, JSON.stringify(s));
    return SC.showCharacter(id, true);
  };
  // A new run forgets the intro and the cards (Save.clear / Campaign.clearForNewRun call this).
  SC.reset = function () { var ls = store(); try { if (ls) { ls.removeItem(INTRO_KEY); ls.removeItem(CARDS_KEY); } } catch (e) { /* ignore */ } };
})(window.TF);
