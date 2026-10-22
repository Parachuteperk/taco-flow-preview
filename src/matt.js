(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Matt = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var BREAKDOWNS = [
    { id: 'grill', name: 'Grill sputters', fixTime: 4, effect: { cookSpeedMultiplier: 0.7 } },
    { id: 'trash', name: 'Trash can tipped over', fixTime: 3, effect: { litter: true, nearbyPatienceDeltaS: -3 } },
    { id: 'cooler', name: 'Cooler jammed', fixTime: 4, effect: { drinkSales: false } },
    { id: 'banner', name: 'Banner flickering', fixTime: 3, effect: { drawRadiusDeltaTiles: -1 } },
    { id: 'cornhole', name: 'Cornhole board warped', fixTime: 3, effect: { lingering: false } },
    { id: 'lights', name: 'String lights shorted', fixTime: 5, effect: { nightBonus: false } }
  ];
  var BUILD_TIMES = { small: 6, medium: 12, large: 25, foodTruck: 25 };
  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function number(x) { return typeof x === 'number' && isFinite(x) && x >= 0; }
  function integer(x, lo, hi) { return number(x) && Math.floor(x) === x && x >= lo && x <= hi; }
  function point(p) { return p && typeof p.x === 'number' && isFinite(p.x) && typeof p.y === 'number' && isFinite(p.y); }
  function definition(id) { return BREAKDOWNS.filter(function (b) { return b.id === id; })[0]; }
  // Geometry is in tiles; time is in simulation seconds. rng must implement
  // next/getState/setState. getTarget(id) returns {x,y} or null when removed;
  // getBreakdownTargets() returns [{targetId, breakdown: 'grill' | ...}].
  // Handlers receive (job, {day,phase}); register them again after loading.
  function create(options) {
    options = options || {};
    var rng = options.rng, handlers = Object.create(null), stand = options.stand || { x: 0, y: 0 };
    var baseSpeed = options.walkSpeed === undefined ? 1 : options.walkSpeed;
    var radius = options.groupRadius === undefined ? 4 : options.groupRadius;
    if (!rng || ['next', 'getState', 'setState'].some(function (k) { return typeof rng[k] !== 'function'; }) ||
        typeof options.pathLength !== 'function' || typeof options.getTarget !== 'function') {
      throw new TypeError('rng stream, pathLength and getTarget are required');
    }
    if (!point(stand) || !number(baseSpeed) || baseSpeed === 0 || !number(radius)) throw new TypeError('Invalid geometry');
    var state = { version: 1, day: 0, week: 1, phase: 'prep', level: 1, mode: 'AT_STAND',
      position: copy(stand), jobs: [], queue: [], trip: [], currentId: null, leg: null,
      returning: false, quick: false, rushed: false, rushDay: 0, chaseDay: 0, chaseRemaining: 0,
      truceDay: 0, faults: [], schedule: [], elapsed: 0, openDuration: 0, nextId: 1 };
    function random() {
      var value = rng.next();
      if (!number(value) || value >= 1) throw new RangeError('rng.next must return [0,1)');
      return value;
    }
    function distance(a, b) {
      var d = options.pathLength(copy(a), copy(b));
      if (!number(d)) throw new RangeError('Invalid path length');
      return d;
    }
    function speed() { return baseSpeed * (state.level >= 2 ? 1.25 : 1) * (state.rushed ? 1.5 : 1); }
    function workSpeed() { return state.level >= 3 ? 2 : 1; }
    function job(id) { return state.jobs.filter(function (j) { return j.id === id; })[0]; }
    function live(j) { return j && ['queued', 'walking', 'working', 'paused'].indexOf(j.status) !== -1; }
    function target(j) { var p = options.getTarget(j.targetId); return point(p) ? { x: p.x, y: p.y } : null; }
    function fault(j) { return state.faults.filter(function (f) { return f.jobId === j.id; })[0]; }
    function clearFault(j) { state.faults = state.faults.filter(function (f) { return f.jobId !== j.id; }); }
    function removeFromQueue(j) {
      state.queue = state.queue.filter(function (id) { return id !== j.id; });
      state.trip = state.trip.filter(function (id) { return id !== j.id; });
    }
    function prune() {
      state.jobs.forEach(function (j) {
        if (live(j) && !target(j)) { j.status = 'cancelled'; clearFault(j); removeFromQueue(j); }
      });
    }
    function quick(j) {
      var f = fault(j), p = target(j);
      return state.level >= 3 && f && definition(f.breakdown).fixTime < 4 && p && distance(stand, p) <= 3;
    }
    function group() {
      var ids = state.queue.filter(function (id) { return live(job(id)) && target(job(id)); });
      if (state.level >= 3) ids.sort(function (a, b) {
        return Number(!!fault(job(b)) && fault(job(b)).breakdown === 'grill') - Number(!!fault(job(a)) && fault(job(a)).breakdown === 'grill');
      });
      var trips = [];
      while (ids.length) {
        var first = ids.shift(), batch = [first];
        if (state.level >= 2 && !quick(job(first))) {
          for (var i = 0; i < ids.length; i++) {
            if (!quick(job(ids[i])) && distance(target(job(first)), target(job(ids[i]))) <= radius) {
              batch.push(ids.splice(i, 1)[0]); break;
            }
          }
        }
        trips.push(batch);
      }
      return trips;
    }
    function leg(to, returning, length) {
      state.leg = { from: copy(state.position), to: copy(to), length: length === undefined ? distance(state.position, to) : length, remaining: 0 };
      state.leg.remaining = state.leg.length;
      state.returning = returning; state.mode = 'WALKING';
    }
    function home() {
      state.currentId = null; state.quick = false; state.trip = [];
      leg(stand, true);
    }
    function begin(id) {
      var j = job(id), p = target(j);
      if (!p) return false;
      state.currentId = id; state.quick = quick(j) && state.mode === 'AT_STAND';
      j.status = 'walking';
      if (state.quick) { j.status = 'working'; state.mode = 'AT_STAND'; }
      else leg(p, false);
      return true;
    }
    function enqueue(input) {
      if (!input || typeof input.id !== 'string' || !input.id || typeof input.targetId !== 'string' ||
          !input.targetId || typeof input.kind !== 'string' || !input.kind || !number(input.workRemaining)) throw new TypeError('Invalid job');
      if (job(input.id)) return { ok: false, reason: 'duplicateId' };
      if (state.jobs.some(function (j) { return live(j) && j.targetId === input.targetId && j.kind === input.kind; })) return { ok: false, reason: 'duplicateJob' };
      if (!target(input)) return { ok: false, reason: 'targetRemoved' };
      if (input.kind !== 'repair' && !handlers[input.kind]) return { ok: false, reason: 'missingHandler' };
      if (input.kind !== 'repair' && state.phase === 'open' && state.openDuration - state.elapsed <= 20) return { ok: false, reason: 'buildCutoff' };
      var j = { id: input.id, targetId: input.targetId, kind: input.kind, workRemaining: input.workRemaining, status: 'queued' };
      state.jobs.push(j); state.queue.push(j.id);
      return { ok: true, job: copy(j) };
    }
    function spawnFaults() {
      var cap = state.week < 4 ? 1 : 2;
      state.schedule.forEach(function (event) {
        if (event.done || event.at > state.elapsed || state.faults.length >= cap) return;
        var candidates = (options.getBreakdownTargets ? options.getBreakdownTargets() : []).filter(function (c) {
          return definition(c.breakdown) && target(c) && !state.faults.some(function (f) { return f.targetId === c.targetId; });
        });
        if (!candidates.length) return; // Defer, rather than consume a capped or impossible event.
        var c = candidates[Math.floor(event.pick * candidates.length)], b = definition(c.breakdown);
        event.done = true;
        if (state.level >= 2 && distance(stand, target(c)) <= 4 && event.prevention < 0.25) return;
        var id = 'fault-' + state.day + '-' + state.nextId++;
        while (job(id)) id += '-';
        var result = enqueue({ id: id, targetId: c.targetId, kind: 'repair', workRemaining: b.fixTime });
        if (!result.ok) { event.done = false; return; }
        state.faults.push({ jobId: id, targetId: c.targetId, breakdown: b.id, effect: copy(b.effect) });
      });
    }
    function eta() {
      if (state.returning) return state.leg.remaining / speed();
      if (!state.currentId) return 0;
      var total = state.chaseRemaining, pos = state.position;
      if (state.leg) { total += state.leg.remaining / speed(); pos = state.leg.to; }
      state.trip.forEach(function (id, index) {
        var j = job(id), p = target(j);
        if (!live(j) || !p) return;
        if (!state.quick && !(index === 0 && state.leg)) total += distance(pos, p) / speed();
        total += j.workRemaining / workSpeed();
        if (!state.quick) pos = p;
      });
      if (!state.quick) total += distance(pos, stand) / speed();
      return total;
    }
    var api = {
      registerHandler: function (kind, handler) {
        if (typeof kind !== 'string' || typeof handler !== 'function') throw new TypeError('Invalid handler');
        handlers[kind] = handler;
      },
      // Call once per new day. Repeating the same day is idempotent, so daily
      // actions cannot be replenished by re-entering PREP. Jobs/travel carry over.
      startDay: function (day, week, openDuration) {
        if (!integer(day, 1, 20) || !integer(week, 1, 4) || Math.ceil(day / 5) !== week || !number(openDuration) || openDuration === 0) throw new RangeError('Invalid day, week or duration');
        if (day === state.day) return false;
        if (day < state.day) throw new RangeError('Days must advance');
        state.day = day; state.week = week; state.phase = 'prep'; state.elapsed = 0; state.openDuration = openDuration;
        var count = [2, 2, 3, 4][week - 1]; state.schedule = [];
        for (var i = 0; i < count; i++) state.schedule.push({ at: (i + random()) * openDuration / count, pick: random(), prevention: random(), done: false });
        return true;
      },
      setLevel: function (level) {
        if (!integer(level, 1, 3)) throw new RangeError('Level must be 1..3');
        if (level === 3 && state.level < 3) state.truceDay = state.day;
        state.level = level;
      },
      enqueue: enqueue,
      prioritize: function (id) {
        if (state.currentId || state.returning || state.queue.indexOf(id) < 0) return false;
        state.queue.splice(state.queue.indexOf(id), 1); state.queue.unshift(id); return true;
      },
      getQueue: function () { return state.queue.map(function (id) { return copy(job(id)); }); },
      getTrips: function () { return copy(group()); },
      dispatch: function () {
        prune();
        if (!state.day || ['prep', 'open'].indexOf(state.phase) < 0 || state.currentId || state.mode !== 'AT_STAND') return false;
        var trips = group(); if (!trips.length) return false;
        state.trip = trips[0]; return begin(state.trip[0]);
      },
      callBack: function () {
        if (state.returning || !state.currentId) return false;
        var j = job(state.currentId); if (live(j)) j.status = 'paused';
        state.chaseRemaining = 0;
        if (state.quick) { state.currentId = null; state.trip = []; state.quick = false; return true; }
        // Mid-leg returns retrace the distance already walked, then follow the
        // injected route from that leg's origin back to the stand.
        var back = state.leg ? state.leg.length - state.leg.remaining + distance(state.leg.from, stand) : distance(state.position, stand);
        home(); state.leg.length = back; state.leg.remaining = back; return true;
      },
      rush: function (westVisiting) {
        if (!state.currentId || state.returning || state.quick || state.rushDay === state.day || state.rushed) return false;
        state.rushDay = state.day; state.rushed = true;
        if (westVisiting && options.onWestMood) options.onWestMood(-1, { day: state.day, phase: state.phase });
        return true;
      },
      // Caller supplies the explicit gag event; no frame-dependent RNG draws.
      chase: function () {
        if (!state.currentId || state.leg || state.quick || state.chaseDay === state.day || state.truceDay === state.day) return false;
        state.chaseDay = state.day; state.chaseRemaining = 2; state.mode = 'CHASING'; return true;
      },
      handoffTime: function (base, cover) {
        if (!number(base)) throw new TypeError('Invalid hand-off time');
        return state.mode === 'AT_STAND' ? 0.25 : base * (cover === 'jared' || cover === 'phillip' ? 0.8 : 1);
      },
      eta: eta,
      getFaults: function () { return copy(state.faults); },
      // Closed/report phases freeze travel and work. OPEN elapsed time drives
      // seeded events and the ordering cutoff; it does not finish existing builds.
      step: function (dt, day, phase) {
        if (!number(dt) || day !== state.day || !state.day || ['prep', 'open', 'close', 'closed', 'report'].indexOf(phase) < 0) throw new RangeError('Invalid step context');
        state.phase = phase; prune();
        if (['prep', 'open'].indexOf(phase) < 0) return;
        var remaining = dt;
        // Advance at breakdown boundaries as well as travel/work boundaries,
        // keeping fault generation independent of the caller's frame size.
        while (true) {
          if (phase === 'open') spawnFaults();
          if (state.currentId && !live(job(state.currentId))) {
            if (state.leg) api.callBack(); else home();
          }
          if (state.leg && state.leg.remaining === 0) {
            state.position = copy(state.leg.to); state.leg = null;
            if (state.returning) { state.returning = false; state.rushed = false; state.mode = 'AT_STAND'; }
            else { job(state.currentId).status = 'working'; state.mode = job(state.currentId).kind === 'repair' ? 'FIXING' : 'BUILDING'; }
            continue;
          }
          var j = job(state.currentId);
          if (j && !state.leg && !state.chaseRemaining && j.workRemaining === 0) {
            if (j.kind !== 'repair' && !handlers[j.kind]) throw new Error('Missing completion handler: ' + j.kind);
            if (handlers[j.kind]) handlers[j.kind](copy(j), { day: state.day, phase: state.phase });
            j.status = 'completed'; clearFault(j); removeFromQueue(j); state.currentId = null;
            if (state.quick) { state.trip = []; state.quick = false; state.mode = 'AT_STAND'; }
            else if (state.trip.length) begin(state.trip[0]);
            else home();
            continue;
          }
          if (remaining <= 0) break;
          var slice = remaining;
          if (phase === 'open') state.schedule.forEach(function (e) { if (!e.done && e.at > state.elapsed) slice = Math.min(slice, e.at - state.elapsed); });
          if (state.leg) slice = Math.min(slice, state.leg.remaining / speed());
          else if (state.chaseRemaining) slice = Math.min(slice, state.chaseRemaining);
          else if (j) slice = Math.min(slice, j.workRemaining / workSpeed());
          if (state.leg) {
            state.leg.remaining = Math.max(0, state.leg.remaining - slice * speed());
            if (state.leg.remaining < 1e-10) state.leg.remaining = 0;
          }
          else if (state.chaseRemaining) {
            state.chaseRemaining = Math.max(0, state.chaseRemaining - slice);
            if (state.chaseRemaining < 1e-10) state.chaseRemaining = 0;
            if (!state.chaseRemaining) state.mode = j.kind === 'repair' ? 'FIXING' : 'BUILDING';
          } else if (j) {
            j.workRemaining = Math.max(0, j.workRemaining - slice * workSpeed());
            if (j.workRemaining < 1e-10) j.workRemaining = 0;
          }
          if (phase === 'open') state.elapsed += slice;
          remaining = Math.max(0, remaining - slice);
        }
      },
      getState: function () { var saved = copy(state); saved.rngState = copy(rng.getState()); return saved; },
      setState: function (saved) {
        if (!saved || saved.version !== 1 || !Array.isArray(saved.jobs) || !Array.isArray(saved.queue) || !Array.isArray(saved.trip) ||
            !Array.isArray(saved.faults) || !Array.isArray(saved.schedule) || !integer(saved.level, 1, 3) || !point(saved.position) || saved.rngState === undefined) throw new TypeError('Invalid Matt save');
        var restored = copy(saved); rng.setState(restored.rngState); delete restored.rngState; state = restored;
      }
    };
    return api;
  }
  return { create: create, breakdowns: copy(BREAKDOWNS), buildTimes: copy(BUILD_TIMES), levelCosts: [3000, 6000] };
}));
