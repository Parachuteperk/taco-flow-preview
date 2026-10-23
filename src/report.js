// Pass 7 day report layout: a compact always-visible top (headline, cash, revenue, profit, tacos,
// Continue) and collapsible sections for everything else. Display only: every number comes from the
// day's result `r` (src/week.js endDay) and live read-only state; nothing here changes game math.
// Sections start collapsed; the ones the player opens stay open for the rest of the run (RP.open).
(function (TF) {
  'use strict';
  var RP = TF.Report = { open: {} };
  function d(c) { return (c < 0 ? '\u2212$' : '$') + (Math.abs(c) / 100).toFixed(2); }
  function row(label, value, cls) { return '<div class="row' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span><b>' + value + '</b></div>'; }
  function why(t) { return '<div class="why">' + t + '</div>'; }

  RP.investRows = function (rows) {
    if (!rows || !rows.length) return '';
    var h = '<div class="inv"><div class="row"><span><b>Investments</b></span><b>earned / cost \u00B7 ROI</b></div>';
    rows.forEach(function (x, i) {
      var tag = rows.length > 1 && i === 0 ? ' \u2B50 best' : rows.length > 1 && i === rows.length - 1 ? ' \u2B07 worst' : '';
      h += '<div class="row small"><span>' + x.name + (x.est ? ' <small>(est.)</small>' : '') + tag + '</span><b>' + (x.earned < 0 ? '-$' : '+$') + Math.abs(x.earned) + ' / $' + x.cost + ' \u00B7 ' + x.roi + '%' + (x.metal ? ' (now $' + x.value + ')' : '') + '</b></div>';
    });
    return h + '</div>';
  };

  // Pure: the report as data. {top:{...}, sections:[{id,title,summary,html}]}; empty sections dropped.
  RP.build = function (r, env) {
    env = env || {};
    var e = r.econ || null, o = r.obj || null;
    var lost = Object.keys(r.lost || {}).filter(function (k) { return r.lost[k] > 0; });
    var lostN = lost.reduce(function (s, k) { return s + r.lost[k]; }, 0);
    var top = { day: r.day, name: r.name, sold: r.sold, goal: r.goal, hit: r.hit,
      cashNow: env.cash, revenueCents: e ? e.revenueCents || 0 : Math.round((r.cash || 0) * 100),
      profitCents: e && typeof e.profitCents === 'number' ? e.profitCents : null, briefing: r.suggest ? r.suggest.text : '' };
    var S = [];
    // Sales & customers
    var h = row('Customers lost', lostN) + (lost.length ? why(lost.map(function (k) { return r.lost[k] + ' ' + k; }).join(' \u00B7 ')) : '') +
      row('Biggest bottleneck', r.neck ? r.neck.name + ' (' + r.neck.secs + 's)' : 'none \u2014 smooth day!');
    if (r.standSold) h += row('Best stand', 'Stand ' + (r.standSold.indexOf(Math.max.apply(null, r.standSold)) + 1) + ' (' + r.standSold.join(' vs ') + ' sold)');
    if (o && o.drinks) h += row('Drinks sold', o.drinks + (o.drinkOnly ? ' (' + o.drinkOnly + ' drink-only)' : '') + ' \u00B7 +$' + o.drinkRev);
    (r.catalog || []).forEach(function (c) { h += row(c.name, c.n + ' ' + c.unit + ' \u00B7 +$' + (Math.round(c.dollars * 100) / 100)); });
    (e && e.stands || []).forEach(function (st) {
      var f = st.funnel || { lost: {} }, fl = Object.keys(f.lost || {}).map(function (k) { return f.lost[k] + ' ' + k; }).join(' \u00B7 ');
      h += why('<b>Stand ' + (st.idx + 1) + ' \u00B7 rep ' + Math.round(st.reputation) + '/100</b><br>' + f.walkers + ' walkers \u2192 ' + f.interested + ' interested \u2192 ' + f.queued + ' queued \u2192 ' + f.served + ' served<br>Lost: ' + (fl || '0') + '<br>Profit ' + d(st.profitCents));
    });
    var side = (r.catalog || []).reduce(function (n, c) { return n + c.dollars; }, 0) + (o && o.drinkRev || 0);
    S.push({ id: 'sales', title: 'Sales & customers', summary: r.sold + ' sold \u00B7 ' + lostN + ' lost' + (side ? ' \u00B7 side items +$' + Math.round(side) : ''), html: h });
    // Costs & bills
    var costC = 0; h = '';
    if (e) {
      var pay = e.payrollCents || 0, rent = e.costs ? e.costs.rent || 0 : 0, mnt = e.costs ? e.costs.maintenance || 0 : 0;
      h += row('Payroll', d(pay)) + row('Site rent', d(rent)) + row('Maintenance', d(mnt)) +
        row('\uD83D\uDDD1 Spoiled at close', e.spoiledKits + ' kits (\u2212$' + ((e.spoiledCents || 0) / 100).toFixed(2) + ')');
      costC += pay + rent + mnt + (e.spoiledCents || 0);
      if (e.rent) h += row('Rent to Mrs. West', e.rent.paid ? '\u2714 paid' : '\u2718 short');
    }
    if (o && (o.drinks || o.upkeep)) { h += row('Drinks / upkeep', 'costs -$' + (o.upkeep + o.drinkCost)); costC += Math.round((o.upkeep + o.drinkCost) * 100); }
    if (o && o.litter) h += row('Litter on the quad', o.litter + ' wrappers' + (o.litterPct ? ' (\u2212' + o.litterPct + '% draw)' : ''));
    if (e) h += '<small>Supplies split by sales; shared costs split equally.</small>' + row('Operating cash profit', d(e.profitCents || 0));
    if (h) S.push({ id: 'costs', title: 'Costs & bills', summary: costC ? d(costC) + ' in bills' : 'no bills', html: h });
    // Upgrades & investments (per-upgrade earnings)
    var inv = r.invest || [];
    if (inv.length) S.push({ id: 'upgrades', title: 'Upgrades & earnings', summary: inv.length + ' item' + (inv.length > 1 ? 's' : '') + ' \u00B7 best ' + inv[0].name + ' ' + (inv[0].earned < 0 ? '-$' : '+$') + Math.abs(inv[0].earned), html: RP.investRows(inv) });
    // Crew (the rush-call line is appended here by src/callline.js)
    var crew = env.crew || [];
    h = (crew.length ? row('On shift', crew.join(', ')) : '') + (r.hadBet ? row('Jared\u2019s bets', r.betNet === 0 ? 'no change' : (r.betNet > 0 ? '+$' : '-$') + Math.abs(r.betNet)) : '') + '<div data-slot="crew"></div>';
    S.push({ id: 'crew', title: 'Crew', summary: crew.length ? crew.length + ' on shift' : 'just you', html: h });
    // Market & empire: remote stands, packed equipment, stock headlines (src/empire.js)
    if (env.empireHTML) S.push({ id: 'market', title: 'Stocks, market & headlines', summary: (env.headlines || 0) + ' headline' + (env.headlines === 1 ? '' : 's') + (e && e.passive && e.passive.netCents ? ' \u00B7 other stands ' + d(e.passive.netCents) : ''), html: env.empireHTML });
    // Loans
    var fl = env.floatDebt || 0, cr = env.creditDebt || 0, lr = env.loanRows || [];
    if (e || fl || cr || lr.length) {
      h = row('Owe Jared (kit float)', d(fl)) + row('Emergency credit debt', d(cr)) + lr.map(function (x) { return row(x.ref || 'Loan', d(x.cents), 'small'); }).join('');
      S.push({ id: 'loans', title: 'Loans & Jared\u2019s float', summary: fl + cr ? 'owe ' + d(fl + cr) : 'no debt', html: h });
    }
    // Story & notes (today's story beat is placed here by src/storybeats.js)
    S.push({ id: 'story', title: 'Story & notes', summary: 'today\u2019s beat', html: '<div data-slot="story"></div>' });
    return { top: top, sections: S };
  };

  RP.html = function (m) {
    var t = m.top;
    var stat = function (k, v, cls) { return '<div class="rptStat' + (cls ? ' ' + cls : '') + '"><small>' + k + '</small><b>' + v + '</b></div>'; };
    var h = '<h2>Day ' + t.day + ': ' + t.name + '</h2>' +
      '<div class="big ' + (t.hit ? 'hit' : 'miss') + '">' + t.sold + ' / ' + t.goal + ' tacos ' + (t.hit ? '\u2714 Goal hit!' : '\u2718 Missed') + '</div>' +
      '<div class="rptTop">' + (typeof t.cashNow === 'number' ? stat('Cash', '$' + t.cashNow.toFixed(2)) : '') + stat('Revenue', d(t.revenueCents)) +
      (t.profitCents === null ? '' : stat('Profit', d(t.profitCents), t.profitCents < 0 ? 'neg' : 'pos')) + stat('Tacos sold', t.sold) + '</div>' +
      (t.briefing ? '<div class="brief" id="briefing"><b>Briefing:</b> ' + t.briefing + '</div>' : '') +
      '<button id="btnNextDay">' + (t.day < 5 ? 'Next day \u2192' : 'See how the week went \u2192') + '</button>' +
      '<div class="rptSecs">' + m.sections.map(function (s) {
        return '<details class="rptSec" data-sec="' + s.id + '"' + (RP.open[s.id] ? ' open' : '') + '><summary><span>' + s.title + '</span><em>' + s.summary + '</em></summary><div class="rptBody">' + s.html + '</div></details>';
      }).join('') + '</div>';
    return h;
  };

  RP.env = function (r) {
    var C = TF.Crew, EC = TF.Econ, e = r.econ, empire = TF.Empire ? TF.Empire.reportHTML(r) : '';
    var names = C ? C.hired().map(function (id) { var x = C.ROSTER.filter(function (u) { return u.id === id; })[0]; return x ? x.name : id; }) : [];
    return { cash: TF.Sim && TF.Sim.stats ? TF.Sim.stats.money : undefined, crew: names, empireHTML: empire,
      headlines: (empire.match(/<div class="why"><b>/g) || []).length,
      floatDebt: EC && EC.finance ? EC.finance.floatDebt || 0 : 0, creditDebt: EC && EC.finance ? EC.finance.debt || 0 : 0,
      loanRows: e && TF.Ledger && TF.Ledger.rows ? TF.Ledger.rows.filter(function (x) { return x.cat === 'loan' && x.day === e.absoluteDay; }) : [] };
  };

  RP.render = function (card, r) {
    card.innerHTML = RP.html(RP.build(r, RP.env(r)));
    Array.prototype.forEach.call(card.querySelectorAll('details.rptSec'), function (el) {
      el.addEventListener('toggle', function () { RP.open[el.getAttribute('data-sec')] = el.open; });
    });
  };

  // Enter continues from the report unless focus is on a section header or another control.
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || !TF.Week || TF.Week.phase !== 'report') return;
    var card = document.getElementById('reportCard'), btn = document.getElementById('btnNextDay'), t = ev.target;
    if (!card || card.hidden || !btn || (t && t.closest && t.closest('summary, button, input, select, textarea, a'))) return;
    ev.preventDefault(); btn.click();
  });
})(window.TF);
