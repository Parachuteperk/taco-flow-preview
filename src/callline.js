// Aaron's daily decision, isolated from crew/economy modifier ownership.
(function (TF) {
  var Sim = TF.Sim, panel, badge, dayKey = null, records = {}, record = null;
  var auto = (navigator.webdriver || new URLSearchParams(location.search).has('autotest')) && new URLSearchParams(location.search).get('callline') !== 'manual';
  var L = TF.CallLine = { active: false, mode: 'steady', left: 0, orders: 0, records: records };
  var style = document.createElement('style');
  style.textContent = '#callLineShade{position:fixed;inset:0;z-index:12;display:grid;place-items:center;background:#21181088;padding:14px}#callLineShade[hidden]{display:none}#callLinePanel{box-sizing:border-box;width:min(410px,100%);max-height:90dvh;overflow:auto;background:#ebd09a;border:4px solid;border-color:#fff2bd #6d422c #6d422c #fff2bd;color:#42231b;padding:14px;box-shadow:5px 5px #24170f}#callLinePanel h2{margin:0 0 8px;background:#7a1e2c;color:#ffe6a0;padding:8px;font-size:20px}#callLinePanel p{margin:10px 0;font-size:14px}#callLinePanel button{display:block;width:100%;text-align:left;border-radius:0;margin-top:10px;min-height:58px;border:3px solid;border-color:#fff4ca #795334 #795334 #fff4ca}#callLinePanel small{display:block;margin-top:5px;font-weight:500}#callLineBadge{background:#eab743;color:#46251b;border:2px solid #fff0bc;font-size:12px}';
  document.head.appendChild(style);
  panel = document.createElement('div'); panel.id = 'callLineShade'; panel.hidden = true;
  panel.innerHTML = '<section id="callLinePanel" role="dialog" aria-modal="true" aria-labelledby="callLineHeading"><h2 id="callLineHeading">Aaron: Call the Line!</h2><p>The bell wave is here. How do we run this rush?</p><p><b>Game paused — choose a plan.</b></p><button data-call="push">» Push the Line<small>+20% service speed for 30s; +15% ingredients used.</small></button><button data-call="premium">$ Premium Service<small>+$1 on the next 10 orders; −15% service speed until sold.</small></button><button data-call="steady">= Keep It Steady<small>Regular service, regular costs.</small></button></section>';
  document.body.appendChild(panel);
  badge = document.createElement('span'); badge.id = 'callLineBadge'; badge.className = 'chip'; badge.hidden = true; document.getElementById('hud').appendChild(badge);
  var previousFocus;
  panel.addEventListener('click', function (e) { var b = e.target.closest('[data-call]'); if (b) L.choose(b.dataset.call); });
  panel.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); L.choose('steady'); }
    if (e.key === 'Tab') { var bs = panel.querySelectorAll('button'), first = bs[0], last = bs[bs.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  });
  L.choose = function (mode) {
    if (!L.active || !/^(push|premium|steady)$/.test(mode)) return false;
    L.mode = mode; L.left = mode === 'push' ? 30 : 0; L.orders = mode === 'premium' ? 10 : 0;
    record.choice = mode; L.active = false; panel.hidden = true;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    return true;
  };
  L.rate = function () { return L.mode === 'push' && L.left > 0 ? 1.2 : L.mode === 'premium' && L.orders > 0 ? 0.85 : 1; };
  L.onPay = function (g, st) {
    if (!record) return 0;
    if (L.mode === 'push' && L.left > 0) {
      if (TF.Econ && TF.Econ.on()) TF.Econ.waste(0.15, st); else st.stock = Math.max(0, st.stock - 0.15);   // Taco Week: real kits
      record.waste += 0.15; record.affected++;
    }
    if (L.mode !== 'premium' || L.orders <= 0) return 0;
    L.orders--; record.bonus++; record.affected++;
    if (TF.FX) TF.FX.premium(g, st);
    else { var w = Sim.windowPos(st); Sim.floaters.push({ x: w.x, y: w.y, text: '+$1 PREMIUM', t: 0 }); }
    return 1;
  };
  L.step = function (dt) {
    var W = TF.Week, week = W && W.active(), key = week ? W.day : 'free';
    if (key !== dayKey) { dayKey = key; L.mode = 'steady'; L.left = 0; L.orders = 0; L.active = false; panel.hidden = true; record = records[key] = { choice: null, bonus: 0, waste: 0, affected: 0, seconds: 0 }; }
    if (week && W.phase !== 'open' && W.phase !== 'close') { L.left = 0; L.orders = 0; return; }
    if (L.left > 0) { var used = Math.min(dt, L.left); L.left -= used; record.seconds += used; }
    var hot = week ? W.phase === 'open' && W.bell && W.bell.warn <= 0 : Sim.rushT > 0;
    if (!record.choice && !L.active && hot) {
      L.active = true;
      if (auto) L.choose('steady');
      else { previousFocus = document.activeElement; panel.hidden = false; panel.querySelector('button').focus(); }
    }
  };
  L.frame = function () {
    var value = L.left > 0 ? '» Push ' + Math.ceil(L.left) + 's · +15% ingredients' : L.orders > 0 ? '$ Premium · ' + L.orders + ' orders · −15% speed' : record && record.choice ? '= Aaron: steady service' : '';
    badge.hidden = !value; if (badge.textContent !== value) badge.textContent = value;
    var W = TF.Week;
    if (W && W.results) for (var i = 0; i < W.results.length; i++) if (W.results[i] && records[i + 1]) W.results[i].callLine = records[i + 1];
    var card = document.getElementById('reportCard');
    if (W && W.phase === 'report' && !card.hidden && !card.querySelector('.callLineReport')) {
      var r = records[W.day], p = document.createElement('p'); p.className = 'callLineReport brief';
      p.textContent = !r || !r.choice ? 'Aaron: no rush decision today.' : 'Aaron: ' + ({ push: 'Push the Line', premium: 'Premium Service', steady: 'Keep It Steady' })[r.choice] + ' · ' + r.affected + ' orders affected · +$' + r.bonus + ' premium revenue · ' + r.waste.toFixed(2) + ' extra ingredients used' + (r.choice === 'push' ? ' · ' + Math.round(r.seconds) + 's at +20% speed' : r.choice === 'premium' ? ' · −15% speed during premium service' : ' · regular service');
      (card.querySelector('[data-slot="crew"]') || card).appendChild(p);   // Pass 7: the report's Crew section
    }
  };
  // Called at crew foot points by the renderer; real-time motion stays legible at 4x.
  L.drawCrew = function (ctx, x, y, z) {
    if (L.mode !== 'push' || L.left <= 0) return;
    var shift = (performance.now() / 70) % 5;
    ctx.strokeStyle = '#fff2a0'; ctx.lineWidth = 2 * z;
    for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - (18 + shift) * z, y - (10 + i * 5) * z); ctx.lineTo(x - (8 + shift) * z, y - (10 + i * 5) * z); ctx.stroke(); }
  };
})(window.TF);
