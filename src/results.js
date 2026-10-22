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
  // Pass 6D text helpers (data/results-text.js → TF.RESULTS / TF.RANKS / TF.MVP_LINES).
  function textData() {
    if (typeof TF !== 'undefined') return { RESULTS: TF.RESULTS, RANKS: TF.RANKS, MVP_LINES: TF.MVP_LINES };
    try {
      var t = require('../data/results-text');
      return t;
    } catch (e) { return {}; }
  }
  R.rankFor = function (score) {
    var ranks = textData().RANKS || [];
    var best = ranks[0] || { min: 0, title: '', blurb: '' };
    ranks.forEach(function (r) { if (score >= r.min) best = r; });
    return { min: best.min, title: best.title, blurb: best.blurb };
  };
  R.ranksOrdered = function () {
    var ranks = (textData().RANKS || []).slice();
    for (var i = 1; i < ranks.length; i++) if (!(ranks[i].min > ranks[i - 1].min)) return false;
    return ranks.length > 0;
  };
  R.mvpLine = function (id) {
    var lines = textData().MVP_LINES || {};
    return lines[id] || '';
  };
  R.labels = function () { return textData().RESULTS || {}; };
  R.mount = function (host, payload, opts) {
    opts = opts || {};
    if (!host || !host.ownerDocument) throw new TypeError('Host required');
    checked(payload);
    var doc = host.ownerDocument, L = R.labels(), rank = R.rankFor(payload.s);
    var wrap = doc.createElement('section');
    wrap.id = 'resultsScreen';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:1200;background:#170d20ee;display:grid;place-items:center;padding:12px;box-sizing:border-box;overflow:auto';
    var panel = doc.createElement('div');
    panel.style.cssText = 'width:100%;max-width:390px;box-sizing:border-box;background:#fff5d6;color:#2a1810;border:3px solid #501214;border-radius:12px;padding:14px;overflow-wrap:anywhere;word-break:break-word;font:14px/1.4 system-ui';
    wrap.appendChild(panel);
    function row(label, value) {
      var r = doc.createElement('div');
      r.style.cssText = 'display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-top:1px solid #e3cfa5;overflow-wrap:anywhere';
      var a = doc.createElement('span'); a.textContent = label;
      var b = doc.createElement('b'); b.textContent = value; b.style.cssText = 'text-align:right;overflow-wrap:anywhere';
      r.appendChild(a); r.appendChild(b); panel.appendChild(r);
    }
    var h = doc.createElement('h2'); h.textContent = L.title || 'Night Results'; h.style.cssText = 'margin:0 0 6px;color:#7a1e2c;overflow-wrap:anywhere';
    panel.appendChild(h);
    var big = doc.createElement('div'); big.className = 'big';
    big.style.cssText = 'font-size:28px;font-weight:900;margin:6px 0;overflow-wrap:anywhere';
    big.textContent = (L.scoreLabel || 'Gala Score') + ': ' + payload.s;
    panel.appendChild(big);
    var title = doc.createElement('p'); title.style.cssText = 'margin:0 0 8px;font-weight:800;overflow-wrap:anywhere';
    title.textContent = rank.title + ' — ' + rank.blurb;
    panel.appendChild(title);
    row(L.rentLabel || 'Rent Paid', payload.rent + (payload.rt ? ' · ' + payload.rt + ' retry' : ''));
    row(L.profitLabel || 'Profit', Board.money ? Board.money(payload.p) : String(payload.p));
    row(L.moodLabel || 'West Mood', payload.m + '/10');
    row(L.bestStockLabel || 'Best Stock %', payload.bs || '—');
    var mvp = payload.mvp || '';
    row(L.mvpLabel || 'Crew MVP', mvp ? mvp + (R.mvpLine(mvp) ? ' — ' + R.mvpLine(mvp) : '') : '—');
    if (payload.hard) {
      var hard = doc.createElement('p'); hard.textContent = L.hardTag || 'HARD';
      hard.style.cssText = 'font-weight:800;color:#b8283a;overflow-wrap:anywhere'; panel.appendChild(hard);
    }
    var boardHost = doc.createElement('div');
    boardHost.style.cssText = 'margin-top:10px;overflow-wrap:anywhere';
    var bh = doc.createElement('h3'); bh.textContent = L.boardTitle || 'Local Top 10';
    bh.style.cssText = 'margin:8px 0 4px;font-size:15px;overflow-wrap:anywhere'; boardHost.appendChild(bh);
    var board = R.createBoard(opts.storage);
    // Record the finish before painting Top 10 so the new score is on first paint.
    var rank = 0;
    try { rank = board.add(payload) || 0; } catch (e) { rank = 0; }
    var rows = board.list();
    var list = doc.createElement('ol'); list.style.cssText = 'margin:0;padding-left:20px;overflow-wrap:anywhere';
    rows.forEach(function (e, i) {
      var li = doc.createElement('li'); li.textContent = e.n + ' — ' + e.s;
      if (rank && i + 1 === rank) li.style.cssText = 'font-weight:800';
      list.appendChild(li);
    });
    if (!rows.length) {
      var empty = doc.createElement('p'); empty.textContent = L.emptyBoard || 'No scores yet';
      empty.style.cssText = 'margin:0;overflow-wrap:anywhere'; boardHost.appendChild(empty);
    } else boardHost.appendChild(list);
    panel.appendChild(boardHost);
    if (ShareCard && ShareCard.mount && !opts.skipShare) {
      var shareHost = doc.createElement('div');
      shareHost.style.cssText = 'margin-top:10px;max-width:100%;overflow:auto';
      panel.appendChild(shareHost);
      var shareOpts = Object.assign({}, opts, { skipBoard: true });
      ShareCard.mount(shareHost, payload, shareOpts);
    }
    var close = doc.createElement('button');
    close.type = 'button'; close.textContent = 'Close';
    close.style.cssText = 'width:100%;min-height:44px;margin-top:10px';
    close.onclick = function () { wrap.remove(); if (opts.onClose) opts.onClose(); };
    panel.appendChild(close);
    host.appendChild(wrap);
    return { element: wrap, board: board, destroy: function () { wrap.remove(); } };
  };
  return R;
});
