(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TF = root.TF || {}; root.TF.ExchangeUI = factory(); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var css = `
.qx-panel,.qx-panel *{box-sizing:border-box}.qx-panel{width:100%;max-width:100%;height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:#fff5d6;color:#2a1810;font:14px/1.35 system-ui,sans-serif;border:2px solid #501214}.qx-panel button{font:inherit;color:inherit;background:#fff5d6;border:2px solid #501214;border-radius:8px;min-height:44px;cursor:pointer;touch-action:manipulation}.qx-panel button:disabled{opacity:.55;cursor:default}.qx-panel button:focus-visible{outline:3px solid #E8B23A;outline-offset:-4px}.qx-header{padding:12px;background:#501214;color:#fff5d6}.qx-title{font-size:15px;margin:0 0 10px}.qx-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.qx-stat{min-width:0;font-size:11px}.qx-stat .qx-num{display:block;font-size:14px;font-weight:700}.qx-num{font-variant-numeric:tabular-nums;white-space:nowrap}.qx-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:10px}.qx-section{font-size:14px;margin:12px 0 6px}.qx-headline{display:block;width:100%;text-align:left;padding:9px;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.qx-headline[aria-expanded=true]{white-space:normal;overflow-wrap:anywhere}.qx-caption{display:flex;justify-content:space-between;font-size:11px;margin:8px 0}.qx-board{display:grid;gap:6px}.qx-row{display:grid;grid-template-columns:56px minmax(0,1fr) 76px;gap:4px 6px;width:100%;padding:8px;text-align:left;align-items:center}.qx-row[aria-pressed=true]{background:#E8B23A}.qx-row.qx-unlisted{color:#736b65;background:#eee9df}.qx-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:12px}.qx-price{text-align:right;font-size:13px}.qx-detail{font-size:11px;white-space:nowrap}.qx-rise{display:flex;gap:5px;align-items:center;grid-column:2 / 4;font-size:11px}.qx-bar{height:5px;flex:1;min-width:0;background:#d7cbb7;border-radius:4px;overflow:hidden}.qx-bar i{display:block;height:100%;background:#501214}.qx-holding{display:grid;grid-template-columns:1fr auto;gap:3px 8px;border-bottom:1px solid #d7cbb7;padding:6px 0;font-size:12px}.qx-holding small{grid-column:1 / -1}.qx-score{width:100%;border-collapse:collapse;font-size:12px}.qx-score th,.qx-score td{text-align:right;padding:4px}.qx-score th:first-child,.qx-score td:first-child{text-align:left}.qx-trade{flex:none;position:sticky;bottom:0;background:#fff5d6;border-top:2px solid #501214;padding:10px;box-shadow:0 -3px 8px #50121415}.qx-trade h2{font-size:14px;margin:0 0 6px}.qx-stepper{display:flex;align-items:center;gap:12px;margin-bottom:8px}.qx-stepper button{width:44px}.qx-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.qx-action button{width:100%;display:block;font-weight:700;background:#E8B23A}.qx-action small{display:block;min-height:30px;font-size:11px;margin-top:4px}.qx-toast{font-size:12px;min-height:18px;margin-top:4px;overflow-wrap:anywhere}@media(min-width:900px){.qx-panel{width:380px;margin-left:auto;height:100dvh}}`;
  function mount(container, options) {
    var doc = container.ownerDocument, win = doc.defaultView, x = options.exchange;
    if (!doc.querySelector('style[data-qx-style]')) {
      var style = doc.createElement('style'); style.dataset.qxStyle = ''; style.textContent = css; doc.head.appendChild(style);
    }
    var panel = doc.createElement('section'); panel.className = 'qx-panel'; panel.setAttribute('aria-label', 'Quad Exchange'); container.appendChild(panel);
    var day = options.day || 1, phase = String(options.phase || 'PREP').toUpperCase(), selected = null, qty = 1;
    var basis = {}, openPrices = null, message = '', locked = false, timer = null, dead = false, expanded = {};
    var money = options.formatCents || function (c) { return (c < 0 ? '-$' : '$') + (Math.abs(c) / 100).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); };
    function el(tag, cls, text, parent) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; }
    function wealth() { var held = x.portfolio(); return options.getCash() + x.board().reduce(function (s, r) { return s + r.cents * (held[r.sym] || 0); }, 0); }
    function captureOpenPrices() {
      var state = x.getState();
      return Object.assign({}, state.openPrices || x.board().reduce(function (prices, r) { prices[r.sym] = r.cents; return prices; }, {}));
    }
    function render() {
      if (dead) return;
      var scroll = panel.querySelector('.qx-scroll'), scrollTop = scroll ? scroll.scrollTop : 0;
      var focus = doc.activeElement && panel.contains(doc.activeElement) ? doc.activeElement.dataset.qxKey : null;
      var state = x.getState(), board = x.board(), held = x.portfolio(), cash = options.getCash();
      var metadata = {}; state.tickers.forEach(function (t) { metadata[t.sym] = t; });
      if (openPrices === null) openPrices = captureOpenPrices();
      if (!selected || !board.some(function (r) { return r.sym === selected; })) selected = board.length ? board[0].sym : null;
      panel.replaceChildren();
      var header = el('header','qx-header',undefined,panel); el('h1','qx-title','QUAD EXCHANGE · Day ' + day + ' · ' + phase,header);
      var stats = el('div','qx-stats',undefined,header), value = wealth() - cash;
      var dayPnl = board.reduce(function (sum, r) { return sum + (r.cents - (openPrices[r.sym] === undefined ? r.cents : openPrices[r.sym])) * (held[r.sym] || 0); }, 0);
      [['Cash',cash],['Portfolio',value],['Day P&L',dayPnl]].forEach(function (s) { var cell = el('div','qx-stat',s[0],stats); el('span','qx-num',money(s[1]),cell); });
      var body = el('div','qx-scroll',undefined,panel);
      x.starHeadlines(day).forEach(function (h, i) {
        var b = el('button','qx-headline','★ ' + h.sym + ' · ' + (h.text || h.type),body); b.type = 'button'; b.title = b.textContent; b.dataset.qxKey = 'headline'+i; b.setAttribute('aria-expanded',!!expanded[i]);
        b.onclick = function () { expanded[i] = !expanded[i]; render(); };
      });
      if (x.headlines) x.headlines(day).forEach(function (h, i) {
        var b = el('button','qx-headline','📈 ' + h.sym + ' ' + (h.pct>=0?'+':'') + h.pct + '% · ' + h.text,body); b.type = 'button'; b.title = b.textContent; b.dataset.qxKey = 'movehl'+i;
      });
      el('div','qx-caption','Ticker / company · price · held · rise chance',body);
      var list = el('div','qx-board',undefined,body);
      board.forEach(function (r) {
        var b = el('button','qx-row' + (r.listed ? '' : ' qx-unlisted'),undefined,list); b.type = 'button'; b.dataset.sym = r.sym; b.dataset.qxKey = 'row'+r.sym; b.setAttribute('aria-pressed',r.sym === selected);
        el('strong','',r.sym,b); var name = el('span','qx-name',metadata[r.sym].name,b); name.title = metadata[r.sym].name;
        var move = state.lastClose && state.lastClose.day === day && state.lastClose.moves.find(function (m) { return m.sym === r.sym; });
        el('span','qx-num qx-price',money(r.cents) + (move ? (move.toCents >= move.fromCents ? ' ▲' : ' ▼') : ''),b);
        el('span','qx-num qx-detail',(held[r.sym] || 0) + ' held',b);
        var rise = el('span','qx-rise',undefined,b); el('span','qx-num',r.listed ? r.p + '% rise' : 'Opens Day ' + metadata[r.sym].opensDay,rise);
        var bar = el('span','qx-bar',undefined,rise); el('i','',undefined,bar).style.width = r.p + '%';
        b.onclick = function () { selected = r.sym; qty = 1; render(); };
      });
      el('h2','qx-section','Portfolio',body);
      var holdings = el('div','qx-holdings',undefined,body), count = 0;
      board.forEach(function (r) { var n = held[r.sym] || 0; if (!n) return; count++;
        var row = el('div','qx-holding',undefined,holdings); el('span','qx-num',r.sym + ' · ' + n + ' shares',row); el('span','qx-num',money(n*r.cents),row);
        el('small','qx-num',basis[r.sym] && basis[r.sym].shares === n ? 'Unrealized ' + money(n*r.cents-basis[r.sym].cents) + ' · avg ' + money(Math.round(basis[r.sym].cents/n)) : 'Unrealized P&L unavailable',row);
      }); if (!count) el('p','','No holdings',holdings);
      el('h2','qx-section','Trust scorecard',body); var table = el('table','qx-score',undefined,body), tr = el('tr','',undefined,el('thead','',undefined,table));
      ['Source','Week','Month'].forEach(function (s) { el('th','',s,tr); }); var tb = el('tbody','',undefined,table), scores = x.scorecard();
      ['star','jared','antonio','west'].forEach(function (s) { var row = el('tr','',undefined,tb); el('td','',s === 'star' ? 'University Star' : s[0].toUpperCase()+s.slice(1),row); ['week','month'].forEach(function (p) { var v = scores[p][s]; el('td','qx-num',v.hits + '/' + v.total,row); }); });
      var trade = el('section','qx-trade',undefined,panel), r = board.find(function (r) { return r.sym === selected; });
      if (r) {
        var n = held[selected] || 0;
        function feeOf(v) { return Math.max(100, Math.round(v * 0.02)); }
        var buyMax = Math.max(0, Math.floor((cash - 100) / (r.cents * 1.02)));
        var max = Math.max(1, buyMax, n);
        qty = Math.max(1, Math.min(max, qty));
        el('h2','',selected + ' · Trade whole shares',trade); var step = el('div','qx-stepper',undefined,trade);
        function button(text, key, parent, fn) { var b = el('button','',text,parent); b.type = 'button'; b.dataset.qxKey = key; b.onclick = fn; return b; }
        var minus = button('−','minus',step,function () { qty--; render(); }); minus.setAttribute('aria-label','Decrease quantity'); minus.disabled = qty <= 1;
        el('span','qx-num qx-quantity',String(qty),step);
        var plus = button('+','plus',step,function () { qty++; render(); }); plus.setAttribute('aria-label','Increase quantity'); plus.disabled = qty >= max;
        var actions = el('div','qx-actions',undefined,trade);
        var tradablePhase = (phase === 'PREP' || phase === 'REPORT') && (state.phase === 'prep' || state.phase === 'close');
        [true,false].forEach(function (buying) {
          var fee = feeOf(r.cents * qty);
          var reason = !tradablePhase ? 'Trading closed' : !r.listed ? 'Not listed' : !buying && n < qty ? (n ? 'Insufficient shares' : 'No shares') : buying && cash < r.cents*qty + fee ? 'Insufficient cash' : '';
          var cell = el('div','qx-action',undefined,actions), label = buying ? 'BUY' : 'SELL';
          var cost = buying ? r.cents*qty + fee : r.cents*qty - fee;
          var b = button(label + ' ' + money(cost),label.toLowerCase(),cell,function () {
            if (locked || dead || reason) return; locked = true;
            try {
              var symbol = selected, amount = qty, before = x.portfolio()[symbol] || 0;
              var result = buying ? x.buy(symbol,amount) : x.sell(symbol,amount);
              message = result.ok ? (buying ? 'Bought ' : 'Sold ') + amount + ' ' + symbol + ' · 2% fee' : result.reason;
              if (result.ok) {
                var known = basis[symbol];
                if (buying && (!before || known && known.shares === before)) basis[symbol] = {shares:before+amount,cents:(before ? known.cents : 0)+r.cents*amount+fee};
                else if (!buying && known && known.shares === before) {
                  basis[symbol] = {shares:before-amount,cents:known.cents-Math.floor(known.cents*amount/before)};
                }
                try { if (options.onChange) options.onChange(result); }
                catch (saveError) { message += ' · Saved? No — save failed'; }
              }
            } catch (error) { message = 'Trade failed: ' + error.message; }
            finally {
              timer = win.setTimeout(function () {
                locked = false; timer = null;
                try { render(); } catch (renderError) { /* A later render can recover the UI. */ }
              },400);
              render();
            }
          }); b.disabled = !!reason || locked; b.title = reason || '2% fee (min $1) included';
          el('small','',reason || (buying ? 'Cost' : 'Proceeds') + ' includes 2% fee',cell);
        });
      }
      var toast = el('div','qx-toast',message,trade); toast.setAttribute('role','status'); toast.setAttribute('aria-live','polite');
      body.scrollTop = scrollTop;
      if (focus) { var target = Array.from(panel.querySelectorAll('[data-qx-key]')).find(function (e) { return e.dataset.qxKey === focus; }); if (target) target.focus({preventScroll:true}); }
    }
    var api = {render:render, destroy:function () { dead = true; if (timer !== null) win.clearTimeout(timer); panel.remove(); },
      setPhase:function (p) { phase = String(p).toUpperCase(); render(); }, setDay:function (d) { if (day !== d) { day = d; openPrices = captureOpenPrices(); expanded = {}; } render(); },
      getState:function () { return JSON.parse(JSON.stringify({day:day,phase:phase,selected:selected,quantity:qty,basis:basis,openPrices:openPrices,expanded:expanded})); },
      setState:function (s) { day = s.day; phase = String(s.phase).toUpperCase(); selected = s.selected; qty = s.quantity || 1; basis = JSON.parse(JSON.stringify(s.basis || {})); openPrices = s.openPrices ? JSON.parse(JSON.stringify(s.openPrices)) : captureOpenPrices(); expanded = s.expanded || {}; render(); }};
    render(); return api;
  }
  return {mount:mount};
}));
