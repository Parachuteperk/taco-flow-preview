// Gala finale UI (Pass 6D). Win/lose scripts from data/gala.js; score via West.galaScore.
// Campaign.runFinale mounts this on the real L4 complete path (not endCard polling).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      typeof require === 'function' ? (function () { try { return require('../data/gala'); } catch (e) { return null; } })() : null
    );
  } else { root.TF = root.TF || {}; root.TF.Gala = factory({ GALA: root.TF.GALA, EPILOGUE: root.TF.EPILOGUE }); }
}(typeof window !== 'undefined' ? window : this, function (Data) {
  'use strict';
  var G = {};
  function data() {
    if (Data && Data.GALA) return Data;
    if (typeof TF !== 'undefined') return { GALA: TF.GALA, EPILOGUE: TF.EPILOGUE };
    return null;
  }
  G.WIN_THRESHOLD = 700;
  G.verdict = function (score) {
    var n = typeof score === 'number' ? score : (score && score.total);
    if (typeof n !== 'number' || !isFinite(n)) throw new TypeError('Gala score required');
    return n >= G.WIN_THRESHOLD ? 'win' : 'lose';
  };
  G.script = function (verdict) {
    var d = data();
    if (!d || !d.GALA) throw new Error('GALA data missing');
    var key = verdict === 'win' || verdict === 'lose' ? verdict : G.verdict(verdict);
    return JSON.parse(JSON.stringify(d.GALA[key]));
  };
  G.epilogue = function (verdict) {
    var d = data();
    if (!d || !d.EPILOGUE) throw new Error('EPILOGUE data missing');
    var key = verdict === 'win' || verdict === 'lose' ? verdict : G.verdict(verdict);
    return d.EPILOGUE[key];
  };
  G.play = function (scoreOrVerdict) {
    var v = scoreOrVerdict === 'win' || scoreOrVerdict === 'lose' ? scoreOrVerdict : G.verdict(scoreOrVerdict);
    return { verdict: v, lines: G.script(v), epilogue: G.epilogue(v), won: v === 'win' };
  };
  G.scoreFromLive = function (TF) {
    var west = TF && TF.Econ && TF.Econ.M, score = 0;
    try {
      if (west && typeof west.galaScore === 'function' && TF.Ledger) {
        var split = TF.Ledger.split();
        score = west.galaScore({ operatingProfitCents: split.operating, tradingNetCents: split.trading }).total;
      }
    } catch (e) { score = 0; }
    return score;
  };
  G.mount = function (host, scoreOrVerdict, opts) {
    opts = opts || {};
    if (!host || !host.ownerDocument) throw new TypeError('Host required');
    var play = G.play(scoreOrVerdict);
    var doc = host.ownerDocument;
    var overlay = doc.createElement('section');
    overlay.id = 'galaCard';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', play.won ? 'Angel Round' : 'West and Co Pop-Up');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1100;background:#170d20dd;display:grid;place-items:center;padding:12px;box-sizing:border-box;overflow:auto';
    var panel = doc.createElement('div');
    panel.style.cssText = 'width:100%;max-width:390px;box-sizing:border-box;background:#fff5d6;color:#2a1810;border:3px solid #501214;border-radius:12px;padding:14px;font:14px/1.4 system-ui;overflow-wrap:anywhere;word-break:break-word';
    overlay.appendChild(panel);
    function el(tag, text) {
      var n = doc.createElement(tag); if (text !== undefined) n.textContent = text;
      n.style.cssText = 'margin:0 0 8px;overflow-wrap:anywhere'; panel.appendChild(n); return n;
    }
    el('h2', play.won ? 'Angel Round' : 'WEST & CO. Pop-Up').style.cssText = 'margin:0 0 8px;font-size:18px;color:#7a1e2c;overflow-wrap:anywhere';
    if (typeof scoreOrVerdict === 'number' || (scoreOrVerdict && typeof scoreOrVerdict.total === 'number')) {
      el('p', 'Gala Score: ' + (typeof scoreOrVerdict === 'number' ? scoreOrVerdict : scoreOrVerdict.total) + ' / 1000').style.fontWeight = '800';
    }
    var scene = doc.createElement('div');
    scene.style.cssText = 'background:#fff;border:2px solid #e3cfa5;border-radius:8px;padding:8px;margin:0 0 10px;max-height:40vh;overflow:auto;overflow-wrap:anywhere';
    play.lines.forEach(function (line) {
      var row = doc.createElement('div');
      row.style.cssText = 'margin:0 0 6px;font-size:13px;overflow-wrap:anywhere';
      var who = doc.createElement('b'); who.textContent = (line.who || 'narrator').toUpperCase() + ': ';
      row.appendChild(who); row.appendChild(doc.createTextNode(line.text));
      scene.appendChild(row);
    });
    panel.appendChild(scene);
    el('p', play.epilogue).style.cssText = 'font-size:13px;color:#5a3a2a;overflow-wrap:anywhere';
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.textContent = opts.button || (play.won ? 'Continue → Results' : 'See results');
    btn.style.cssText = 'width:100%;min-height:48px;margin-top:8px;border:2px solid #501214;border-radius:8px;background:#c9a227;color:#2a1810;font:bold 16px system-ui;cursor:pointer';
    btn.addEventListener('click', function () {
      overlay.remove();
      if (typeof opts.onDone === 'function') opts.onDone(play);
    });
    panel.appendChild(btn);
    host.appendChild(overlay);
    btn.focus();
    return { element: overlay, play: play, destroy: function () { overlay.remove(); } };
  };
  // No DOM polling: Campaign.runFinale owns the live month-end path.
  G.install = function (TF) {
    if (!TF || G._installed) return G;
    G._installed = true;
    return G;
  };
  return G;
}));
