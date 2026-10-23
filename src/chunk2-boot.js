// Pass 6 Chunk 2 installer: wire text modules after the live game scripts load.
(function (TF) {
  if (!TF) return;
  TF.Chunk2Boot = TF.Chunk2Boot || { status: {} };
  function boot(name, fn) {
    try {
      fn();
      TF.Chunk2Boot.status[name] = true;
    } catch (e) {
      TF.Chunk2Boot.status[name] = false;
      console.warn('[chunk2-boot] ' + name, e);
    }
  }
  function go() {
    boot('speechgate', function () { if (TF.SpeechGate && TF.SpeechGate.install) TF.SpeechGate.install(TF); });
    boot('gala', function () { if (TF.Gala && TF.Gala.install) TF.Gala.install(TF); });
    boot('cast', function () { if (TF.CastLines && TF.CastLines.install) TF.CastLines.install(TF); });
    boot('looks', function () { if (TF.LookQuips && TF.LookQuips.install) TF.LookQuips.install(TF); });
    boot('hints', function () { if (TF.HintsUI && TF.HintsUI.install) TF.HintsUI.install(TF); });
    boot('level', function () { if (TF.LevelTextUI && TF.LevelTextUI.install) TF.LevelTextUI.install(TF); });
    boot('story', function () { if (TF.StoryBeats && TF.StoryBeats.install) TF.StoryBeats.install(TF); });
    boot('aaron', function () { wireAaron(TF); });
    TF.Chunk2Boot.status.results = !!(TF.Results && TF.Results.mount);
    TF.Chunk2Boot.ready = true;
  }

  function wireAaron(TF) {
    if (!TF.Aaron || TF.Aaron._wired) return;
    TF.Aaron._wired = true;
    var instance = null;
    var hireShownFor = null;
    var lastPhaseKey = '';

    function ensureAaron() {
      if (TF.Aaron.live && TF.Aaron.live !== instance) instance = TF.Aaron.live;
      if (instance) return instance;
      if (!TF.Rng || !TF.Ledger) return null;
      var seed = (TF.Rng.seed || 1) ^ 0xAA80;
      var stream = {
        s: seed >>> 0,
        next: function () { this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0; return this.s / 4294967296; },
        getState: function () { return this.s; },
        setState: function (v) { this.s = v >>> 0; }
      };
      instance = TF.Aaron.create({
        rng: stream,
        getCash: function () { return TF.Ledger.cash; },
        postTransaction: function (row) {
          // Same posting path as other hires/wages (Ledger.post / TF.postTransaction).
          if (typeof TF.postTransaction === 'function') TF.postTransaction(row);
          else if (TF.Ledger && TF.Ledger.post) TF.Ledger.post(row);
          else throw new Error('No ledger postTransaction');
        }
      });
      TF.Aaron.live = instance;
      if (TF.Aaron.pendingRestore) { var pending = TF.Aaron.pendingRestore; delete TF.Aaron.pendingRestore; TF.Aaron.restore(pending.state, pending.hired); }
      return instance;
    }
    TF.Aaron.ensure = ensureAaron;

    TF.Aaron.restore = function (saved, hired) {
      var a = ensureAaron();
      if (!saved) {
        instance = null; TF.Aaron.live = null; a = ensureAaron();
        saved = a.getState(); saved.hired = hired; // migrate old roster-only saves
      }
      a.setState(saved); a._bulk = null; hireShownFor = null;
    };
    TF.Aaron.hireLive = function () {
      var a = ensureAaron(); syncDayPhase();
      if (TF.Crew.hiredSet.aaron) return {ok: false, reason: 'alreadyHired'};
      var can = a.canHire(); if (!can.ok) return can;
      if (TF.Crew.blocked('aaron')) return {ok: false, reason: 'blocked'};
      if (!TF.Crew.reserveOk('aaron', 40)) return {ok: false, reason: 'reserve'};
      var r = a.hire();
      if (r.ok) {
        TF.Crew.hiredSet.aaron = true; TF.Crew.applyMods(); TF.Crew.spotKey = '';
        TF.Week.bought('aaron'); TF.Crew.refresh();
        if (TF.Save) TF.Save.write('prep');
      }
      return r;
    };
    // A bulk order reserves eight kits, cooks over time, then posts one contract receipt.
    function bulkStep(a, dt) {
      var E = TF.Econ, st = TF.Sim.stands[0];
      if (!st.placed || !E || !E.on()) return;
      var order = a.getState().orders.filter(function (o) { return o.status === 'requested'; })[0];
      if (!order) return;
      if (!a._bulk || a._bulk.id !== order.id) {
        if (E.kits(st) < order.tacos) return;
        var ks = E.state(); ks.standKits -= order.tacos; E.K.setState(ks); E.sync();
        a._bulk = {id: order.id, left: order.tacos * (st.mods.cookT + st.mods.handT)};
      }
      a._bulk.left -= dt;
      if (a._bulk.left <= 0 && a.completeBulkOrder(order.id)) {
        TF.Sim.stats.served += order.tacos; st.served += order.tacos; st.rev += order.cents / 100;
        a._bulk = null;
      }
    }
    function absDay() {
      return TF.Econ && TF.Econ.abs ? TF.Econ.abs(TF.Week.day) : TF.Week.day;
    }
    function openDuration() { return 180; }

    function syncDayPhase() {
      if ((TF.Save && TF.Save.restoring) || (TF.Campaign && TF.Campaign.busy)) return;
      if (!(TF.Week && TF.Week.active && TF.Week.active())) return;
      var a = ensureAaron(); if (!a) return;
      var abs = absDay();
      var phase = TF.Week.phase;
      var st = a.getState();
      // Monday retry / level reset can rewind the absolute day.
      if (st.day > abs) {
        var rewind = a.getState();
        rewind.day = 0;
        rewind.phase = 'prep';
        rewind.elapsed = 0;
        rewind.openDuration = 0;
        rewind.opened = false;
        rewind.wagePaid = false;
        rewind.westBoosted = false;
        rewind.schedule = [];
        rewind.orders = [];
        rewind.events = [];
        try { a.setState(rewind); } catch (e) { console.warn('[chunk2-boot] aaron rewind', e); }
        st = a.getState();
      }
      if (abs >= 1 && st.day < abs && (phase === 'prep' || phase === 'open' || phase === 'report' || phase === 'close')) {
        try { a.startDay(abs, openDuration(), false); } catch (e) { console.warn('[chunk2-boot] aaron startDay', e); }
      }
    }

    // Pass 7 (Aaron: "I dont like the hire aaron pop up"): no automatic hire pop-up. Aaron is hired from
    // the Hire menu; his character card (src/storycards.js) introduces him like the rest of the crew.
    function onWeekEvent() {
      syncDayPhase();
      if (TF.StoryCards) TF.StoryCards.check();
      var key = (TF.Week && TF.Week.day) + ':' + (TF.Week && TF.Week.phase);
      if (key !== lastPhaseKey) lastPhaseKey = key;
    }
    TF.Aaron.onLevelReset = function () {
      hireShownFor = null;
      var a = TF.Aaron.live;
      if (!a) return;
      try {
        var st = a.getState();
        if (!st.hired) { instance = null; TF.Aaron.live = null; return; }
        st.day = 0; st.phase = 'prep'; st.elapsed = 0; st.openDuration = 0;
        st.opened = false; st.wagePaid = false; st.westBoosted = false;
        st.schedule = []; st.orders = []; st.events = [];
        a.setState(st);
      } catch (e) { console.warn('[chunk2-boot] aaron onLevelReset', e); }
    };

    // Drive hire/day sync from Week phase transitions (not a polling interval).
    if (TF.Week) {
      var prevRefresh = TF.Week.refresh;
      TF.Week.refresh = function () {
        var r = prevRefresh.apply(this, arguments);
        try { onWeekEvent(); } catch (e) { console.warn('[chunk2-boot] aaron refresh', e); }
        return r;
      };
      var prevOpen = TF.Week.openDay;
      if (typeof prevOpen === 'function') {
        TF.Week.openDay = function () {
          var r = prevOpen.apply(this, arguments);
          try { onWeekEvent(); } catch (e) { console.warn('[chunk2-boot] aaron openDay', e); }
          return r;
        };
      }
      var prevReset = TF.Week.resetForLevel;
      if (typeof prevReset === 'function') {
        TF.Week.resetForLevel = function () {
          var r = prevReset.apply(this, arguments);
          try { TF.Aaron.onLevelReset(); onWeekEvent(); } catch (e) { console.warn('[chunk2-boot] aaron reset', e); }
          return r;
        };
      }
    }

    TF.plugins.push({
      step: function (dt) {
        var a = TF.Aaron.live;
        if (!a || !(TF.Week && TF.Week.active && TF.Week.active())) return;
        var abs = absDay();
        var phase = TF.Week.phase;
        var mapPhase = phase === 'close' || phase === 'closed' ? 'close' : phase;
        if (['prep', 'open', 'close', 'report'].indexOf(mapPhase) < 0) return;
        try {
          syncDayPhase();
          if (a.getState().day === abs) a.step(dt, abs, mapPhase);
          if (phase === 'open' && a.getState().hired) bulkStep(a, dt);
          a.drainEvents();
        } catch (e) {
          var msg = (e && e.message) || String(e);
          // Aaron.step throws these on legitimate Week phase transitions; do not spam the console.
          if (!/Invalid step context|Day already advanced/.test(msg)) {
            console.warn('[chunk2-boot] aaron step', e);
          }
        }
        if (!a.getState().hired || phase !== 'open') return;
        a._idleT = (a._idleT || 12) - dt;
        if (a._idleT > 0) return;
        a._idleT = 14;
        var line = TF.Aaron.idleLine({ next: function () { return TF.Rng && TF.Rng.ambient ? TF.Rng.ambient() : 0; } });
        if (line && TF.Arcs && TF.Render && TF.Crew && TF.Crew.spotOf) {
          var gate = TF.SpeechGate;
          if (gate && gate.begin(line, { critical: false, secs: 3.5 }) !== 'live') return;
          var spot = TF.Crew.spotOf('aaron') || TF.Crew.spotOf('jared');
          if (spot) {
            var p = TF.Render.toScreen(spot.x, spot.y);
            TF.Arcs.bubbles.push({ text: line, x: p.x, y: p.y - 56 * TF.Render.cam.z, bg: 'rgba(80,18,20,0.92)' });
          }
        }
      }
    });

    // Initial sync once Week is live.
    setTimeout(function () { try { onWeekEvent(); } catch (e) { console.warn('[chunk2-boot] aaron boot', e); } }, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else setTimeout(go, 0);
})(window.TF);
