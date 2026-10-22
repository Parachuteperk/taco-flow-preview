/* Results payloads and device-local scores. No DOM or network dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.Board = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var B = {}, alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  var MAX = 131072, SAFE = 9007199254740991;
  function integer(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && Math.abs(n) <= SAFE; }
  function mode(h) { return h === 0 || h === 1 || h === false || h === true; }
  function date(d) {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    var t = new Date(d + 'T00:00:00Z');
    return isFinite(t.getTime()) && t.toISOString().slice(0, 10) === d;
  }
  B.cleanName = function (raw) {
    if (typeof raw !== 'string' || /[^a-zA-Z0-9 ]/.test(raw)) return null;
    var n = raw.replace(/^ +| +$/g, '').replace(/ +/g, ' ').toUpperCase();
    return n.length >= 3 && n.length <= 12 ? n : null;
  };
  function entry(e) {
    return e && typeof e === 'object' && B.cleanName(e.n) !== null && integer(e.s) &&
      e.s >= 0 && e.s <= 1000 && mode(e.hard) && date(e.d) &&
      (e.seed === undefined || typeof e.seed === 'string' && e.seed.length <= 128 || integer(e.seed));
  }
  function valid(e) {
    return entry(e) && e.v === 1 && typeof e.rent === 'string' && /^[0-4]\/4$/.test(e.rent) &&
      integer(e.rt) && e.rt >= 0 && integer(e.p) && typeof e.m === 'number' && isFinite(e.m) &&
      e.m >= 0 && e.m <= 10 && typeof e.bs === 'string' && e.bs.length <= 128 &&
      typeof e.mvp === 'string' && e.mvp.length <= 128 && e.seed !== undefined;
  }
  function checksum(r) {
    var h = 2166136261, str = r + 'loli-sife-2026', i;
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      // FNV prime multiplication modulo 2^32, without requiring Math.imul.
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  function pack(str) {
    var bytes = unescape(encodeURIComponent(str)), out = '', i, a, b, c;
    for (i = 0; i < bytes.length; i += 3) {
      a = bytes.charCodeAt(i); b = bytes.charCodeAt(i + 1); c = bytes.charCodeAt(i + 2);
      out += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (isNaN(b) ? 0 : b >> 4)];
      if (!isNaN(b)) out += alphabet[((b & 15) << 2) | (isNaN(c) ? 0 : c >> 6)];
      if (!isNaN(c)) out += alphabet[c & 63];
    }
    return out;
  }
  function unpack(r) {
    var bits = 0, count = 0, bytes = '', i;
    for (i = 0; i < r.length; i++) {
      bits = (bits << 6) | alphabet.indexOf(r.charAt(i)); count += 6;
      if (count >= 8) { count -= 8; bytes += String.fromCharCode((bits >> count) & 255); }
    }
    var str = decodeURIComponent(escape(bytes));
    if (pack(str) !== r) throw new Error('Noncanonical base64url');
    return str;
  }
  B.encode = function (result) { var r = pack(JSON.stringify(result)); return { r: r, c: checksum(r) }; };
  B.decode = function (r, c) {
    try {
      if (typeof r !== 'string' || !r || r.length > MAX || !/^[A-Za-z0-9_-]+$/.test(r) || r.length % 4 === 1) return { ok: false };
      var result = JSON.parse(unpack(r));
      if (!valid(result)) return { ok: false };
      return { ok: true, result: result, verified: typeof c === 'string' && /^[0-9a-fA-F]{8}$/.test(c) && c.toLowerCase() === checksum(r) && result.w === (result.s >= 700 ? 1 : 0) };
    } catch (e) { return { ok: false }; }
  };
  B.shareUrl = function (baseUrl, result, incoming) {
    var e = incoming || B.encode(result), hashAt = baseUrl.indexOf('#'), hash = hashAt < 0 ? '' : baseUrl.slice(hashAt);
    var base = hashAt < 0 ? baseUrl : baseUrl.slice(0, hashAt), q = base.indexOf('?');
    var path = q < 0 ? base : base.slice(0, q), params = q < 0 ? [] : base.slice(q + 1).split('&');
    params = params.filter(function (p) {
      if (!p) return false;
      try { var key = decodeURIComponent(p.split('=')[0].replace(/\+/g, ' ')); return key !== 'r' && key !== 'c'; }
      catch (ignore) { return true; }
    });
    params.push('r=' + encodeURIComponent(e.r));
    if (e.c !== null && e.c !== undefined) params.push('c=' + encodeURIComponent(e.c));
    return path + '?' + params.join('&') + hash;
  };
  B.parseUrl = function (href) {
    try {
      var q = href.split('#')[0].split('?').slice(1).join('?'), r = null, c = null;
      q.split('&').forEach(function (p) {
        var at = p.indexOf('='), k = decodeURIComponent(at < 0 ? p : p.slice(0, at));
        var v = decodeURIComponent(at < 0 ? '' : p.slice(at + 1));
        if (k === 'r') r = v;
        if (k === 'c') c = v;
      });
      if (r === null) return null;
      var decoded = B.decode(r, c);
      decoded.r = r; decoded.c = c;
      return decoded;
    } catch (e) { return { ok: false }; }
  };
  B.money = function (cents) {
    var amount = Math.abs(cents), remainder = amount % 100;
    var dollars = String((amount - remainder) / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (cents < 0 ? '-$' : '$') + dollars + '.' + (remainder < 10 ? '0' : '') + remainder;
  };
  B.shareText = function (r, url) {
    return "I scored " + r.s + "/1000 on The Loli's Connection (" + r.rent + ' rent' +
      (r.hard ? ', 🔥Hard' : '') + '; ' + B.money(r.p) + ' operating profit). Beat it → ' + url;
  };
  B.local = function (storage, key) {
    key = key === undefined ? 'loli.v6.board' : key;
    var memory = [], fallback = false, seen = Object.create(null);
    function sorted(rows) {
      return rows.map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) {
        return b.r.s - a.r.s || a.r.d.localeCompare(b.r.d) || a.i - b.i;
      }).slice(0, 10).map(function (x) { return x.r; });
    }
    function copy(e) {
      var out = { n: B.cleanName(e.n), s: e.s, hard: e.hard ? 1 : 0, d: e.d };
      if (e.seed !== undefined) out.seed = e.seed;
      return out;
    }
    function read() {
      if (fallback) return memory.slice();
      var raw;
      try { raw = storage.getItem(key); }
      catch (e) { fallback = true; return memory.slice(); }
      try {
        var rows = !raw || raw.length > MAX ? [] : JSON.parse(raw);
        memory = Array.isArray(rows) && rows.length <= 1000 && rows.every(entry) ? sorted(rows.map(copy)) : [];
      } catch (e) { memory = []; }
      return memory.slice();
    }
    function write(rows) {
      memory = rows;
      if (!fallback) { try { storage.setItem(key, JSON.stringify(rows)); } catch (e) { fallback = true; } }
    }
    return {
      add: function (e) {
        if (!entry(e)) return 0;
        var row = copy(e), signature = JSON.stringify([row.n, row.s, row.hard, row.d, row.seed]);
        if (seen[signature]) return 0;
        seen[signature] = true;
        var rows = read(); rows.push(row); rows = sorted(rows);
        var rank = rows.indexOf(row) + 1; write(rows); return rank;
      },
      list: function () { return read().map(copy); },
      clear: function (confirmed) {
        if (confirmed !== true) return false;
        memory = []; seen = Object.create(null);
        if (!fallback) { try { storage.removeItem(key); } catch (e) { fallback = true; } }
        return true;
      }
    };
  };
  return B;
});
