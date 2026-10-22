(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Aaron = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function integer(x, lo, hi) { return Number.isSafeInteger(x) && x >= lo && x <= hi; }
  function number(x) { return typeof x === 'number' && isFinite(x) && x >= 0; }
  function point(p) { return p && Number.isFinite(p.x) && Number.isFinite(p.y); }
  // Pure, non-stacking patience allowance; positions are world tiles, time is seconds.
  function patienceBonus(position, customer, hired) {
    if (!point(position) || !customer || !point(customer.position)) throw new TypeError('Invalid positions');
    var dx = position.x - customer.position.x, dy = position.y - customer.position.y;
    // Allow rounding at fractional-coordinate boundary points (e.g. 1.8, 2.4).
    return hired && customer.waiting === true && dx * dx + dy * dy <= 9 + Number.EPSILON * 36 ? 8 : 0;
  }
  // Dedicated seeded stream: next() -> [0,1), getState(), setState(value).
  // All callbacks stay outside the JSON save. Transactions use ledger categories.
  function create(options) {
    options = options || {};
    var rng = options.rng;
    if (!rng || ['next', 'getState', 'setState'].some(function (k) { return typeof rng[k] !== 'function'; }) ||
        typeof options.getCash !== 'function' || typeof options.postTransaction !== 'function') {
      throw new TypeError('rng stream, getCash and postTransaction are required');
    }
    var state = { version: 1, hired: false, level: 1, day: 0, phase: 'prep', elapsed: 0,
      openDuration: 0, opened: false, wagePaid: false, westVisiting: false, westBoosted: false,
      blazer: false, schedule: [], orders: [], events: [], weeklySynergy: {} };
    function random() {
      var r = rng.next();
      if (!number(r) || r >= 1) throw new RangeError('rng.next must return [0,1)');
      return r;
    }
    function post(cat, cents, ref, phase) {
      options.postTransaction({ day: state.day, phase: phase || state.phase, cat: cat, cents: cents, ref: ref });
    }
    function emit(type, at, extra) {
      var event = { type: type, day: state.day, at: at };
      Object.keys(extra || {}).forEach(function (k) { event[k] = extra[k]; });
      state.events.push(event);
    }
    function preparePlan(level) {
      var orders = [], entries = [], before = copy(rng.getState());
      function schedule(type, fraction, extra) {
        entries.push({ type: type, at: state.openDuration * fraction, done: false, data: extra || {} });
      }
      try {
        // One uniform dollar draw; max of two draws at L2+ stochastically favors bigger orders.
        var count = level >= 3 ? 2 : 1;
        for (var i = 0; i < count; i++) {
          var r = random();
          if (level >= 2) r = Math.max(r, random());
          var order = { id: 'aaron:' + state.day + ':' + (i + 1), day: state.day,
            tacos: 8, cents: (20 + Math.floor(r * 21)) * 100, status: 'scheduled' };
          orders.push(order);
          schedule('bulkOrder', i ? 0.7 : 0.2, { orderId: order.id });
        }
        schedule('businessCard', 0.1, { target: ['customer', 'grackle', 'statue'][Math.floor(random() * 3)] });
        schedule('synergy', 0.15); schedule('synergy', 0.65);
        schedule('linkedin', 0.4, { duration: 3, line: 'Humbled to announce we sold a taco.' });
        entries.sort(function (a, b) { return a.at - b.at; });
        return { orders: orders, schedule: entries };
      } catch (error) { rng.setState(before); throw error; }
    }
    function applyPlan(prepared) {
      state.orders = prepared.orders; state.schedule = prepared.schedule;
    }
    function plan() {
      if (state.hired && !state.schedule.length) applyPlan(preparePlan(state.level));
    }
    function payWage() {
      if (!state.day || !state.hired || state.wagePaid) return false;
      post('wages', -800, 'aaron:wage:' + state.day, 'report');
      state.wagePaid = true; return true;
    }
    function westBonus() {
      if (!state.hired || !state.westVisiting || state.westBoosted) return;
      emit('westMood', state.elapsed, { tiers: 1 }); state.westBoosted = true;
    }
    var api = {
      startDay: function (day, openDuration, westVisiting) {
        if (!integer(day, 1, 20) || !number(openDuration) || openDuration <= 0 || typeof westVisiting !== 'boolean') throw new RangeError('Invalid day context');
        if (day <= state.day) return false;
        // Settle any missed report before moving forward; no duplicate daily charges.
        payWage();
        state.day = day; state.phase = 'prep'; state.elapsed = 0; state.openDuration = openDuration;
        state.opened = false; state.wagePaid = false; state.westVisiting = westVisiting; state.westBoosted = false;
        state.blazer = state.hired && day === 20; state.schedule = []; state.orders = [];
        plan(); westBonus(); return true;
      },
      canHire: function () {
        if (state.hired) return { ok: false, reason: 'alreadyHired' };
        if (state.day < 3) return { ok: false, reason: 'dayLocked' };
        if (state.phase !== 'prep') return { ok: false, reason: 'prepOnly' };
        var cash = options.getCash();
        if (!Number.isSafeInteger(cash)) throw new TypeError('getCash must return integer cents');
        return cash >= 4000 ? { ok: true, reason: null } : { ok: false, reason: 'insufficientCash' };
      },
      hire: function () {
        var result = api.canHire();
        if (!result.ok) return result;
        var before = copy(rng.getState()), prepared = preparePlan(state.level);
        try { post('hire', -4000, 'aaron:hire'); }
        catch (error) { rng.setState(before); throw error; }
        state.hired = true; applyPlan(prepared);
        state.blazer = state.day === 20; westBonus(); return result;
      },
      // Adapter owns upgrade debits. PREP changes replan today; OPEN changes apply tomorrow.
      setLevel: function (level) {
        if (!integer(level, 1, 3)) throw new RangeError('Level must be 1..3');
        if (level !== state.level && state.hired && state.phase === 'prep') applyPlan(preparePlan(level));
        state.level = level;
      },
      patienceBonus: function (position, customer) { return patienceBonus(position, customer, state.hired); },
      payWage: payWage,
      // Adapter calls only after the kitchen has consumed/cooked all eight tacos.
      // Revenue is booked here, so kitchen completion must suppress ordinary sale rows.
      completeBulkOrder: function (id) {
        var order = state.orders.filter(function (o) { return o.id === id; })[0];
        if (state.phase !== 'open' || !order || order.status !== 'requested') return false;
        post('sales', order.cents, order.id); order.status = 'fulfilled'; return true;
      },
      weeklyReport: function (week) {
        if (!integer(week, 1, 4)) throw new RangeError('Week must be 1..4');
        return { week: week, synergy: state.weeklySynergy[week] || 0 };
      },
      drainEvents: function () { var events = copy(state.events); state.events = []; return events; },
      activity: function () {
        if (!state.hired || state.phase !== 'open') return { mode: 'idle', remaining: 0 };
        var linkedin = state.schedule.filter(function (e) { return e.type === 'linkedin' && e.done && state.elapsed < e.at + 3; })[0];
        if (linkedin) return { mode: 'linkedin', remaining: linkedin.at + 3 - state.elapsed };
        return state.elapsed < 1 ? { mode: 'fistBump', remaining: 1 - state.elapsed } : { mode: 'pitch', remaining: 0 };
      },
      step: function (dt, day, phase) {
        if (!number(dt) || !state.day || day !== state.day || ['prep', 'open', 'close', 'closed', 'report'].indexOf(phase) < 0) throw new RangeError('Invalid step context');
        // Reject reopening after close/report to avoid phase replay exploits.
        if ((state.phase !== 'prep' && phase === 'prep') || (['close', 'closed', 'report'].indexOf(state.phase) >= 0 && phase === 'open')) throw new RangeError('Day already advanced');
        state.phase = phase;
        if (phase === 'report') payWage();
        if (phase !== 'open' || !state.hired) return;
        if (!state.opened) { emit('fistBump', 0, { duration: 1, morale: true, target: 'crew' }); state.opened = true; }
        var end = Math.min(state.openDuration, state.elapsed + dt);
        state.schedule.forEach(function (e) {
          if (e.done || e.at > end) return;
          e.done = true;
          if (e.type === 'bulkOrder') {
            var order = state.orders.filter(function (o) { return o.id === e.data.orderId; })[0];
            if (order.status !== 'scheduled') return;
            order.status = 'requested'; emit(e.type, e.at, { order: copy(order) });
          } else {
            if (e.type === 'synergy') {
              var week = Math.ceil(state.day / 5);
              state.weeklySynergy[week] = (state.weeklySynergy[week] || 0) + 1;
            }
            emit(e.type, e.at, copy(e.data));
          }
        });
        state.elapsed = end;
      },
      getState: function () { var saved = copy(state); saved.rngState = copy(rng.getState()); return saved; },
      setState: function (saved) {
        if (!saved || saved.version !== 1 || !integer(saved.day, 0, 20) || !integer(saved.level, 1, 3) ||
            !number(saved.elapsed) || !number(saved.openDuration) || saved.elapsed > saved.openDuration ||
            ['prep', 'open', 'close', 'closed', 'report'].indexOf(saved.phase) < 0 ||
            ['hired', 'opened', 'wagePaid', 'westVisiting', 'westBoosted', 'blazer'].some(function (k) { return typeof saved[k] !== 'boolean'; }) ||
            !Array.isArray(saved.schedule) || !Array.isArray(saved.orders) || !Array.isArray(saved.events) ||
            !saved.weeklySynergy || typeof saved.weeklySynergy !== 'object' || saved.rngState === undefined) throw new TypeError('Invalid Aaron save');
        if (saved.orders.length > 2 || saved.orders.some(function (o, i) {
          return !o || o.id !== 'aaron:' + saved.day + ':' + (i + 1) || o.day !== saved.day || o.tacos !== 8 ||
            !integer(o.cents, 2000, 4000) || o.cents % 100 !== 0 || ['scheduled', 'requested', 'fulfilled'].indexOf(o.status) < 0;
        }) || saved.schedule.some(function (e) {
          return !e || !number(e.at) || e.at > saved.openDuration || typeof e.done !== 'boolean' || !e.data ||
            ['bulkOrder', 'businessCard', 'synergy', 'linkedin'].indexOf(e.type) < 0 ||
            (e.type === 'bulkOrder' && !saved.orders.some(function (o) { return o.id === e.data.orderId; }));
        }) || Object.keys(saved.weeklySynergy).some(function (week) {
          return !integer(+week, 1, 4) || !integer(saved.weeklySynergy[week], 0, Number.MAX_SAFE_INTEGER);
        })) throw new TypeError('Invalid Aaron save data');
        // Each order has exactly one trigger. Completed triggers cannot resurrect scheduled
        // orders, and pending triggers cannot replay requested/fulfilled revenue.
        if (saved.orders.some(function (o) {
          var triggers = saved.schedule.filter(function (e) { return e.type === 'bulkOrder' && e.data.orderId === o.id; });
          return triggers.length !== 1 || triggers[0].done !== (o.status !== 'scheduled') ||
            (triggers[0].done && triggers[0].at > saved.elapsed) ||
            (!triggers[0].done && saved.opened && triggers[0].at <= saved.elapsed);
        })) throw new TypeError('Inconsistent Aaron order schedule');
        var restored = copy(saved); rng.setState(restored.rngState); delete restored.rngState; state = restored;
      }
    };
    return api;
  }
  function textData() {
    if (typeof TF !== 'undefined') return { AARON_HIRE: TF.AARON_HIRE, AARON_IDLE: TF.AARON_IDLE };
    try { return require('../data/aaron-text'); } catch (e) { return {}; }
  }
  function idleLine(rng) {
    var lines = textData().AARON_IDLE || [];
    if (!lines.length) return '';
    var r = rng && typeof rng.next === 'function' ? rng.next() : Math.random();
    return lines[Math.floor(r * lines.length) % lines.length];
  }
  function mountHire(host, api, opts) {
    opts = opts || {};
    if (!host || !host.ownerDocument) throw new TypeError('Host required');
    var T = textData().AARON_HIRE || {};
    var doc = host.ownerDocument, wrap = doc.createElement('section');
    wrap.id = 'aaronHire';
    wrap.setAttribute('role', 'dialog');
    wrap.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1005;width:min(360px,calc(100% - 32px));box-sizing:border-box;background:#fff5d6;border:3px solid #501214;border-radius:12px;padding:14px;color:#2a1810;overflow-wrap:anywhere;word-break:break-word';
    function p(text) {
      var el = doc.createElement('p'); el.textContent = text; el.style.cssText = 'margin:0 0 6px;overflow-wrap:anywhere'; wrap.appendChild(el);
    }
    (T.offer || []).forEach(function (line) { p((line.who ? line.who.toUpperCase() + ': ' : '') + line.text); });
    var h = doc.createElement('h2'); h.textContent = T.cardTitle || 'Aaron - SIFE';
    h.style.cssText = 'margin:8px 0 4px;font-size:16px;color:#7a1e2c;overflow-wrap:anywhere'; wrap.appendChild(h);
    p(T.cardBody || '');
    p((T.perkName || 'Elevator Pitch') + ': ' + (T.perkDesc || ''));
    var btns = doc.createElement('div'); btns.style.cssText = 'display:flex;gap:8px;margin-top:10px';
    var hire = doc.createElement('button'); hire.type = 'button'; hire.textContent = T.hireBtn || 'Hire $40';
    hire.style.cssText = 'flex:1;min-height:44px';
    var pass = doc.createElement('button'); pass.type = 'button'; pass.textContent = T.passBtn || 'Not now';
    pass.style.cssText = 'flex:1;min-height:44px';
    hire.onclick = function () {
      var r = api && api.hire ? api.hire() : { ok: false };
      if (r && r.ok) wrap.remove();
      if (r && r.ok && opts.onHired) opts.onHired(T.hired || []);
      else if (opts.onResult) opts.onResult(r);
    };
    pass.onclick = function () {
      wrap.remove();
      if (opts.onPassed) opts.onPassed(T.passed || []);
    };
    btns.appendChild(hire); btns.appendChild(pass); wrap.appendChild(btns);
    host.appendChild(wrap); hire.focus();
    return { element: wrap, destroy: function () { wrap.remove(); } };
  }
  return {
    create: create, patienceBonus: patienceBonus, hireCents: 4000, wageCents: 800, unlockDay: 3,
    idleLine: idleLine, mountHire: mountHire, text: textData
  };
}));
