/* Game-state summary with Board data contracts and ShareCard presentation. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./board.js'), require('./sharecard.js'));
  else { root.TF = root.TF || {}; root.TF.Results = factory(root.TF.Board, root.TF.ShareCard); }
})(typeof self !== 'undefined' ? self : this, function (Board, ShareCard) {
  'use strict';
  var R = {}, SAFE = 9007199254740991;
  function integer(n, lo, hi) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= lo && n <= hi; }
  function checked(p) {
    var e = Board.encode(p);
    if (!Board.decode(e.r, e.c).verified) throw new TypeError('Invalid v1 results payload');
    return p;
  }
  R.cleanName = Board.cleanName;
  // Preserve Results' string/payload return values; Board owns the wire contract.
  R.encode = function (payload) { return Board.encode(checked(payload)).r; };
  R.decode = function (r) { var d = Board.decode(r); return d.ok ? d.result : null; };
  /* Input: name, operatingProfitCents, tradingNetCents, seed, date (YYYY-MM-DD),
     bestStock (display string), crewStats ({id:{fixes,sales,hacks}}), and
     west (West.getState() snapshot) or flat rentRecords/attempts/mood/hard.
     All money already uses integer cents. No clock or live game reads. */
  R.buildPayload = function (state) {
    if (!state || typeof state !== 'object') throw new TypeError('State required');
    var w = state.west || state, records = w.rentRecords, attempts = w.attempts;
    if (!Array.isArray(records) || records.length !== 4 || !records.every(function (r) { return ['unpaid', 'firstTry', 'retry'].indexOf(r) >= 0; }) ||
        !Array.isArray(attempts) || attempts.length !== 4 || !attempts.every(function (n) { return integer(n, 0, SAFE); }) ||
        !integer(state.operatingProfitCents, -SAFE, SAFE) || !integer(state.tradingNetCents, -SAFE, SAFE) || !integer(w.mood, 0, 10) ||
        [true, false, 0, 1].indexOf(w.hard) < 0) throw new TypeError('Invalid score state');
    var paid = 0, rentScore = 0, retries = 0;
    records.forEach(function (r, i) { if (r !== 'unpaid') paid++; rentScore += r === 'firstTry' ? 100 : r === 'retry' ? 50 : 0; retries += Math.max(0, attempts[i] - 1); });
    var score = rentScore + Math.min(300, Math.floor(Math.max(0, state.operatingProfitCents) / 1000)) + w.mood * 20 +
      Math.max(-50, Math.min(100, Math.trunc(state.tradingNetCents / 2500)));
    var mvp = '', best = 0, crew = state.crewStats || {};
    Object.keys(crew).forEach(function (id) {
      var c = crew[id], total = 0;
      ['fixes', 'sales', 'hacks'].forEach(function (k) {
        var n = c && c[k] === undefined ? 0 : c && c[k];
        if (!integer(n, 0, SAFE)) throw new TypeError('Invalid crew count');
        total += n;
      });
      if (!integer(total, 0, SAFE)) throw new TypeError('Invalid crew total');
      if (total > best) { best = total; mvp = id; }
    });
    score = Math.max(0, Math.min(1000, score));
    return checked({ v: 1, n: Board.cleanName(state.name), s: score, w: score >= 700 ? 1 : 0, rent: paid + '/4', rt: retries,
      p: state.operatingProfitCents, m: w.mood, bs: state.bestStock === undefined ? '' : state.bestStock, mvp: mvp,
      hard: w.hard ? 1 : 0, seed: state.seed, d: state.date });
  };
  R.makeShareURL = function (base, payload) { return Board.shareUrl(base, checked(payload)); };
  R.parseShareURL = function (url) {
    var d = Board.parseUrl(url);
    return { payload: d && d.ok ? d.result : null, verified: !!(d && d.verified) };
  };
  // Rows, ordering, deduplication, clear confirmation and key all belong to Board.
  R.createBoard = function (storage, key) {
    if (storage === undefined) { try { storage = typeof localStorage === 'undefined' ? null : localStorage; } catch (e) { storage = null; } }
    return Board.local(storage, key);
  };
  R.local = R.createBoard;
  var defaultBoard;
  ['add', 'list', 'clear'].forEach(function (method) {
    R[method] = function (value) { if (!defaultBoard) defaultBoard = R.createBoard(); return defaultBoard[method](value); };
  });
  R.drawCard = function (ctx, payload, frameImg) {
    checked(payload);
    ShareCard.draw({ getContext: function () { return ctx; } }, payload, { frame: frameImg });
    return ctx;
  };
  return R;
});
